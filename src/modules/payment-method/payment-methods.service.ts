import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethodEntity)
    private paymentMethodRepository: Repository<PaymentMethodEntity>,
  ) {}

  async list(
    companyId: string,
    includeInactive = false,
  ): Promise<PaymentMethodEntity[]> {
    // Ordering rule: global methods first, then company methods, alphabetical.
    const query = this.paymentMethodRepository
      .createQueryBuilder('method')
      .where(
        '(method.isGlobal = true OR (method.isGlobal = false AND method.companyId = :companyId))',
        { companyId },
      )
      .orderBy('method.isGlobal', 'DESC')
      .addOrderBy('method.name', 'ASC');

    if (!includeInactive) {
      query.andWhere('method.isActive = true');
    }

    return query.getMany();
  }

  async create(
    companyId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodEntity> {
    const existing = await this.paymentMethodRepository.findOne({
      where: { companyId, name: dto.name, isGlobal: false },
    });

    if (existing) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment method name already exists for this company.',
        HttpStatus.BAD_REQUEST,
        { name: dto.name },
      );
    }

    const method = this.paymentMethodRepository.create({
      companyId,
      name: dto.name,
      providerName: dto.providerName,
      instructions: dto.instructions,
      requiresReference: dto.requiresReference ?? false,
      isGlobal: false,
      isActive: true,
      code: null,
    });

    return this.paymentMethodRepository.save(method);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodEntity> {
    const method = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!method) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment method not found.',
        HttpStatus.NOT_FOUND,
        { id },
      );
    }

    if (method.isGlobal) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Global payment methods cannot be updated.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (method.companyId !== companyId) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'You do not have access to this payment method.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (dto.name && dto.name !== method.name) {
      const existing = await this.paymentMethodRepository.findOne({
        where: { companyId, name: dto.name, isGlobal: false },
      });
      if (existing) {
        throw new BusinessException(
          ErrorCode.VALIDATION_ERROR,
          'Payment method name already exists for this company.',
          HttpStatus.BAD_REQUEST,
          { name: dto.name },
        );
      }
    }

    const updated = this.paymentMethodRepository.merge(method, dto);
    return this.paymentMethodRepository.save(updated);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const method = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!method) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment method not found.',
        HttpStatus.NOT_FOUND,
        { id },
      );
    }

    if (method.isGlobal) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Global payment methods cannot be deleted.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (method.companyId !== companyId) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'You do not have access to this payment method.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!method.isActive) {
      return;
    }

    method.isActive = false;
    await this.paymentMethodRepository.save(method);
  }

  async hardDelete(
    companyId: string,
    id: string,
    isUsed: (methodId: string) => Promise<boolean>,
  ): Promise<void> {
    const method = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!method) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment method not found.',
        HttpStatus.NOT_FOUND,
        { id },
      );
    }

    if (method.isGlobal) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Global payment methods cannot be deleted.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (method.companyId !== companyId) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'You do not have access to this payment method.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (await isUsed(method.id)) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Payment method is already used in payments and cannot be deleted.',
        HttpStatus.BAD_REQUEST,
        { id },
      );
    }

    await this.paymentMethodRepository.delete(method.id);
  }
}

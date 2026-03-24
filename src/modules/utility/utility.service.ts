import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { UtilityMeter } from './entities/utility-meter.entity';
import { UtilityReading } from './entities/utility-reading.entity';
import { UtilityType } from '../../shared/enums/utility-type.enum';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { RentCycleLineItem } from '../rent-cycle/entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { RentCycleLineItemType } from '../../shared/enums/rent-cycle-line-item-type.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { RentCycleStatus } from '../../shared/enums/rent-cycle-status.enum';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import {
  UnitWaterHistoryResponseDto,
  WaterReadingResponseDto,
} from './dto/utility-response.dto';

@Injectable()
export class UtilityService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(UtilityMeter)
    private readonly utilityMeterRepository: Repository<UtilityMeter>,
    @InjectRepository(UtilityReading)
    private readonly utilityReadingRepository: Repository<UtilityReading>,
    @InjectRepository(RentCycle)
    private readonly rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserCompany)
    private readonly userCompanyRepository: Repository<UserCompany>,
  ) {}

  async recordWaterReading(
    unitId: string,
    currentReading: number,
    requesterUserId: string,
  ): Promise<WaterReadingResponseDto> {
    const unit = await this.unitRepository.findOne({
      where: { id: unitId, isActive: true },
    });

    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId },
      );
    }

    await this.assertUserCanAccessCompany(requesterUserId, unit.companyId);

    const meter = await this.utilityMeterRepository.findOne({
      where: {
        unitId: unit.id,
        type: UtilityType.WATER,
        isActive: true,
      },
    });

    if (!meter) {
      throw new BusinessException(
        ErrorCode.WATER_METER_NOT_FOUND,
        ERROR_MESSAGES.WATER_METER_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
        { unitId },
      );
    }

    const property = await this.propertyRepository.findOne({
      where: { id: unit.propertyId, isActive: true },
    });

    if (!property) {
      throw new BusinessException(
        ErrorCode.PROPERTY_NOT_FOUND,
        ERROR_MESSAGES.PROPERTY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { propertyId: unit.propertyId },
      );
    }

    if (!property.waterEnabled) {
      throw new BusinessException(
        ErrorCode.WATER_DISABLED_FOR_PROPERTY,
        ERROR_MESSAGES.WATER_DISABLED_FOR_PROPERTY,
        HttpStatus.BAD_REQUEST,
        { propertyId: property.id },
      );
    }

    if (unit.utilitiesIncluded === true) {
      throw new BusinessException(
        ErrorCode.WATER_UTILITIES_INCLUDED,
        ERROR_MESSAGES.WATER_UTILITIES_INCLUDED,
        HttpStatus.BAD_REQUEST,
        { unitId: unit.id },
      );
    }

    const activeLease = await this.leaseRepository.findOne({
      where: {
        unitId: unit.id,
        status: LeaseStatus.ACTIVE,
        isActive: true,
      },
      relations: ['tenant'],
      order: { updatedAt: 'DESC' },
    });

    if (!activeLease) {
      throw new BusinessException(
        ErrorCode.WATER_LEASE_INACTIVE_FOR_READING,
        ERROR_MESSAGES.WATER_LEASE_INACTIVE_FOR_READING,
        HttpStatus.BAD_REQUEST,
        { unitId: unit.id },
      );
    }

    if (!activeLease.tenant || !activeLease.tenant.isActive) {
      throw new BusinessException(
        ErrorCode.WATER_NO_ACTIVE_TENANT,
        ERROR_MESSAGES.WATER_NO_ACTIVE_TENANT,
        HttpStatus.BAD_REQUEST,
        { unitId: unit.id, leaseId: activeLease.id },
      );
    }

    const latestReading = await this.utilityReadingRepository.findOne({
      where: { meterId: meter.id },
      order: { readingDate: 'DESC', createdAt: 'DESC' },
    });

    const previousReading = latestReading
      ? Number(latestReading.currentReading)
      : unit.lastWaterReading !== null && unit.lastWaterReading !== undefined
        ? Number(unit.lastWaterReading)
        : null;

    if (previousReading === null) {
      throw new BusinessException(
        ErrorCode.WATER_MISSING_INITIAL_READING,
        ERROR_MESSAGES.WATER_MISSING_INITIAL_READING,
        HttpStatus.BAD_REQUEST,
        { unitId: unit.id, meterId: meter.id },
      );
    }

    if (currentReading < previousReading) {
      throw new BusinessException(
        ErrorCode.WATER_INVALID_READING,
        ERROR_MESSAGES.WATER_INVALID_READING,
        HttpStatus.BAD_REQUEST,
        { currentReading, previousReading },
      );
    }

    if (property.waterRatePerM3 === null || property.waterRatePerM3 === undefined) {
      throw new BusinessException(
        ErrorCode.WATER_RATE_NOT_CONFIGURED,
        ERROR_MESSAGES.WATER_RATE_NOT_CONFIGURED,
        HttpStatus.BAD_REQUEST,
        { propertyId: property.id },
      );
    }

    const rate = Number(property.waterRatePerM3);
    const usage = currentReading - previousReading;
    const total = usage * rate;

    const readingDate = new Date();
    readingDate.setHours(0, 0, 0, 0);

    const reading = this.utilityReadingRepository.create({
      meterId: meter.id,
      readingDate,
      previousReading,
      currentReading,
      usage,
      rateUsed: rate,
      totalAmount: total,
      isBilled: false,
      rentCycleId: null,
    });

    let createdReading: UtilityReading;
    try {
      createdReading = await this.utilityReadingRepository.save(reading);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        throw new BusinessException(
          ErrorCode.WATER_DUPLICATE_READING_SAME_DATE,
          ERROR_MESSAGES.WATER_DUPLICATE_READING_SAME_DATE,
          HttpStatus.BAD_REQUEST,
          { meterId: meter.id, readingDate },
        );
      }
      throw error;
    }

    unit.lastWaterReading = currentReading;
    await this.unitRepository.save(unit);

    return this.toWaterReadingDto(createdReading);
  }

  /**
   * @param requesterUserId When omitted (e.g. invoice generation), company access is not checked.
   */
  async attachUtilityToRentCycle(
    rentCycleId: string,
    requesterUserId?: string,
  ): Promise<{ totalUtilityAdded: number; readingsProcessed: number }> {
    const rentCycle = await this.rentCycleRepository.findOne({
      where: { id: rentCycleId },
      relations: ['lease'],
    });

    if (!rentCycle) {
      throw new BusinessException(
        ErrorCode.RENT_CYCLE_NOT_FOUND,
        ERROR_MESSAGES.RENT_CYCLE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { rentCycleId },
      );
    }

    if (requesterUserId) {
      await this.assertUserCanAccessCompany(requesterUserId, rentCycle.companyId);
    }

    if (rentCycle.isDeposit) {
      return { totalUtilityAdded: 0, readingsProcessed: 0 };
    }

    const lease = await this.leaseRepository.findOne({
      where: { id: rentCycle.leaseId, isActive: true },
      relations: ['unit'],
    });

    if (!lease || !lease.unit) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId: rentCycle.leaseId },
      );
    }

    if (lease.utilitiesIncluded === true || lease.unit.utilitiesIncluded === true) {
      return { totalUtilityAdded: 0, readingsProcessed: 0 };
    }

    const cycleStatus = await this.getRentCycleStatus(rentCycle.id);
    if (!this.isOpenStatus(cycleStatus)) {
      throw new BusinessException(
        ErrorCode.UTILITY_RENT_CYCLE_CLOSED,
        ERROR_MESSAGES.UTILITY_RENT_CYCLE_CLOSED,
        HttpStatus.BAD_REQUEST,
        { rentCycleId: rentCycle.id, status: cycleStatus },
      );
    }
    return this.utilityReadingRepository.manager.transaction(async (manager) => {
      const lockedReadings = await manager
        .createQueryBuilder(UtilityReading, 'reading')
        .innerJoinAndSelect('reading.meter', 'meter')
        .where('meter.unitId = :unitId', { unitId: lease.unitId })
        .andWhere('reading.isBilled = :isBilled', { isBilled: false })
        .orderBy('reading.readingDate', 'ASC')
        .addOrderBy('reading.createdAt', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      if (lockedReadings.length === 0) {
        return { totalUtilityAdded: 0, readingsProcessed: 0 };
      }

      const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
      });

      const totalUtilityAdded = lockedReadings.reduce(
        (sum, reading) => sum + Number(reading.totalAmount),
        0,
      );

      const lineItems = lockedReadings.map((reading) =>
        manager.create(RentCycleLineItem, {
          rentCycleId: rentCycle.id,
          type: RentCycleLineItemType.UTILITY,
          amount: Number(reading.totalAmount),
          description: `Water usage for ${monthYearFormatter.format(new Date(reading.readingDate))}`,
          isLateFee: false,
        }),
      );
      await manager.save(RentCycleLineItem, lineItems);

      await manager
        .createQueryBuilder()
        .update(UtilityReading)
        .set({
          isBilled: true,
          rentCycleId: rentCycle.id,
        })
        .whereInIds(lockedReadings.map((r) => r.id))
        .andWhere('isBilled = :isBilled', { isBilled: false })
        .execute();

      await manager.update(
        RentCycle,
        { id: rentCycle.id },
        { totalAmountDue: Number(rentCycle.totalAmountDue) + totalUtilityAdded },
      );

      return {
        totalUtilityAdded,
        readingsProcessed: lockedReadings.length,
      };
    });
  }

  async getUnitWaterHistory(
    unitId: string,
    page: number = 1,
    limit: number = 20,
    requesterUserId?: string,
  ): Promise<UnitWaterHistoryResponseDto> {
    const unit = await this.unitRepository.findOne({
      where: { id: unitId, isActive: true },
    });

    if (!unit) {
      throw new BusinessException(
        ErrorCode.UNIT_NOT_FOUND,
        ERROR_MESSAGES.UNIT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { unitId },
      );
    }

    if (requesterUserId) {
      await this.assertUserCanAccessCompany(requesterUserId, unit.companyId);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const readingsQb = this.utilityReadingRepository
      .createQueryBuilder('reading')
      .innerJoinAndSelect('reading.meter', 'meter')
      .leftJoinAndSelect('reading.rentCycle', 'rentCycle')
      .where('meter.unitId = :unitId', { unitId })
      .orderBy('reading.readingDate', 'DESC')
      .addOrderBy('reading.createdAt', 'DESC');

    const [rows, total] = await readingsQb.skip(skip).take(safeLimit).getManyAndCount();

    const totalsRaw = await this.utilityReadingRepository
      .createQueryBuilder('reading')
      .innerJoin('reading.meter', 'meter')
      .where('meter.unitId = :unitId', { unitId })
      .select('COALESCE(SUM(reading.usage), 0)', 'totalUsage')
      .addSelect(
        'COALESCE(SUM(CASE WHEN reading.isBilled = true THEN reading.totalAmount ELSE 0 END), 0)',
        'totalBilledAmount',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN reading.isBilled = false THEN reading.totalAmount ELSE 0 END), 0)',
        'unbilledAmount',
      )
      .getRawOne();

    const billedWithCycle = await this.utilityReadingRepository
      .createQueryBuilder('reading')
      .innerJoin('reading.meter', 'meter')
      .where('meter.unitId = :unitId', { unitId })
      .andWhere('reading.isBilled = true')
      .andWhere('reading.rentCycleId IS NOT NULL')
      .getMany();

    let billedUnpaidAmount = 0;
    for (const reading of billedWithCycle) {
      if (!reading.rentCycleId) {
        continue;
      }
      const status = await this.getRentCycleStatus(reading.rentCycleId);
      if (this.isOpenStatus(status)) {
        billedUnpaidAmount += Number(reading.totalAmount);
      }
    }

    const totalUsage = Number(totalsRaw?.totalUsage ?? 0);
    const totalBilledAmount = Number(totalsRaw?.totalBilledAmount ?? 0);
    const unbilledAmount = Number(totalsRaw?.unbilledAmount ?? 0);
    const totalUnpaidAmount = unbilledAmount + billedUnpaidAmount;

    return {
      data: rows.map((r) => this.toWaterReadingDto(r)),
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
      totals: {
        totalUsage,
        totalBilledAmount,
        totalUnpaidAmount,
      },
    };
  }

  private toWaterReadingDto(reading: UtilityReading): WaterReadingResponseDto {
    const d =
      reading.readingDate instanceof Date
        ? reading.readingDate
        : new Date(reading.readingDate as unknown as string);
    const readingDate = d.toISOString().slice(0, 10);

    return {
      id: reading.id,
      meterId: reading.meterId,
      readingDate,
      previousReading: Number(reading.previousReading),
      currentReading: Number(reading.currentReading),
      usage: Number(reading.usage),
      rateUsed: Number(reading.rateUsed),
      totalAmount: Number(reading.totalAmount),
      isBilled: reading.isBilled,
      rentCycleId: reading.rentCycleId,
      createdAt: reading.createdAt,
      updatedAt: reading.updatedAt,
    };
  }

  private async assertUserCanAccessCompany(
    userId: string,
    companyId: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.isSuperAdmin) {
      return;
    }
    const membership = await this.userCompanyRepository.findOne({
      where: { userId, companyId, isActive: true },
    });
    if (!membership) {
      throw new BusinessException(
        ErrorCode.UTILITY_ACCESS_DENIED,
        ERROR_MESSAGES.UTILITY_ACCESS_DENIED,
        HttpStatus.FORBIDDEN,
        { companyId },
      );
    }
  }

  private async getRentCycleStatus(rentCycleId: string): Promise<RentCycleStatus> {
    const rentCycle = await this.rentCycleRepository.findOne({
      where: { id: rentCycleId },
      relations: ['lease'],
    });

    if (!rentCycle) {
      return RentCycleStatus.CANCELLED;
    }
    if (rentCycle.isVoid) {
      return RentCycleStatus.VOID;
    }

    const payments = await this.paymentRepository.find({
      where: {
        rentCycleId,
        isActive: true,
        status: Not(PaymentStatus.REFUNDED),
      },
    });

    const amountPaid = payments
      .filter((p) => p.amount > 0)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalAmountDue = Number(rentCycle.totalAmountDue);
    const balance = totalAmountDue - amountPaid;
    if (balance <= 0) {
      return RentCycleStatus.PAID;
    }
    if (amountPaid > 0) {
      return RentCycleStatus.PARTIAL;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(rentCycle.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const periodStartDate = rentCycle.periodStartDate
      ? new Date(rentCycle.periodStartDate)
      : null;
    if (periodStartDate) {
      periodStartDate.setHours(0, 0, 0, 0);
    }

    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(
      gracePeriodEnd.getDate() + (rentCycle.lease?.gracePeriodDays || 0),
    );

    if (periodStartDate && today < periodStartDate) {
      return RentCycleStatus.PENDING;
    }

    const periodStart = periodStartDate || dueDate;
    if (today >= periodStart && today <= dueDate) {
      return RentCycleStatus.DUE;
    }

    if (today > gracePeriodEnd) {
      return RentCycleStatus.OVERDUE;
    }

    return RentCycleStatus.DUE;
  }

  private isOpenStatus(status: RentCycleStatus): boolean {
    return [RentCycleStatus.DUE, RentCycleStatus.OVERDUE, RentCycleStatus.PARTIAL].includes(status);
  }
}

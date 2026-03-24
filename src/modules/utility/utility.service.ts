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
    @InjectRepository(RentCycleLineItem)
    private readonly rentCycleLineItemRepository: Repository<RentCycleLineItem>,
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async recordWaterReading(
    unitId: string,
    currentReading: number,
  ): Promise<UtilityReading> {
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

    const meter = await this.utilityMeterRepository.findOne({
      where: {
        unitId: unit.id,
        type: UtilityType.WATER,
        isActive: true,
      },
    });

    if (!meter) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'No active WATER meter found for this unit.',
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
        ErrorCode.BAD_REQUEST,
        'Water utility is disabled for this property.',
        HttpStatus.BAD_REQUEST,
        { propertyId: property.id },
      );
    }

    if (unit.utilitiesIncluded === true) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Utilities are included for this unit. Water billing is skipped.',
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
        ErrorCode.BAD_REQUEST,
        'Cannot record reading: lease is inactive for this unit.',
        HttpStatus.BAD_REQUEST,
        { unitId: unit.id },
      );
    }

    if (!activeLease.tenant || !activeLease.tenant.isActive) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Cannot record reading: no active tenant for this unit.',
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
        ErrorCode.BAD_REQUEST,
        'Missing initial reading. Please set unit.lastWaterReading or create an initial reading first.',
        HttpStatus.BAD_REQUEST,
        { unitId: unit.id, meterId: meter.id },
      );
    }

    if (currentReading < previousReading) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Invalid reading. Current reading must be greater than or equal to previous reading.',
        HttpStatus.BAD_REQUEST,
        { currentReading, previousReading },
      );
    }

    if (property.waterRatePerM3 === null || property.waterRatePerM3 === undefined) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Water rate per m3 is not configured for this property.',
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
          ErrorCode.BAD_REQUEST,
          'A reading already exists for this meter on the same date.',
          HttpStatus.BAD_REQUEST,
          { meterId: meter.id, readingDate },
        );
      }
      throw error;
    }

    unit.lastWaterReading = currentReading;
    await this.unitRepository.save(unit);

    return createdReading;
  }

  async attachUtilityToRentCycle(
    rentCycleId: string,
  ): Promise<{ totalUtilityAdded: number; readingsProcessed: number }> {
    const rentCycle = await this.rentCycleRepository.findOne({
      where: { id: rentCycleId },
      relations: ['lease'],
    });

    if (!rentCycle) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Rent cycle not found.',
        HttpStatus.NOT_FOUND,
        { rentCycleId },
      );
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
        ErrorCode.BAD_REQUEST,
        'Cannot attach utility readings: rent cycle is closed.',
        HttpStatus.BAD_REQUEST,
        { rentCycleId: rentCycle.id, status: cycleStatus },
      );
    }
    return this.utilityReadingRepository.manager.transaction(async (manager) => {
      // Lock candidate rows first to prevent concurrent double-billing.
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
  ): Promise<{
    data: UtilityReading[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    totals: {
      totalUsage: number;
      totalBilledAmount: number;
      totalUnpaidAmount: number;
    };
  }> {
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

    const [data, total] = await readingsQb.skip(skip).take(safeLimit).getManyAndCount();

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
      data,
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

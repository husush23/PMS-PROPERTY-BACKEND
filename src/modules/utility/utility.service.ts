import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, QueryFailedError, Repository } from 'typeorm';
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
import { RentCycleCategory } from '../../shared/enums/rent-cycle-category.enum';
import { generateNextInvoiceNumber } from '../rent-cycle/utils/invoice-number.util';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import {
  UnitWaterHistoryResponseDto,
  WaterReadingResponseDto,
} from './dto/utility-response.dto';

/**
 * Line item text uses the reading month. Raw UPDATE … RETURNING rows may expose
 * `readingDate` under different casing or omit it; locked entities are authoritative.
 */
function formatWaterUsageMonthLabel(
  lockedReading: UtilityReading | undefined,
  rawRow: Record<string, unknown>,
  formatter: Intl.DateTimeFormat,
): string {
  const candidates: unknown[] = [
    lockedReading?.readingDate,
    rawRow.readingDate,
    rawRow.readingdate,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    if (c instanceof Date) {
      if (!Number.isNaN(c.getTime())) return formatter.format(c);
      continue;
    }
    if (typeof c === 'string' || typeof c === 'number') {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return formatter.format(d);
    }
  }
  return 'the billing period';
}

@Injectable()
export class UtilityService {
  private readonly logger = new Logger(UtilityService.name);

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
        ErrorCode.INVALID_METER_READING,
        ERROR_MESSAGES.INVALID_METER_READING,
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
    requestId?: string,
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

    // Strict rule: utility line items must never be attached to deposit rent cycles.
    // This must happen before any further DB operations (e.g. access checks / lease reads).
    if (rentCycle.isDeposit || rentCycle.category === RentCycleCategory.DEPOSIT) {
      throw new BusinessException(
        ErrorCode.UTILITY_NOT_ALLOWED_ON_DEPOSIT,
        ERROR_MESSAGES.UTILITY_NOT_ALLOWED_ON_DEPOSIT,
        HttpStatus.BAD_REQUEST,
        { rentCycleId: rentCycle.id },
      );
    }

    if (requesterUserId) {
      await this.assertUserCanAccessCompany(
        requesterUserId,
        rentCycle.companyId,
      );
    }

    const lease = await this.leaseRepository.findOne({
      where: { id: rentCycle.leaseId },
      relations: ['unit', 'tenant'],
    });

    if (!lease || !lease.unit) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_FOUND,
        ERROR_MESSAGES.LEASE_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { leaseId: rentCycle.leaseId },
      );
    }

    // Prevent utility billing for inactive leases or inactive/missing tenants.
    if (
      lease.isActive !== true ||
      !lease.tenant ||
      lease.tenant.isActive !== true
    ) {
      throw new BusinessException(
        ErrorCode.LEASE_NOT_ACTIVE,
        ERROR_MESSAGES.LEASE_NOT_ACTIVE,
        HttpStatus.BAD_REQUEST,
        {
          leaseId: lease.id,
          tenantId: lease.tenant?.id,
        },
      );
    }

    if (lease.utilitiesIncluded === true || lease.unit.utilitiesIncluded === true) {
      return { totalUtilityAdded: 0, readingsProcessed: 0 };
    }

    const cycleStatus = await this.getRentCycleStatus(rentCycle.id);
    const shouldAttachToPaidCycle = cycleStatus === RentCycleStatus.PAID;
    if (!shouldAttachToPaidCycle && !this.isOpenStatus(cycleStatus)) {
      throw new BusinessException(
        ErrorCode.RENT_CYCLE_CLOSED,
        ERROR_MESSAGES.RENT_CYCLE_CLOSED,
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

      let targetCycleId: string;

      if (shouldAttachToPaidCycle) {
        const utilityCycle = await this.resolveUtilityCycleForPeriod(
          manager,
          rentCycle,
          requestId,
        );

        targetCycleId = utilityCycle.id;
      } else {
        targetCycleId = rentCycle.id;
      }

      const readingIds = lockedReadings.map((r) => r.id);

      // Postgres driver returns [rows, rowCount] for UPDATE (see TypeORM PostgresQueryRunner).
      const updateRaw = (await manager.query(
        `UPDATE "utility_readings"
         SET "isBilled" = true, "rentCycleId" = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = ANY($2::uuid[]) AND "isBilled" = false`,
        [targetCycleId, readingIds],
      )) as [unknown[], number];
      const affectedRows = updateRaw[1] ?? 0;
      if (affectedRows === 0) {
        return { totalUtilityAdded: 0, readingsProcessed: 0 };
      }

      const claimedReadings =
        affectedRows === lockedReadings.length
          ? lockedReadings
          : await manager.find(UtilityReading, {
              where: {
                meterId: lockedReadings[0].meterId,
                isBilled: true,
                rentCycleId: targetCycleId,
              },
              order: { readingDate: 'ASC', createdAt: 'ASC' },
              take: affectedRows,
            });

      const totalUtilityAdded = claimedReadings.reduce(
        (sum, r) => sum + Number(r.totalAmount),
        0,
      );

      const lineItems = claimedReadings.map((reading) =>
        manager.create(RentCycleLineItem, {
          rentCycleId: targetCycleId,
          type: RentCycleLineItemType.UTILITY,
          amount: Number(reading.totalAmount),
          description: `Water usage for ${formatWaterUsageMonthLabel(
            reading,
            {},
            monthYearFormatter,
          )}`,
          isLateFee: false,
          utilityReadingId: reading.id,
        }),
      );

      await manager.save(RentCycleLineItem, lineItems);

      const cycleRow = await manager.findOneBy(RentCycle, { id: targetCycleId });
      if (!cycleRow) {
        throw new BusinessException(
          ErrorCode.RENT_CYCLE_NOT_FOUND,
          ERROR_MESSAGES.RENT_CYCLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          { rentCycleId: targetCycleId },
        );
      }

      await manager.update(RentCycle, { id: targetCycleId }, {
        totalAmountDue: Number(cycleRow.totalAmountDue) + totalUtilityAdded,
      });

      return {
        totalUtilityAdded,
        readingsProcessed: claimedReadings.length,
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
      .filter((p) => Number(p.amountPaid || 0) > 0)
      .reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

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

  private async resolveUtilityCycleForPeriod(
    manager: EntityManager,
    rentCycle: RentCycle,
    requestId?: string,
  ): Promise<RentCycle> {
    const logRequestId = requestId ?? '-';

    const findUtilityCycleByUniqueKey = () =>
      manager.findOne(RentCycle, {
        where: {
          leaseId: rentCycle.leaseId,
          period: rentCycle.period,
          category: RentCycleCategory.UTILITY,
        },
      });

    const normalizeResolvedCycle = async (cycle: RentCycle): Promise<RentCycle> => {
      if (!cycle.isVoid) {
        return cycle;
      }

      this.logger.warn(
        `Reviving voided utility cycle leaseId=${rentCycle.leaseId} period=${rentCycle.period} cycleId=${cycle.id} requestId=${logRequestId}`,
      );
      await manager.update(
        RentCycle,
        { id: cycle.id },
        { isVoid: false, voidReason: '' },
      );

      const revived = await findUtilityCycleByUniqueKey();
      if (revived && !revived.isVoid) {
        return revived;
      }

      // If revival didn't reflect immediately, keep behavior deterministic.
      throw new BusinessException(
        ErrorCode.UTILITY_CYCLE_RESOLUTION_FAILED,
        ERROR_MESSAGES.UTILITY_CYCLE_RESOLUTION_FAILED,
        HttpStatus.CONFLICT,
        {
          leaseId: rentCycle.leaseId,
          period: rentCycle.period,
          category: RentCycleCategory.UTILITY,
          reason: 'VOID_REVIVAL_FAILED',
        },
      );
    };

    const existingCycle = await findUtilityCycleByUniqueKey();
    if (existingCycle) {
      return normalizeResolvedCycle(existingCycle);
    }

    this.logger.log(
      `Starting utility cycle resolve leaseId=${rentCycle.leaseId} period=${rentCycle.period} companyId=${rentCycle.companyId} tenantId=${rentCycle.tenantId} requestId=${logRequestId}`,
    );

    // Lockless get-or-create: insert with ON CONFLICT DO NOTHING on the business key,
    // then re-fetch by the same unique key. This is concurrency-safe and does not
    // poison the transaction.
    const invoiceNumber = await generateNextInvoiceNumber(
      manager.getRepository(RentCycle),
      rentCycle.companyId,
      rentCycle.period,
      RentCycleCategory.UTILITY,
    );

    this.logger.log(
      `Utility cycle insert (lockless) leaseId=${rentCycle.leaseId} period=${rentCycle.period} invoiceNumber=${invoiceNumber} requestId=${logRequestId}`,
    );

    const insertResult = (await manager.query(
      `INSERT INTO "rent_cycles"
       ("leaseId","companyId","tenantId","invoiceNumber","period","dueDate","periodStartDate","periodEndDate","totalAmountDue","isDeposit","isVoid","category")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT ("leaseId","period","category") DO NOTHING
       RETURNING "id"`,
      [
        rentCycle.leaseId,
        rentCycle.companyId,
        rentCycle.tenantId,
        invoiceNumber,
        rentCycle.period,
        new Date(),
        rentCycle.periodStartDate,
        rentCycle.periodEndDate,
        0,
        false,
        false,
        RentCycleCategory.UTILITY,
      ],
    )) as Array<{ id?: string }>;

    const insertedId = insertResult?.[0]?.id;
    this.logger.log(
      `Utility cycle insert result inserted=${insertedId ? 'true' : 'false'} insertedId=${insertedId ?? '-'} leaseId=${rentCycle.leaseId} period=${rentCycle.period} requestId=${logRequestId}`,
    );

    const resolvedAfterInsert = await findUtilityCycleByUniqueKey();
    if (resolvedAfterInsert) {
      const normalized = await normalizeResolvedCycle(resolvedAfterInsert);
      this.logger.log(
        `Utility cycle re-fetch succeeded leaseId=${rentCycle.leaseId} period=${rentCycle.period} cycleId=${normalized.id} requestId=${logRequestId}`,
      );
      return normalized;
    }

    const resolvedCycle = await findUtilityCycleByUniqueKey();
    if (resolvedCycle) {
      const normalized = await normalizeResolvedCycle(resolvedCycle);
      this.logger.log(
        `Utility cycle re-fetch succeeded leaseId=${rentCycle.leaseId} period=${rentCycle.period} cycleId=${normalized.id} requestId=${logRequestId}`,
      );
      return normalized;
    }

    this.logger.error(
      `Utility cycle re-fetch failed leaseId=${rentCycle.leaseId} period=${rentCycle.period} requestId=${logRequestId}`,
    );
    throw new BusinessException(
      ErrorCode.UTILITY_CYCLE_RESOLUTION_FAILED,
      ERROR_MESSAGES.UTILITY_CYCLE_RESOLUTION_FAILED,
      HttpStatus.CONFLICT,
      {
        leaseId: rentCycle.leaseId,
        period: rentCycle.period,
        category: RentCycleCategory.UTILITY,
      },
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError
        ?.code === '23505'
    );
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { User } from '../user/entities/user.entity';
import { TenantProfile } from '../tenant/entities/tenant-profile.entity';
import { AccountingEntry } from '../accounting/entities/accounting-entry.entity';
import { CompanySettingsService } from '../company/company-settings.service';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { PaymentType } from '../../shared/enums/payment-type.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import { AccountingAccount } from '../accounting/enums/accounting-account.enum';
import { AccountingEntryDirection } from '../accounting/enums/accounting-entry-direction.enum';
import { FinancialReportQueryDto } from './dto/financial-query.dto';
import { OccupancyReportQueryDto } from './dto/occupancy-query.dto';
import { TenantsReportQueryDto } from './dto/tenants-query.dto';
import { PropertiesReportQueryDto } from './dto/properties-query.dto';
import {
  FinancialReportResponseDto,
  FinancialReportBreakdownByMonthDto,
  FinancialReportBreakdownByPropertyDto,
  FinancialReportBreakdownByPaymentMethodDto,
} from './dto/financial-report-response.dto';
import {
  OccupancyReportResponseDto,
  OccupancyReportUnitItemDto,
} from './dto/occupancy-report-response.dto';
import {
  TenantsReportResponseDto,
  TenantsReportTenantItemDto,
} from './dto/tenants-report-response.dto';
import {
  PropertiesReportResponseDto,
  PropertiesReportPropertyItemDto,
  PropertiesReportSummaryDto,
} from './dto/properties-report-response.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(RentCycle)
    private readonly rentCycleRepository: Repository<RentCycle>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TenantProfile)
    private readonly tenantProfileRepository: Repository<TenantProfile>,
    @InjectRepository(AccountingEntry)
    private readonly accountingEntryRepository: Repository<AccountingEntry>,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  async getFinancialReport(
    companyId: string,
    query: FinancialReportQueryDto,
  ): Promise<FinancialReportResponseDto> {
    const settings = await this.companySettingsService.getOrCreate(companyId);
    const currency = query.currency ?? settings.defaultCurrency ?? 'KES';

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDate =
      query.startDate ?? startOfMonth.toISOString().slice(0, 10);
    const endDate = query.endDate ?? endOfMonth.toISOString().slice(0, 10);
    const { propertyId } = query;

    const cycleQb = this.rentCycleRepository
      .createQueryBuilder('rc')
      .innerJoin('rc.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .where('rc.companyId = :companyId', { companyId })
      .andWhere('rc.isVoid = :isVoid', { isVoid: false })
      .andWhere('rc.dueDate >= :startDate', { startDate })
      .andWhere('rc.dueDate <= :endDate', { endDate });
    if (propertyId) {
      cycleQb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }
    cycleQb.andWhere('lease.currency = :currency', { currency });

    const cycles = await cycleQb.getMany();
    const cycleIds = cycles.map((c) => c.id);
    const totalInvoiced = cycles.reduce(
      (sum, c) => sum + Number(c.totalAmountDue ?? 0),
      0,
    );

    const excludedStatuses = [PaymentStatus.REFUNDED, PaymentStatus.CANCELLED];

    let totalCollected = 0;
    let lateFeesCollected = 0;
    const byPaymentMethodMap = new Map<string, { total: number; count: number }>();

    const paymentsQb = this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('p.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.isActive = :isActive', { isActive: true })
      .andWhere('p.paymentDate >= :startDate', { startDate })
      .andWhere('p.paymentDate <= :endDate', { endDate })
      .andWhere('p.status NOT IN (:...excluded)', {
        excluded: excludedStatuses,
      });
    if (propertyId) {
      paymentsQb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }
    paymentsQb.andWhere('p.currency = :currency', { currency });
    const payments = await paymentsQb.getMany();

    for (const p of payments) {
      const amt = Number(p.amount ?? 0);
      totalCollected += amt;
      if (p.paymentType === PaymentType.LATE_FEE) {
        lateFeesCollected += amt;
      }
      const methodKey = String(p.paymentMethod ?? 'OTHER');
      const existing = byPaymentMethodMap.get(methodKey) ?? {
        total: 0,
        count: 0,
      };
      existing.total += amt;
      existing.count += 1;
      byPaymentMethodMap.set(methodKey, existing);
    }

    const refundsQb = this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('p.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.isActive = :isActive', { isActive: true })
      .andWhere('p.paymentDate >= :startDate', { startDate })
      .andWhere('p.paymentDate <= :endDate', { endDate })
      .andWhere('p.status = :refunded', { refunded: PaymentStatus.REFUNDED })
      .andWhere('p.currency = :currency', { currency });
    if (propertyId) {
      refundsQb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }
    const refundPayments = await refundsQb.getMany();
    const refunds = refundPayments.reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0,
    );

    const paymentsForCycles =
      cycleIds.length > 0
        ? await this.paymentRepository
            .createQueryBuilder('p')
            .where('p.rentCycleId IN (:...cycleIds)', { cycleIds })
            .andWhere('p.isActive = :isActive', { isActive: true })
            .andWhere('p.status NOT IN (:...excluded)', {
              excluded: excludedStatuses,
            })
            .getMany()
        : [];
    const paidAgainstCycles = paymentsForCycles.reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0,
    );
    const outstandingBalance = Math.max(0, totalInvoiced - paidAgainstCycles);

    let creditsApplied = 0;
    const creditsQb = this.accountingEntryRepository
      .createQueryBuilder('ae')
      .where('ae.companyId = :companyId', { companyId })
      .andWhere('ae.account = :account', {
        account: AccountingAccount.TENANT_CREDIT_LIABILITY,
      })
      .andWhere('ae.direction = :direction', {
        direction: AccountingEntryDirection.DEBIT,
      })
      .andWhere('ae.entryDate >= :startDate', { startDate })
      .andWhere('ae.entryDate <= :endDate', { endDate });
    const creditEntries = await creditsQb.getMany();
    creditsApplied = creditEntries.reduce(
      (sum, e) => sum + Number(e.amount ?? 0),
      0,
    );

    const netIncome = totalCollected - refunds;

    const byMonthMap = new Map<
      string,
      {
        totalInvoiced: number;
        totalCollected: number;
        outstandingBalance: number;
        lateFeesCollected: number;
        creditsApplied: number;
        refunds: number;
        netIncome: number;
      }
    >();
    for (const c of cycles) {
      const month = c.period ?? c.dueDate?.toString().slice(0, 7) ?? '';
      if (!month) continue;
      const existing = byMonthMap.get(month) ?? {
        totalInvoiced: 0,
        totalCollected: 0,
        outstandingBalance: 0,
        lateFeesCollected: 0,
        creditsApplied: 0,
        refunds: 0,
        netIncome: 0,
      };
      existing.totalInvoiced += Number(c.totalAmountDue ?? 0);
      byMonthMap.set(month, existing);
    }
    const cycleIdSet = new Set(cycleIds);
    for (const p of paymentsForCycles) {
      if (!p.rentCycleId || !cycleIdSet.has(p.rentCycleId)) continue;
      const cycle = cycles.find((c) => c.id === p.rentCycleId);
      const month = cycle?.period ?? '';
      if (!month) continue;
      const existing = byMonthMap.get(month);
      if (existing) {
        const amt = Number(p.amount ?? 0);
        existing.totalCollected += amt;
        existing.netIncome += amt;
        if (p.paymentType === PaymentType.LATE_FEE) {
          existing.lateFeesCollected += amt;
        }
      }
    }
    for (const e of creditEntries) {
      const month = e.entryDate?.toString().slice(0, 7) ?? '';
      const existing = byMonthMap.get(month);
      if (existing) {
        existing.creditsApplied += Number(e.amount ?? 0);
      }
    }
    const byMonth: FinancialReportBreakdownByMonthDto[] = Array.from(
      byMonthMap.entries(),
    ).map(([month, v]) => ({
      month,
      totalInvoiced: v.totalInvoiced,
      totalCollected: v.totalCollected,
      outstandingBalance: Math.max(0, v.totalInvoiced - v.totalCollected),
      lateFeesCollected: v.lateFeesCollected,
      creditsApplied: v.creditsApplied,
      refunds: v.refunds,
      netIncome: v.netIncome,
    }));

    const byPropertyMap = new Map<
      string,
      { name: string; totalInvoiced: number; totalCollected: number; lateFeesCollected: number; creditsApplied: number; refunds: number }
    >();
    const cycleToProperty = new Map<string, string>();
    for (const c of cycles) {
      const lease = await this.leaseRepository.findOne({
        where: { id: c.leaseId },
        relations: ['unit'],
      });
      const propId = lease?.unit?.propertyId;
      if (propId) {
        cycleToProperty.set(c.id, propId);
        if (!byPropertyMap.has(propId)) {
          const prop = await this.propertyRepository.findOne({
            where: { id: propId },
          });
          byPropertyMap.set(propId, {
            name: prop?.name ?? propId,
            totalInvoiced: 0,
            totalCollected: 0,
            lateFeesCollected: 0,
            creditsApplied: 0,
            refunds: 0,
          });
        }
        const row = byPropertyMap.get(propId)!;
        row.totalInvoiced += Number(c.totalAmountDue ?? 0);
      }
    }
    for (const p of paymentsForCycles) {
      if (!p.rentCycleId) continue;
      const propId = cycleToProperty.get(p.rentCycleId);
      if (propId && byPropertyMap.has(propId)) {
        const row = byPropertyMap.get(propId)!;
        const amt = Number(p.amount ?? 0);
        row.totalCollected += amt;
        if (p.paymentType === PaymentType.LATE_FEE) {
          row.lateFeesCollected += amt;
        }
      }
    }
    const byProperty: FinancialReportBreakdownByPropertyDto[] = Array.from(
      byPropertyMap.entries(),
    ).map(([propertyId, v]) => ({
      propertyId,
      propertyName: v.name,
      totalInvoiced: v.totalInvoiced,
      totalCollected: v.totalCollected,
      outstandingBalance: Math.max(0, v.totalInvoiced - v.totalCollected),
      lateFeesCollected: v.lateFeesCollected,
      creditsApplied: v.creditsApplied,
      refunds: v.refunds,
      netIncome: v.totalCollected - v.refunds,
    }));

    const byPaymentMethod: FinancialReportBreakdownByPaymentMethodDto[] =
      Array.from(byPaymentMethodMap.entries()).map(([paymentMethod, v]) => ({
        paymentMethod,
        totalCollected: v.total,
        paymentCount: v.count,
      }));

    return {
      totalInvoiced,
      totalCollected,
      outstandingBalance,
      lateFeesCollected,
      creditsApplied,
      refunds,
      netIncome,
      byMonth,
      byProperty,
      byPaymentMethod,
    };
  }

  async getOccupancyReport(
    companyId: string,
    query: OccupancyReportQueryDto,
  ): Promise<OccupancyReportResponseDto> {
    const asOfDate = query.asOfDate ?? new Date().toISOString().slice(0, 10);
    const { propertyId } = query;

    const unitQb = this.unitRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.property', 'property')
      .where('u.companyId = :companyId', { companyId })
      .andWhere('u.isActive = :isActive', { isActive: true });
    if (propertyId) {
      unitQb.andWhere('u.propertyId = :propertyId', { propertyId });
    }
    const units = await unitQb.getMany();

    const unitIds = units.map((u) => u.id);
    const activeLeases =
      unitIds.length > 0
        ? await this.leaseRepository
            .createQueryBuilder('l')
            .where('l.unitId IN (:...unitIds)', { unitIds })
            .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
            .andWhere('l.startDate <= :asOfDate', { asOfDate })
            .andWhere('l.endDate >= :asOfDate', { asOfDate })
            .getMany()
        : [];

    const unitToLease = new Map<string, Lease>();
    for (const l of activeLeases) {
        unitToLease.set(l.unitId, l);
    }

    const unitItems: OccupancyReportUnitItemDto[] = [];
    let occupiedCount = 0;
    let vacancyDaysSum = 0;
    let vacancyCount = 0;

    for (const u of units) {
      const lease = unitToLease.get(u.id);
      const status: 'occupied' | 'vacant' = lease ? 'occupied' : 'vacant';
      if (lease) occupiedCount++;
      unitItems.push({
        unitId: u.id,
        unitNumber: u.unitNumber ?? '',
        propertyId: u.propertyId,
        propertyName: u.property?.name ?? '',
        status,
        leaseStart: lease?.startDate
          ? new Date(lease.startDate).toISOString().slice(0, 10)
          : null,
        leaseEnd: lease?.endDate
          ? new Date(lease.endDate).toISOString().slice(0, 10)
          : null,
      });

      if (!lease) {
        const lastLease = await this.leaseRepository
          .createQueryBuilder('l')
          .where('l.unitId = :unitId', { unitId: u.id })
          .andWhere('l.endDate < :asOfDate', { asOfDate })
          .orderBy('l.endDate', 'DESC')
          .limit(1)
          .getOne();
        if (lastLease?.endDate) {
          const end = new Date(lastLease.endDate).getTime();
          const asOf = new Date(asOfDate).getTime();
          vacancyDaysSum += Math.floor((asOf - end) / (24 * 60 * 60 * 1000));
          vacancyCount++;
        }
      }
    }

    const totalUnits = units.length;
    const vacantUnits = totalUnits - occupiedCount;
    const occupancyRate =
      totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;
    const averageVacancyDays =
      vacancyCount > 0 ? Math.round(vacancyDaysSum / vacancyCount) : 0;

    return {
      totalUnits,
      occupiedUnits: occupiedCount,
      vacantUnits,
      occupancyRate,
      averageVacancyDays,
      units: unitItems,
    };
  }

  async getTenantsReport(
    companyId: string,
    query: TenantsReportQueryDto,
  ): Promise<TenantsReportResponseDto> {
    const { propertyId, status: statusFilter, balanceStatus } = query;

    const leaseQb = this.leaseRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.unit', 'unit')
      .where('l.companyId = :companyId', { companyId });
    if (propertyId) {
      leaseQb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }
    const leases = await leaseQb.getMany();
    const tenantIds = [...new Set(leases.map((l) => l.tenantId))];
    if (tenantIds.length === 0) {
      return {
        tenantsWithBalance: 0,
        tenantsWithCredit: 0,
        tenants: [],
      };
    }

    const users = await this.userRepository.find({
      where: { id: In(tenantIds) },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const cycles = await this.rentCycleRepository.find({
      where: { companyId, tenantId: In(tenantIds), isVoid: false },
      relations: ['payments'],
    });
    const payments = await this.paymentRepository.find({
      where: {
        companyId,
        tenantId: In(tenantIds),
        isActive: true,
      },
    });
    const tenantPayments = payments.filter(
      (p) => p.status !== PaymentStatus.REFUNDED && p.status !== PaymentStatus.CANCELLED,
    );

    const activeLeaseCountByTenant = new Map<string, number>();
    const creditBalanceByTenant = new Map<string, number>();
    for (const l of leases) {
      if (l.status === LeaseStatus.ACTIVE) {
        activeLeaseCountByTenant.set(
          l.tenantId,
          (activeLeaseCountByTenant.get(l.tenantId) ?? 0) + 1,
        );
      }
      const credit = Number(l.creditBalance ?? 0);
      creditBalanceByTenant.set(
        l.tenantId,
        (creditBalanceByTenant.get(l.tenantId) ?? 0) + credit,
      );
    }

    const cycleByTenant = new Map<string, typeof cycles>();
    for (const c of cycles) {
      const list = cycleByTenant.get(c.tenantId) ?? [];
      list.push(c);
      cycleByTenant.set(c.tenantId, list);
    }
    const paymentByTenant = new Map<string, typeof tenantPayments>();
    for (const p of tenantPayments) {
      const list = paymentByTenant.get(p.tenantId) ?? [];
      list.push(p);
      paymentByTenant.set(p.tenantId, list);
    }

    const tenantItems: TenantsReportTenantItemDto[] = [];
    let tenantsWithBalance = 0;
    let tenantsWithCredit = 0;

    for (const tenantId of tenantIds) {
      const user = userMap.get(tenantId);
      const name = user?.name ?? user?.email ?? tenantId;
      const activeCount = activeLeaseCountByTenant.get(tenantId) ?? 0;
      if (statusFilter === 'active' && activeCount === 0) continue;
      if (statusFilter === 'past' && activeCount > 0) continue;

      const tenantCycles = cycleByTenant.get(tenantId) ?? [];
      const tenantPays = paymentByTenant.get(tenantId) ?? [];
      const totalPaid = tenantPays.reduce(
        (sum, p) => sum + Number(p.amount ?? 0),
        0,
      );
      let outstandingBalance = 0;
      for (const rc of tenantCycles) {
        const paid = (rc.payments ?? [])
          .filter(
            (p: Payment) =>
              p.isActive &&
              p.status !== PaymentStatus.REFUNDED &&
              p.status !== PaymentStatus.CANCELLED,
          )
          .reduce((s: number, p: Payment) => s + Number(p.amount ?? 0), 0);
        outstandingBalance += Math.max(
          0,
          Number(rc.totalAmountDue ?? 0) - paid,
        );
      }
      const creditBalance = creditBalanceByTenant.get(tenantId) ?? 0;

      if (balanceStatus === 'owing' && outstandingBalance <= 0) continue;
      if (balanceStatus === 'credit' && creditBalance <= 0) continue;
      if (balanceStatus === 'settled' && (outstandingBalance > 0 || creditBalance > 0))
        continue;

      const lastPayment = tenantPays.length
        ? tenantPays.reduce((latest, p) =>
            new Date(p.paymentDate) > new Date(latest.paymentDate) ? p : latest,
          )
        : null;
      const lastInvoice = tenantCycles.length
        ? tenantCycles.reduce((latest, rc) =>
            new Date(rc.dueDate) > new Date(latest.dueDate) ? rc : latest,
          )
        : null;

      if (outstandingBalance > 0) tenantsWithBalance++;
      if (creditBalance > 0) tenantsWithCredit++;

      tenantItems.push({
        tenantId,
        name,
        activeLeaseCount: activeCount,
        totalPaid,
        outstandingBalance,
        creditBalance,
        lastPaymentDate: lastPayment
          ? new Date(lastPayment.paymentDate).toISOString().slice(0, 10)
          : null,
        lastInvoiceDate: lastInvoice
          ? new Date(lastInvoice.dueDate).toISOString().slice(0, 10)
          : null,
      });
    }

    return {
      tenantsWithBalance,
      tenantsWithCredit,
      tenants: tenantItems,
    };
  }

  async getPropertiesReport(
    companyId: string,
    query: PropertiesReportQueryDto,
  ): Promise<PropertiesReportResponseDto> {
    const { propertyId } = query;
    const propQb = this.propertyRepository
      .createQueryBuilder('p')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.isActive = :isActive', { isActive: true });
    if (propertyId) {
      propQb.andWhere('p.id = :propertyId', { propertyId });
    }
    const properties = await propQb.getMany();
    if (properties.length === 0) {
      return {
        properties: [],
        summary: {
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          occupancyRate: 0,
          monthlyRentPotential: 0,
          monthlyCollected: 0,
          outstandingBalance: 0,
        },
      };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const propertyItems: PropertiesReportPropertyItemDto[] = [];
    let sumTotalUnits = 0;
    let sumOccupied = 0;
    let sumVacant = 0;
    let sumRentPotential = 0;
    let sumCollected = 0;
    let sumOutstanding = 0;

    for (const prop of properties) {
      const units = await this.unitRepository.find({
        where: { propertyId: prop.id, isActive: true },
      });
      const unitIds = units.map((u) => u.id);
      const activeLeases =
        unitIds.length > 0
          ? await this.leaseRepository.find({
              where: {
                unitId: In(unitIds),
                status: LeaseStatus.ACTIVE,
              },
              relations: ['unit'],
            })
          : [];
      const occupiedUnitIds = new Set(activeLeases.map((l) => l.unitId));
      const occupiedUnits = occupiedUnitIds.size;
      const totalUnits = units.length;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyRate =
        totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      let monthlyRentPotential = 0;
      for (const l of activeLeases) {
        monthlyRentPotential += Number(l.monthlyRent ?? 0);
      }

      const leaseIds = activeLeases.map((l) => l.id);
      const paymentsInMonth =
        leaseIds.length > 0
          ? await this.paymentRepository
              .createQueryBuilder('p')
              .where('p.leaseId IN (:...leaseIds)', { leaseIds })
              .andWhere('p.isActive = :isActive', { isActive: true })
              .andWhere('p.status NOT IN (:...excluded)', {
                excluded: [PaymentStatus.REFUNDED, PaymentStatus.CANCELLED],
              })
              .andWhere('p.paymentDate >= :monthStart', { monthStart })
              .andWhere('p.paymentDate <= :monthEnd', { monthEnd })
              .getMany()
          : [];
      const monthlyCollected = paymentsInMonth.reduce(
        (s, p) => s + Number(p.amount ?? 0),
        0,
      );

      const cyclesForLeases =
        leaseIds.length > 0
          ? await this.rentCycleRepository.find({
              where: { leaseId: In(leaseIds), isVoid: false },
              relations: ['payments'],
            })
          : [];
      let outstandingBalance = 0;
      for (const rc of cyclesForLeases) {
        const paid = (rc.payments ?? [])
          .filter(
            (p: Payment) =>
              p.isActive &&
              p.status !== PaymentStatus.REFUNDED &&
              p.status !== PaymentStatus.CANCELLED,
          )
          .reduce((s: number, p: Payment) => s + Number(p.amount ?? 0), 0);
        outstandingBalance += Math.max(
          0,
          Number(rc.totalAmountDue ?? 0) - paid,
        );
      }

      sumTotalUnits += totalUnits;
      sumOccupied += occupiedUnits;
      sumVacant += vacantUnits;
      sumRentPotential += monthlyRentPotential;
      sumCollected += monthlyCollected;
      sumOutstanding += outstandingBalance;

      propertyItems.push({
        propertyId: prop.id,
        name: prop.name,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate,
        monthlyRentPotential,
        monthlyCollected,
        outstandingBalance,
      });
    }

    const summaryOccupancyRate =
      sumTotalUnits > 0
        ? Math.round((sumOccupied / sumTotalUnits) * 100)
        : 0;

    return {
      properties: propertyItems,
      summary: {
        totalUnits: sumTotalUnits,
        occupiedUnits: sumOccupied,
        vacantUnits: sumVacant,
        occupancyRate: summaryOccupancyRate,
        monthlyRentPotential: sumRentPotential,
        monthlyCollected: sumCollected,
        outstandingBalance: sumOutstanding,
      },
    };
  }
}

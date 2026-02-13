import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Payment } from '../payment/entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { User } from '../user/entities/user.entity';
import { Unit } from '../unit/entities/unit.entity';
import { ReportsService } from '../reports/reports.service';
import { CompanySettingsService } from '../company/company-settings.service';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { LeaseStatus } from '../../shared/enums/lease-status.enum';
import {
  DashboardSummaryResponseDto,
  DashboardRecentActivityItemDto,
} from './dto/dashboard-summary-response.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    private readonly reportsService: ReportsService,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  async getSummary(
    companyId: string,
    query: DashboardQueryDto,
  ): Promise<DashboardSummaryResponseDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentMonthStart = startOfMonth.toISOString().slice(0, 10);
    const currentMonthEnd = endOfMonth.toISOString().slice(0, 10);
    const prevMonthStart = startOfPrevMonth.toISOString().slice(0, 10);
    const prevMonthEnd = endOfPrevMonth.toISOString().slice(0, 10);

    const [
      propertiesReport,
      tenantsReport,
      financialReportCurrent,
      financialReportPrev,
      occupancyReport,
      settings,
      recentActivity,
    ] = await Promise.all([
      this.reportsService.getPropertiesReport(companyId, {}),
      this.reportsService.getTenantsReport(companyId, { status: 'active' }),
      this.reportsService.getFinancialReport(companyId, {
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
      }),
      this.reportsService.getFinancialReport(companyId, {
        startDate: prevMonthStart,
        endDate: prevMonthEnd,
      }),
      this.reportsService.getOccupancyReport(companyId, {}),
      this.companySettingsService.getOrCreate(companyId),
      this.getRecentActivity(companyId, query.recentActivityLimit ?? 10),
    ]);

    const totalProperties = propertiesReport.properties.length;
    const activeTenants = tenantsReport.tenants.length;
    const totalRevenue = financialReportCurrent.totalCollected;
    const outstandingBalance = financialReportCurrent.outstandingBalance;
    const currency = settings.defaultCurrency ?? 'USD';

    let growthRate: number | undefined;
    if (financialReportPrev.totalCollected > 0) {
      growthRate = Number(
        (
          ((totalRevenue - financialReportPrev.totalCollected) /
            financialReportPrev.totalCollected) *
          100
        ).toFixed(1),
      );
    } else if (totalRevenue > 0) {
      growthRate = 100;
    }

    return {
      totalProperties,
      activeTenants,
      totalRevenue,
      growthRate,
      outstandingBalance,
      occupancyRate: occupancyReport.occupancyRate,
      occupiedUnits: occupancyReport.occupiedUnits,
      totalUnits: occupancyReport.totalUnits,
      currency,
      recentActivity,
    };
  }

  private async getRecentActivity(
    companyId: string,
    limit: number,
  ): Promise<DashboardRecentActivityItemDto[]> {
    const takePerSource = Math.ceil(limit * 1.5);

    const [payments, leases] = await Promise.all([
      this.paymentRepository.find({
        where: {
          companyId,
          isActive: true,
          status: Not(In([PaymentStatus.REFUNDED, PaymentStatus.CANCELLED])),
        },
        relations: ['tenant', 'lease', 'lease.unit'],
        order: { paymentDate: 'DESC' },
        take: takePerSource,
      }),
      this.leaseRepository.find({
        where: {
          companyId,
          status: LeaseStatus.ACTIVE,
        },
        relations: ['tenant', 'unit', 'unit.property'],
        order: { startDate: 'DESC' },
        take: takePerSource,
      }),
    ]);

    const activityItems: Array<{
      type: 'payment' | 'lease_started';
      title: string;
      date: string;
      dateSort: Date;
      id?: string;
      metadata?: Record<string, unknown>;
    }> = [];

    for (const p of payments) {
      const tenantName = p.tenant?.name ?? p.tenant?.email ?? 'Tenant';
      const amount = Number(p.amount ?? 0);
      const currency = p.currency ?? 'USD';
      activityItems.push({
        type: 'payment',
        title: `Payment received: ${currency} ${amount.toLocaleString()} from ${tenantName}`,
        date: new Date(p.paymentDate).toISOString().slice(0, 10),
        dateSort: new Date(p.paymentDate),
        id: p.id,
        metadata: {
          amount,
          currency,
          tenantId: p.tenantId,
        },
      });
    }

    for (const l of leases) {
      const tenantName = l.tenant?.name ?? l.tenant?.email ?? 'Tenant';
      const unitNumber = l.unit?.unitNumber ?? 'Unit';
      const propertyName = l.unit?.property?.name;
      const location = propertyName ? `${unitNumber} - ${propertyName}` : unitNumber;
      activityItems.push({
        type: 'lease_started',
        title: `Lease started: ${tenantName} moved into ${location}`,
        date: new Date(l.startDate).toISOString().slice(0, 10),
        dateSort: new Date(l.startDate),
        id: l.id,
        metadata: {
          unitId: l.unitId,
          tenantId: l.tenantId,
        },
      });
    }

    activityItems.sort((a, b) => b.dateSort.getTime() - a.dateSort.getTime());
    return activityItems.slice(0, limit).map(({ type, title, date, id, metadata }) => ({
      type,
      title,
      date,
      id,
      metadata,
    }));
  }
}

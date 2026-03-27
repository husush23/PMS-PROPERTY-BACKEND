import { Repository } from 'typeorm';
import { RentCycle } from '../entities/rent-cycle.entity';
import { RentCycleCategory } from '../../../shared/enums/rent-cycle-category.enum';

/**
 * Structured invoice numbers: INV-{year}-{monthOrPeriod}-{category}-{sequence}
 * Separate sequence per company, period bucket, and category.
 */
export function buildInvoiceNumberPrefix(
  period: string,
  category: RentCycleCategory,
): string {
  if (period.startsWith('DEPOSIT-')) {
    const rest = period.slice('DEPOSIT-'.length);
    const [y, m] = rest.split('-');
    return `INV-${y}-${m}-${category}-`;
  }
  if (period.includes('-Q')) {
    return `INV-${period}-${category}-`;
  }
  if (period.includes('-W')) {
    return `INV-${period}-${category}-`;
  }
  if (/^\d{4}$/.test(period)) {
    return `INV-${period}-00-${category}-`;
  }
  const [year, month] = period.split('-');
  return `INV-${year}-${month}-${category}-`;
}

export async function generateNextInvoiceNumber(
  repo: Repository<RentCycle>,
  companyId: string,
  period: string,
  category: RentCycleCategory,
): Promise<string> {
  const prefix = buildInvoiceNumberPrefix(period, category);
  const existing = await repo
    .createQueryBuilder('cycle')
    .where('cycle.companyId = :companyId', { companyId })
    .andWhere('cycle.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
    .orderBy('cycle.invoiceNumber', 'DESC')
    .getOne();

  let sequence = 1;
  if (existing) {
    const parts = existing.invoiceNumber.split('-');
    const last = parts[parts.length - 1] || '0';
    const lastSeq = parseInt(last, 10);
    sequence = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
  }

  return `${prefix}${sequence.toString().padStart(3, '0')}`;
}

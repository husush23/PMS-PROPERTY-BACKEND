import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import {
  calculateNextDueDate,
  getPeriodsSinceStart,
} from './rent-due-date.util';

/** Minimal lease fields for billing schedule / proration (avoids entity import cycles). */
export type BillingScheduleLeaseLike = {
  billingStartDate?: Date | null;
  startDate: Date;
  billingAnchorDay?: number;
  paymentFrequency?: PaymentFrequency;
  proratedFirstMonth?: boolean;
};

export const toUtcDateOnly = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const daysInUtcMonthForDate = (date: Date): number => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
};

/** Last calendar day of the UTC month containing `date`. */
export const endOfUtcCalendarMonth = (date: Date): Date => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const last = daysInUtcMonthForDate(date);
  return new Date(Date.UTC(y, m, last));
};

export const utcCalendarDay = (date: Date): number => date.getUTCDate();

/**
 * First day of the UTC calendar month that is `monthOffset` months after the UTC month of `start`
 * (offset 0 = first day of the same month as `start`).
 */
export const startOfUtcCalendarMonthWithOffset = (
  start: Date,
  monthOffset: number,
): Date => {
  const d = toUtcDateOnly(start);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + monthOffset, 1));
};

/**
 * For `YYYY-MM` period keys, 0-based schedule index aligned to the lease billing month's calendar month.
 * Used to map stored invoice periods to scheduled due dates under mid-month proration policy.
 */
export const utcMonthScheduleIndexFromPeriodKey = (
  billingStartDate: Date,
  periodKey: string,
): number | null => {
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const py = Number(match[1]);
  const pm = Number(match[2]);
  const start = toUtcDateOnly(billingStartDate);
  const sy = start.getUTCFullYear();
  const sm = start.getUTCMonth() + 1;
  return (py - sy) * 12 + (pm - sm);
};

export const getLeaseBillingStart = (lease: BillingScheduleLeaseLike): Date =>
  lease.billingStartDate ? new Date(lease.billingStartDate) : new Date(lease.startDate);

/**
 * Monthly mid-month first-cycle proration: prorated flag on, billing day !== 1.
 */
export const isMidMonthProratedFirstCycle = (lease: BillingScheduleLeaseLike): boolean => {
  const frequency = lease.paymentFrequency ?? PaymentFrequency.MONTHLY;
  if (frequency !== PaymentFrequency.MONTHLY || !lease.proratedFirstMonth) {
    return false;
  }
  const billingStart = toUtcDateOnly(getLeaseBillingStart(lease));
  return utcCalendarDay(billingStart) !== 1;
};

/**
 * Days charged for first-month proration (UTC). Move-in on 1st => full month length.
 */
export const proratedDayCountForFirstMonth = (billingStart: Date): number => {
  const d = toUtcDateOnly(billingStart);
  const dim = daysInUtcMonthForDate(d);
  const day = utcCalendarDay(d);
  if (day === 1) return dim;
  return dim - day + 1;
};

export const calculateProratedMonthlyRentAmount = (
  monthlyRent: number,
  billingStart: Date,
): number => {
  const d = toUtcDateOnly(billingStart);
  const dim = daysInUtcMonthForDate(d);
  const day = utcCalendarDay(d);
  if (day === 1) {
    return Math.round(Number(monthlyRent) * 100) / 100;
  }
  const daysToCharge = dim - day + 1;
  const amount = (Number(monthlyRent) / dim) * daysToCharge;
  return Math.round(amount * 100) / 100;
};

export type ScheduledMonthlyDueParams = {
  billingStartDate: Date;
  billingAnchorDay: number;
  scheduleIndex: number;
  proratedMidMonth: boolean;
};

/**
 * Due date for the n-th scheduled rent (0-based).
 *
 * **Mid-month proration policy** (`proratedMidMonth`): immediate first payment on billing start;
 * thereafter full rent due on the 1st of each calendar month (index 1 = first day of next month, etc.).
 *
 * **Standard monthly**: uses `billingAnchorDay` via `calculateNextDueDate` for all indices.
 */
export const getScheduledMonthlyDueDate = ({
  billingStartDate,
  billingAnchorDay,
  scheduleIndex,
  proratedMidMonth,
}: ScheduledMonthlyDueParams): Date => {
  const start = toUtcDateOnly(billingStartDate);
  const anchor = billingAnchorDay || utcCalendarDay(start);

  if (proratedMidMonth) {
    if (scheduleIndex === 0) {
      return start;
    }
    return startOfUtcCalendarMonthWithOffset(start, scheduleIndex);
  }

  if (scheduleIndex === 0) {
    return calculateNextDueDate({
      billingStartDate: start,
      billingAnchorDay: anchor,
      paymentFrequency: PaymentFrequency.MONTHLY,
      cyclesAhead: 0,
    });
  }

  return calculateNextDueDate({
    billingStartDate: start,
    billingAnchorDay: anchor,
    paymentFrequency: PaymentFrequency.MONTHLY,
    cyclesAhead: scheduleIndex,
  });
};

export type NextScheduledDueParams = {
  billingStartDate: Date;
  billingAnchorDay: number;
  proratedFirstMonth: boolean;
  paymentFrequency: PaymentFrequency;
  asOf: Date;
};

const MAX_SCHEDULE_LOOKAHEAD = 240;

/**
 * Smallest scheduled monthly due date >= asOf (UTC date-only comparison).
 * Non-monthly frequencies fall back to periods-since-start + calculateNextDueDate (single step).
 */
export const getNextScheduledDueOnOrAfter = ({
  billingStartDate,
  billingAnchorDay,
  proratedFirstMonth,
  paymentFrequency,
  asOf,
}: NextScheduledDueParams): Date => {
  const asOfDay = toUtcDateOnly(asOf);
  const start = toUtcDateOnly(billingStartDate);
  const anchor = billingAnchorDay || utcCalendarDay(start);

  if (paymentFrequency !== PaymentFrequency.MONTHLY) {
    const periodsSinceStart = getPeriodsSinceStart(
      start,
      asOfDay,
      paymentFrequency,
    );
    let due = calculateNextDueDate({
      billingStartDate: start,
      billingAnchorDay: anchor,
      paymentFrequency,
      cyclesAhead: periodsSinceStart,
    });
    if (toUtcDateOnly(due).getTime() < asOfDay.getTime()) {
      due = calculateNextDueDate({
        billingStartDate: start,
        billingAnchorDay: anchor,
        paymentFrequency,
        cyclesAhead: periodsSinceStart + 1,
      });
    }
    return due;
  }

  const proratedMidMonth =
    proratedFirstMonth && utcCalendarDay(start) !== 1;

  for (let i = 0; i < MAX_SCHEDULE_LOOKAHEAD; i++) {
    const due = getScheduledMonthlyDueDate({
      billingStartDate: start,
      billingAnchorDay: anchor,
      scheduleIndex: i,
      proratedMidMonth,
    });
    const dueDay = toUtcDateOnly(due);
    if (dueDay.getTime() >= asOfDay.getTime()) {
      return due;
    }
  }

  return getScheduledMonthlyDueDate({
    billingStartDate: start,
    billingAnchorDay: anchor,
    scheduleIndex: MAX_SCHEDULE_LOOKAHEAD - 1,
    proratedMidMonth,
  });
};

/** YYYY-MM for UTC calendar month of date. */
export const periodKeyUtcMonth = (date: Date): string => {
  const d = toUtcDateOnly(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

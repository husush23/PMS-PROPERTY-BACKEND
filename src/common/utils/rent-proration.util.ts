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
 * Due date for the n-th scheduled rent (0-based). When proratedMidMonth, index 0 is EOM of billing-start month; index n>=1 uses calculateNextDueDate(..., n).
 */
export const getScheduledMonthlyDueDate = ({
  billingStartDate,
  billingAnchorDay,
  scheduleIndex,
  proratedMidMonth,
}: ScheduledMonthlyDueParams): Date => {
  const start = toUtcDateOnly(billingStartDate);
  const anchor = billingAnchorDay || utcCalendarDay(start);

  if (scheduleIndex === 0) {
    if (proratedMidMonth) {
      return endOfUtcCalendarMonth(start);
    }
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

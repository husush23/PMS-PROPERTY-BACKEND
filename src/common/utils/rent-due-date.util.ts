import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';

type CalculateNextDueDateOptions = {
  billingStartDate: Date;
  billingAnchorDay: number;
  paymentFrequency: PaymentFrequency;
  cyclesAhead?: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toUtcDate = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const getDaysInMonthUtc = (year: number, month: number): number =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const addDaysUtc = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_IN_MS);

const addMonthsClampedUtc = (
  base: Date,
  monthsToAdd: number,
  anchorDay: number,
): Date => {
  const start = toUtcDate(base);
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const totalMonths = startMonth + monthsToAdd;
  const targetYear = startYear + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const daysInMonth = getDaysInMonthUtc(targetYear, targetMonth);
  const clampedDay = Math.min(Math.max(anchorDay, 1), daysInMonth);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
};

export const getPeriodsSinceStart = (
  billingStartDate: Date,
  currentDate: Date,
  paymentFrequency: PaymentFrequency,
): number => {
  const start = toUtcDate(billingStartDate);
  const current = toUtcDate(currentDate);
  const diffMs = current.getTime() - start.getTime();

  switch (paymentFrequency) {
    case PaymentFrequency.WEEKLY:
      return Math.floor(diffMs / (DAY_IN_MS * 7));
    case PaymentFrequency.BIWEEKLY:
      return Math.floor(diffMs / (DAY_IN_MS * 14));
    case PaymentFrequency.QUARTERLY: {
      const years = current.getUTCFullYear() - start.getUTCFullYear();
      const months = current.getUTCMonth() - start.getUTCMonth();
      return Math.floor((years * 12 + months) / 3);
    }
    case PaymentFrequency.YEARLY:
      return current.getUTCFullYear() - start.getUTCFullYear();
    case PaymentFrequency.MONTHLY:
    default: {
      const years = current.getUTCFullYear() - start.getUTCFullYear();
      const months = current.getUTCMonth() - start.getUTCMonth();
      return years * 12 + months;
    }
  }
};

export const calculateNextDueDate = ({
  billingStartDate,
  billingAnchorDay,
  paymentFrequency,
  cyclesAhead = 1,
}: CalculateNextDueDateOptions): Date => {
  const anchorDay = billingAnchorDay || billingStartDate.getUTCDate();
  const start = toUtcDate(billingStartDate);

  switch (paymentFrequency) {
    case PaymentFrequency.WEEKLY:
      return addDaysUtc(start, cyclesAhead * 7);
    case PaymentFrequency.BIWEEKLY:
      return addDaysUtc(start, cyclesAhead * 14);
    case PaymentFrequency.QUARTERLY:
      return addMonthsClampedUtc(start, cyclesAhead * 3, anchorDay);
    case PaymentFrequency.YEARLY:
      return addMonthsClampedUtc(start, cyclesAhead * 12, anchorDay);
    case PaymentFrequency.MONTHLY:
    default:
      return addMonthsClampedUtc(start, cyclesAhead, anchorDay);
  }
};

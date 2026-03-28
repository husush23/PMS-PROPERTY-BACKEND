import { PaymentFrequency } from '../../shared/enums/payment-frequency.enum';
import {
  calculateProratedMonthlyRentAmount,
  endOfUtcCalendarMonth,
  getNextScheduledDueOnOrAfter,
  getScheduledMonthlyDueDate,
  isMidMonthProratedFirstCycle,
  periodKeyUtcMonth,
  proratedDayCountForFirstMonth,
  toUtcDateOnly,
} from './rent-proration.util';

describe('rent-proration.util', () => {
  describe('endOfUtcCalendarMonth / proratedDayCountForFirstMonth', () => {
    it('March 15 2025 UTC ends Mar 31 with 17 days', () => {
      const start = new Date(Date.UTC(2025, 2, 15));
      const eom = endOfUtcCalendarMonth(start);
      expect(eom.toISOString().slice(0, 10)).toBe('2025-03-31');
      expect(proratedDayCountForFirstMonth(start)).toBe(17);
    });

    it('Feb 15 2024 leap year ends Feb 29 with 15 days', () => {
      const start = new Date(Date.UTC(2024, 1, 15));
      expect(endOfUtcCalendarMonth(start).toISOString().slice(0, 10)).toBe(
        '2024-02-29',
      );
      expect(proratedDayCountForFirstMonth(start)).toBe(15);
    });

    it('Feb 15 2023 non-leap ends Feb 28', () => {
      const start = new Date(Date.UTC(2023, 1, 15));
      expect(endOfUtcCalendarMonth(start).toISOString().slice(0, 10)).toBe(
        '2023-02-28',
      );
      expect(proratedDayCountForFirstMonth(start)).toBe(14);
    });

    it('move-in 1st charges full month days', () => {
      const start = new Date(Date.UTC(2025, 2, 1));
      expect(proratedDayCountForFirstMonth(start)).toBe(31);
    });
  });

  describe('calculateProratedMonthlyRentAmount', () => {
    it('prorates mid-month', () => {
      const start = new Date(Date.UTC(2025, 2, 15));
      const amt = calculateProratedMonthlyRentAmount(3100, start);
      expect(amt).toBeLessThan(3100);
      expect(amt).toBeCloseTo((3100 / 31) * 17, 1);
    });

    it('full month on 1st', () => {
      const start = new Date(Date.UTC(2025, 2, 1));
      expect(calculateProratedMonthlyRentAmount(3100, start)).toBe(3100);
    });
  });

  describe('isMidMonthProratedFirstCycle', () => {
    it('true when monthly, prorated, day !== 1', () => {
      expect(
        isMidMonthProratedFirstCycle({
          startDate: new Date(Date.UTC(2025, 2, 15)),
          proratedFirstMonth: true,
          paymentFrequency: PaymentFrequency.MONTHLY,
        }),
      ).toBe(true);
    });

    it('false on 1st', () => {
      expect(
        isMidMonthProratedFirstCycle({
          startDate: new Date(Date.UTC(2025, 2, 1)),
          proratedFirstMonth: true,
          paymentFrequency: PaymentFrequency.MONTHLY,
        }),
      ).toBe(false);
    });

    it('false when not prorated', () => {
      expect(
        isMidMonthProratedFirstCycle({
          startDate: new Date(Date.UTC(2025, 2, 15)),
          proratedFirstMonth: false,
          paymentFrequency: PaymentFrequency.MONTHLY,
        }),
      ).toBe(false);
    });
  });

  describe('getScheduledMonthlyDueDate', () => {
    const billingStart = new Date(Date.UTC(2025, 2, 15));

    it('index 0 prorated mid-month is Mar 31', () => {
      const due = getScheduledMonthlyDueDate({
        billingStartDate: billingStart,
        billingAnchorDay: 1,
        scheduleIndex: 0,
        proratedMidMonth: true,
      });
      expect(toUtcDateOnly(due).toISOString().slice(0, 10)).toBe('2025-03-31');
    });

    it('index 1 with anchor 1 is Apr 1', () => {
      const due = getScheduledMonthlyDueDate({
        billingStartDate: billingStart,
        billingAnchorDay: 1,
        scheduleIndex: 1,
        proratedMidMonth: true,
      });
      expect(toUtcDateOnly(due).toISOString().slice(0, 10)).toBe('2025-04-01');
    });

    it('index 2 with anchor 1 is May 1', () => {
      const due = getScheduledMonthlyDueDate({
        billingStartDate: billingStart,
        billingAnchorDay: 1,
        scheduleIndex: 2,
        proratedMidMonth: true,
      });
      expect(toUtcDateOnly(due).toISOString().slice(0, 10)).toBe('2025-05-01');
    });
  });

  describe('getNextScheduledDueOnOrAfter', () => {
    it('returns Mar 31 when asOf is Mar 20 mid-month prorated', () => {
      const next = getNextScheduledDueOnOrAfter({
        billingStartDate: new Date(Date.UTC(2025, 2, 15)),
        billingAnchorDay: 1,
        proratedFirstMonth: true,
        paymentFrequency: PaymentFrequency.MONTHLY,
        asOf: new Date(Date.UTC(2025, 2, 20)),
      });
      expect(toUtcDateOnly(next).toISOString().slice(0, 10)).toBe('2025-03-31');
    });

    it('returns Apr 1 when asOf is Apr 1', () => {
      const next = getNextScheduledDueOnOrAfter({
        billingStartDate: new Date(Date.UTC(2025, 2, 15)),
        billingAnchorDay: 1,
        proratedFirstMonth: true,
        paymentFrequency: PaymentFrequency.MONTHLY,
        asOf: new Date(Date.UTC(2025, 3, 1)),
      });
      expect(toUtcDateOnly(next).toISOString().slice(0, 10)).toBe('2025-04-01');
    });
  });

  describe('periodKeyUtcMonth', () => {
    it('formats YYYY-MM in UTC', () => {
      expect(periodKeyUtcMonth(new Date(Date.UTC(2025, 2, 15)))).toBe('2025-03');
    });
  });
});

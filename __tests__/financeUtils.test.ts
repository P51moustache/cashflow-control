import { generateProjection } from '@/utils/financeUtils';
import { Transaction, TransactionType, Frequency } from '@/types';

/**
 * Helper: run a projection starting from a fixed date and return which dates
 * a single transaction fires on.
 */
function getFiringDates(
  transaction: Transaction,
  startDate: Date,
  days: number
): string[] {
  // We need to mock "today" so generateProjection uses our startDate.
  const realDateNow = Date.now;
  const realDate = global.Date;

  // Create a custom Date class that defaults to our startDate
  const MockDate = class extends realDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(startDate.getTime());
      } else {
        // @ts-ignore
        super(...args);
      }
    }

    static now() {
      return startDate.getTime();
    }
  } as DateConstructor;

  global.Date = MockDate;

  try {
    const projection = generateProjection(1000, [transaction], days);
    return projection
      .filter((day) => day.transactions.length > 0)
      .map((day) => day.date);
  } finally {
    global.Date = realDate;
  }
}

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'test-1',
    name: 'Test Transaction',
    amount: 100,
    type: TransactionType.EXPENSE,
    frequency: Frequency.WEEKLY,
    date: '2026-01-05',
    ...overrides,
  };
}

describe('financeUtils - generateProjection', () => {
  describe('Weekly recurrence', () => {
    it('fires on the start date itself (day 0)', () => {
      const t = makeTransaction({
        frequency: Frequency.WEEKLY,
        date: '2026-04-05', // same as "today"
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 1);
      expect(dates).toContain('2026-04-05');
    });

    it('fires on exact 7-day intervals from start date', () => {
      const t = makeTransaction({
        frequency: Frequency.WEEKLY,
        date: '2026-04-05',
      });
      // Project 22 days from Apr 5 to capture three weekly hits
      const dates = getFiringDates(t, new Date(2026, 3, 5), 22);
      expect(dates).toContain('2026-04-05'); // day 0
      expect(dates).toContain('2026-04-12'); // day 7
      expect(dates).toContain('2026-04-19'); // day 14
      expect(dates).toContain('2026-04-26'); // day 21
    });

    it('does NOT fire on off days', () => {
      const t = makeTransaction({
        frequency: Frequency.WEEKLY,
        date: '2026-04-05',
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 14);
      // Should only fire on Apr 5 and Apr 12
      expect(dates).toEqual(['2026-04-05', '2026-04-12']);
    });

    it('does NOT fire before start date', () => {
      const t = makeTransaction({
        frequency: Frequency.WEEKLY,
        date: '2026-04-12', // starts a week from "today"
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 14);
      // Should not fire on Apr 5, only on Apr 12
      expect(dates).not.toContain('2026-04-05');
      expect(dates).toContain('2026-04-12');
    });
  });

  describe('Bi-weekly recurrence', () => {
    it('fires on the start date itself', () => {
      const t = makeTransaction({
        frequency: Frequency.BI_WEEKLY,
        date: '2026-04-05',
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 1);
      expect(dates).toContain('2026-04-05');
    });

    it('fires on exact 14-day intervals', () => {
      const t = makeTransaction({
        frequency: Frequency.BI_WEEKLY,
        date: '2026-04-05',
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 30);
      expect(dates).toContain('2026-04-05'); // day 0
      expect(dates).toContain('2026-04-19'); // day 14
      expect(dates).not.toContain('2026-04-12'); // day 7 - not bi-weekly
    });

    it('does NOT fire on off days (e.g. day 7)', () => {
      const t = makeTransaction({
        frequency: Frequency.BI_WEEKLY,
        date: '2026-04-05',
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 15);
      // Only day 0 and day 14
      expect(dates).toEqual(['2026-04-05', '2026-04-19']);
    });

    it('does NOT fire before start date', () => {
      const t = makeTransaction({
        frequency: Frequency.BI_WEEKLY,
        date: '2026-04-19', // starts 14 days from "today"
      });
      const dates = getFiringDates(t, new Date(2026, 3, 5), 15);
      expect(dates).toEqual(['2026-04-19']);
    });
  });

  describe('Monthly recurrence - short month handling', () => {
    it('day 31 fires on last day of 30-day month (April)', () => {
      const t = makeTransaction({
        frequency: Frequency.MONTHLY,
        date: '2026-01-31',
        dayOfMonth: 31,
      });
      // Start from April 1, project 30 days to cover April (30-day month)
      const dates = getFiringDates(t, new Date(2026, 3, 1), 30);
      expect(dates).toContain('2026-04-30'); // April has 30 days, so day 31 -> 30
    });

    it('day 31 fires on day 31 in a 31-day month (May)', () => {
      const t = makeTransaction({
        frequency: Frequency.MONTHLY,
        date: '2026-01-31',
        dayOfMonth: 31,
      });
      // Start from May 1, project 31 days
      const dates = getFiringDates(t, new Date(2026, 4, 1), 31);
      expect(dates).toContain('2026-05-31');
    });

    it('day 29 fires on Feb 28 in non-leap year (2027)', () => {
      const t = makeTransaction({
        frequency: Frequency.MONTHLY,
        date: '2026-01-29',
        dayOfMonth: 29,
      });
      // Feb 2027 is not a leap year, so Feb has 28 days
      const dates = getFiringDates(t, new Date(2027, 1, 1), 28);
      expect(dates).toContain('2027-02-28');
    });

    it('day 29 fires on Feb 29 in leap year (2028)', () => {
      const t = makeTransaction({
        frequency: Frequency.MONTHLY,
        date: '2026-01-29',
        dayOfMonth: 29,
      });
      // Feb 2028 IS a leap year
      const dates = getFiringDates(t, new Date(2028, 1, 1), 29);
      expect(dates).toContain('2028-02-29');
    });

    it('day 15 fires normally (no short-month issue)', () => {
      const t = makeTransaction({
        frequency: Frequency.MONTHLY,
        date: '2026-01-15',
        dayOfMonth: 15,
      });
      const dates = getFiringDates(t, new Date(2026, 3, 1), 30);
      expect(dates).toContain('2026-04-15');
    });
  });

  describe('Balance calculations', () => {
    it('correctly subtracts expenses from balance', () => {
      const realDate = global.Date;
      const startDate = new Date(2026, 3, 5);
      const MockDate = class extends realDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(startDate.getTime());
          } else {
            // @ts-ignore
            super(...args);
          }
        }
        static now() {
          return startDate.getTime();
        }
      } as DateConstructor;
      global.Date = MockDate;

      try {
        const t = makeTransaction({
          frequency: Frequency.ONE_TIME,
          date: '2026-04-05',
          amount: 250,
          type: TransactionType.EXPENSE,
        });
        const projection = generateProjection(1000, [t], 2);
        expect(projection[0].balance).toBe(750); // 1000 - 250
      } finally {
        global.Date = realDate;
      }
    });

    it('correctly adds income to balance', () => {
      const realDate = global.Date;
      const startDate = new Date(2026, 3, 5);
      const MockDate = class extends realDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(startDate.getTime());
          } else {
            // @ts-ignore
            super(...args);
          }
        }
        static now() {
          return startDate.getTime();
        }
      } as DateConstructor;
      global.Date = MockDate;

      try {
        const t = makeTransaction({
          frequency: Frequency.ONE_TIME,
          date: '2026-04-05',
          amount: 500,
          type: TransactionType.INCOME,
        });
        const projection = generateProjection(1000, [t], 2);
        expect(projection[0].balance).toBe(1500); // 1000 + 500
      } finally {
        global.Date = realDate;
      }
    });
  });
});

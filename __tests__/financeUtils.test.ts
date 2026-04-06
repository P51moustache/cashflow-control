import {
  generateProjection,
  formatCurrency,
  formatShortCurrency,
  getFrequencyLabel,
  generateUUID,
} from '@/utils/financeUtils';
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

/**
 * Helper: run a projection with a mocked "today" date and return the full projection.
 */
function runProjection(
  initialBalance: number,
  transactions: Transaction[],
  startDate: Date,
  days: number
) {
  const realDate = global.Date;

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
    return generateProjection(initialBalance, transactions, days);
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

// ─── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats a positive amount', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats a negative amount with minus sign', () => {
    const result = formatCurrency(-42.5);
    // Intl can use a hyphen-minus or a Unicode minus sign depending on env
    expect(result).toMatch(/^-\$42\.50$/);
  });

  it('formats a large number with commas', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(9.999)).toBe('$10.00');
  });

  it('handles very small positive amount', () => {
    expect(formatCurrency(0.01)).toBe('$0.01');
  });
});

// ─── formatShortCurrency ───────────────────────────────────────────────────────

describe('formatShortCurrency', () => {
  it('returns full format for values under 1000', () => {
    expect(formatShortCurrency(500)).toBe('$500.00');
  });

  it('returns full format for exactly 999', () => {
    expect(formatShortCurrency(999)).toBe('$999.00');
  });

  it('returns compact notation for 1000+', () => {
    const result = formatShortCurrency(1500);
    // Compact notation may produce "$1.5K" or "$2K" depending on rounding
    expect(result).toMatch(/\$\d/);
    expect(result.length).toBeLessThan('$1,500.00'.length);
  });

  it('returns compact notation for large values', () => {
    const result = formatShortCurrency(1000000);
    expect(result).toMatch(/\$\d/);
    // Should be something like "$1M"
    expect(result.length).toBeLessThan('$1,000,000.00'.length);
  });

  it('handles negative values under 1000 with full format', () => {
    const result = formatShortCurrency(-500);
    expect(result).toMatch(/-\$500\.00/);
  });

  it('handles negative values over 1000 with compact notation', () => {
    const result = formatShortCurrency(-5000);
    expect(result).toMatch(/-?\$\d/);
    expect(result.length).toBeLessThan('-$5,000.00'.length);
  });

  it('formats zero the same as formatCurrency', () => {
    expect(formatShortCurrency(0)).toBe(formatCurrency(0));
  });
});

// ─── getFrequencyLabel ─────────────────────────────────────────────────────────

describe('getFrequencyLabel', () => {
  it('returns "One Time" for ONE_TIME', () => {
    expect(getFrequencyLabel(Frequency.ONE_TIME)).toBe('One Time');
  });

  it('returns "Weekly" for WEEKLY', () => {
    expect(getFrequencyLabel(Frequency.WEEKLY)).toBe('Weekly');
  });

  it('returns "Bi-Weekly" for BI_WEEKLY', () => {
    expect(getFrequencyLabel(Frequency.BI_WEEKLY)).toBe('Bi-Weekly');
  });

  it('returns "Monthly" for MONTHLY', () => {
    expect(getFrequencyLabel(Frequency.MONTHLY)).toBe('Monthly');
  });
});

// ─── generateUUID ──────────────────────────────────────────────────────────────

describe('generateUUID', () => {
  it('returns a string matching UUID v4 format', () => {
    const uuid = generateUUID();
    // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx where y is [89ab]
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('always has "4" as version digit', () => {
    for (let i = 0; i < 20; i++) {
      const uuid = generateUUID();
      expect(uuid[14]).toBe('4');
    }
  });

  it('generates unique values across multiple calls', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });

  it('has correct length (36 characters including hyphens)', () => {
    expect(generateUUID().length).toBe(36);
  });
});

// ─── generateProjection ────────────────────────────────────────────────────────

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
      const t = makeTransaction({
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 250,
        type: TransactionType.EXPENSE,
      });
      const projection = runProjection(1000, [t], new Date(2026, 3, 5), 2);
      expect(projection[0].balance).toBe(750); // 1000 - 250
    });

    it('correctly adds income to balance', () => {
      const t = makeTransaction({
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 500,
        type: TransactionType.INCOME,
      });
      const projection = runProjection(1000, [t], new Date(2026, 3, 5), 2);
      expect(projection[0].balance).toBe(1500); // 1000 + 500
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('empty transactions -> projection with just initial balance', () => {
      const projection = runProjection(500, [], new Date(2026, 3, 5), 5);
      expect(projection).toHaveLength(5);
      projection.forEach((day) => {
        expect(day.balance).toBe(500);
        expect(day.transactions).toHaveLength(0);
      });
    });

    it('negative initial balance -> still projects correctly', () => {
      const t = makeTransaction({
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 100,
        type: TransactionType.EXPENSE,
      });
      const projection = runProjection(-200, [t], new Date(2026, 3, 5), 3);
      expect(projection[0].balance).toBe(-300); // -200 - 100
      expect(projection[1].balance).toBe(-300); // unchanged on day 2
    });

    it('multiple transactions on the same day', () => {
      const t1 = makeTransaction({
        id: 'a',
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 100,
        type: TransactionType.EXPENSE,
      });
      const t2 = makeTransaction({
        id: 'b',
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 200,
        type: TransactionType.EXPENSE,
      });
      const projection = runProjection(1000, [t1, t2], new Date(2026, 3, 5), 2);
      expect(projection[0].transactions).toHaveLength(2);
      expect(projection[0].balance).toBe(700); // 1000 - 100 - 200
    });

    it('income and expense on same day offset each other', () => {
      const income = makeTransaction({
        id: 'inc',
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 300,
        type: TransactionType.INCOME,
      });
      const expense = makeTransaction({
        id: 'exp',
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 300,
        type: TransactionType.EXPENSE,
      });
      const projection = runProjection(
        1000,
        [income, expense],
        new Date(2026, 3, 5),
        2
      );
      expect(projection[0].balance).toBe(1000); // +300 - 300 = net zero
      expect(projection[0].transactions).toHaveLength(2);
    });

    it('zero amount transaction does not change balance', () => {
      const t = makeTransaction({
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 0,
        type: TransactionType.EXPENSE,
      });
      const projection = runProjection(1000, [t], new Date(2026, 3, 5), 2);
      expect(projection[0].balance).toBe(1000);
      expect(projection[0].transactions).toHaveLength(1); // still listed as a transaction
    });

    it('marks the lowest point in the projection', () => {
      const expense = makeTransaction({
        id: 'exp',
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 800,
        type: TransactionType.EXPENSE,
      });
      const income = makeTransaction({
        id: 'inc',
        frequency: Frequency.ONE_TIME,
        date: '2026-04-06',
        amount: 500,
        type: TransactionType.INCOME,
      });
      const projection = runProjection(
        1000,
        [expense, income],
        new Date(2026, 3, 5),
        3
      );
      // Day 0: 1000-800 = 200 (lowest)
      // Day 1: 200+500 = 700
      // Day 2: 700
      expect(projection[0].balance).toBe(200);
      expect(projection[0].lowestPoint).toBe(true);
      expect(projection[1].lowestPoint).toBe(false);
    });

    it('projects exactly daysToProject days', () => {
      const projection = runProjection(100, [], new Date(2026, 3, 5), 10);
      expect(projection).toHaveLength(10);
    });

    it('one-time transaction only fires once', () => {
      const t = makeTransaction({
        frequency: Frequency.ONE_TIME,
        date: '2026-04-05',
        amount: 50,
        type: TransactionType.EXPENSE,
      });
      const projection = runProjection(1000, [t], new Date(2026, 3, 5), 5);
      // Balance should drop once on day 0 and stay steady
      expect(projection[0].balance).toBe(950);
      expect(projection[1].balance).toBe(950);
      expect(projection[4].balance).toBe(950);
    });
  });
});

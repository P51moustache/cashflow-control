import {
  generateCardProjection,
  generateDebtProjectionSummary,
  calculateMonthlyInterest,
  calculatePayoffMonths,
  calculateSpendingAllocation,
  calculateExtraPaymentDistribution,
  getCreditCards,
  compareAllStrategies,
  formatPayoffDate,
  getMonthSummary,
} from '@/utils/debtProjectionUtils';
import {
  Transaction,
  TransactionType,
  Frequency,
  DebtType,
  PayoffStrategy,
  DebtSettings,
} from '@/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createCreditCard(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'card-1',
    name: 'Test Card',
    amount: 100,
    type: TransactionType.EXPENSE,
    frequency: Frequency.MONTHLY,
    date: '2024-01-01',
    debtType: DebtType.CREDIT_CARD,
    apr: 24,
    currentBalance: 5000,
    minimumPayment: 100,
    extraPayment: 0,
    ...overrides,
  };
}

const defaultSettings: DebtSettings = {
  totalMonthlyBudget: 0,
  totalMonthlyPaymentBudget: 0,
  payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
};

// ─── calculateMonthlyInterest ──────────────────────────────────────────────────

describe('calculateMonthlyInterest', () => {
  it('calculates monthly interest correctly for normal case', () => {
    // $1000 balance at 24% APR = 2% monthly = $20
    expect(calculateMonthlyInterest(1000, 24)).toBeCloseTo(20, 2);
  });

  it('returns 0 for zero balance', () => {
    expect(calculateMonthlyInterest(0, 24)).toBe(0);
  });

  it('returns 0 for negative balance', () => {
    expect(calculateMonthlyInterest(-100, 24)).toBe(0);
  });

  it('returns 0 for zero APR', () => {
    expect(calculateMonthlyInterest(1000, 0)).toBe(0);
  });

  it('handles high APR correctly', () => {
    // $1000 at 36% APR = 3% monthly = $30
    expect(calculateMonthlyInterest(1000, 36)).toBeCloseTo(30, 2);
  });

  it('handles very small balance', () => {
    // $1 at 24% APR = $0.02/month
    expect(calculateMonthlyInterest(1, 24)).toBeCloseTo(0.02, 2);
  });

  it('handles large balance', () => {
    // $50000 at 18% APR = 1.5% monthly = $750
    expect(calculateMonthlyInterest(50000, 18)).toBeCloseTo(750, 2);
  });
});

// ─── calculateSpendingAllocation ───────────────────────────────────────────────

describe('calculateSpendingAllocation', () => {
  it('returns empty map for no cards', () => {
    const allocation = calculateSpendingAllocation([], 500);
    expect(allocation.size).toBe(0);
  });

  it('returns empty map for zero budget', () => {
    const cards = [createCreditCard({ id: 'a', spendingPercentage: 50 })];
    const allocation = calculateSpendingAllocation(cards, 0);
    // With zero budget, the early return produces an empty map
    expect(allocation.size).toBe(0);
  });

  it('returns empty map for negative budget', () => {
    const cards = [createCreditCard({ id: 'a', spendingPercentage: 50 })];
    const allocation = calculateSpendingAllocation(cards, -100);
    expect(allocation.size).toBe(0);
  });

  it('allocates based on spending percentage', () => {
    const cards = [
      createCreditCard({ id: 'a', spendingPercentage: 60 }),
      createCreditCard({ id: 'b', spendingPercentage: 40 }),
    ];
    const allocation = calculateSpendingAllocation(cards, 1000);
    expect(allocation.get('a')).toBeCloseTo(600, 2);
    expect(allocation.get('b')).toBeCloseTo(400, 2);
  });

  it('cards with 0% spending get no allocation', () => {
    const cards = [
      createCreditCard({ id: 'a', spendingPercentage: 100 }),
      createCreditCard({ id: 'b', spendingPercentage: 0 }),
    ];
    const allocation = calculateSpendingAllocation(cards, 1000);
    expect(allocation.get('a')).toBeCloseTo(1000, 2);
    expect(allocation.get('b')).toBe(0);
  });

  it('cards with undefined spendingPercentage get zero allocation', () => {
    const cards = [
      createCreditCard({ id: 'a', spendingPercentage: undefined }),
    ];
    const allocation = calculateSpendingAllocation(cards, 500);
    expect(allocation.get('a')).toBe(0);
  });
});

// ─── calculateExtraPaymentDistribution ─────────────────────────────────────────

describe('calculateExtraPaymentDistribution', () => {
  it('LOWEST_PAYMENT strategy returns all zeros', () => {
    const cards = [
      createCreditCard({ id: 'a', extraPayment: 50 }),
      createCreditCard({ id: 'b', extraPayment: 30 }),
    ];
    const balances = new Map([['a', 3000], ['b', 2000]]);
    const distribution = calculateExtraPaymentDistribution(
      cards,
      PayoffStrategy.LOWEST_PAYMENT,
      balances
    );
    expect(distribution.get('a')).toBe(0);
    expect(distribution.get('b')).toBe(0);
  });

  it('FASTEST_PAYOFF (avalanche) gives extra to highest APR card', () => {
    const cards = [
      createCreditCard({ id: 'low-apr', apr: 15, extraPayment: 50, minimumPayment: 50 }),
      createCreditCard({ id: 'high-apr', apr: 25, extraPayment: 50, minimumPayment: 50 }),
    ];
    const balances = new Map([['low-apr', 3000], ['high-apr', 2000]]);
    const distribution = calculateExtraPaymentDistribution(
      cards,
      PayoffStrategy.FASTEST_PAYOFF,
      balances
    );
    // high-apr card should get the extra, low-apr should get 0
    expect(distribution.get('high-apr')).toBeGreaterThan(0);
    expect(distribution.get('low-apr')).toBe(0);
  });

  it('SNOWBALL gives extra to lowest balance card', () => {
    const cards = [
      createCreditCard({ id: 'big-balance', apr: 15, currentBalance: 8000, extraPayment: 50, minimumPayment: 50 }),
      createCreditCard({ id: 'small-balance', apr: 25, currentBalance: 1000, extraPayment: 50, minimumPayment: 50 }),
    ];
    const balances = new Map([['big-balance', 8000], ['small-balance', 1000]]);
    const distribution = calculateExtraPaymentDistribution(
      cards,
      PayoffStrategy.SNOWBALL,
      balances
    );
    // small-balance card should get the extra
    expect(distribution.get('small-balance')).toBeGreaterThan(0);
    expect(distribution.get('big-balance')).toBe(0);
  });

  it('no cards with balance returns all zeros', () => {
    const cards = [
      createCreditCard({ id: 'a', extraPayment: 50, minimumPayment: 100 }),
    ];
    const balances = new Map([['a', 0]]);
    const distribution = calculateExtraPaymentDistribution(
      cards,
      PayoffStrategy.FASTEST_PAYOFF,
      balances
    );
    expect(distribution.get('a')).toBe(0);
  });

  it('uses totalPaymentBudget when provided', () => {
    const cards = [
      createCreditCard({ id: 'a', apr: 20, minimumPayment: 100, extraPayment: 0 }),
      createCreditCard({ id: 'b', apr: 15, minimumPayment: 100, extraPayment: 0 }),
    ];
    const balances = new Map([['a', 5000], ['b', 3000]]);
    // Budget of $400 with $200 total minimums = $200 extra
    const distribution = calculateExtraPaymentDistribution(
      cards,
      PayoffStrategy.FASTEST_PAYOFF,
      balances,
      400
    );
    // Card 'a' has higher APR, so it should get $200 extra
    expect(distribution.get('a')).toBe(200);
    expect(distribution.get('b')).toBe(0);
  });

  it('handles empty cards array', () => {
    const distribution = calculateExtraPaymentDistribution(
      [],
      PayoffStrategy.FASTEST_PAYOFF,
      new Map()
    );
    expect(distribution.size).toBe(0);
  });
});

// ─── calculatePayoffMonths ─────────────────────────────────────────────────────

describe('calculatePayoffMonths', () => {
  it('returns 0 for already paid off card (balance 0)', () => {
    expect(calculatePayoffMonths(0, 24, 150, 0)).toBe(0);
  });

  it('returns 0 for negative balance', () => {
    expect(calculatePayoffMonths(-100, 24, 150, 0)).toBe(0);
  });

  it('calculates finite months when payment covers interest + spend', () => {
    // $5000 at 24% APR with $150 payment, no new spending
    // Monthly interest starts at $100, so $150 makes $50/mo progress
    const months = calculatePayoffMonths(5000, 24, 150, 0);
    expect(months).not.toBeNull();
    expect(months).toBeGreaterThan(24);
    expect(months).toBeLessThan(120);
  });

  it('returns null when payment is less than interest (never pays off)', () => {
    // $5000 at 24% APR = $100/mo interest, with only $80 payment
    const months = calculatePayoffMonths(5000, 24, 80, 0);
    expect(months).toBeNull();
  });

  it('returns null when payment exactly equals interest (no progress)', () => {
    // $5000 at 24% APR = $100/mo interest, exactly $100 payment
    const months = calculatePayoffMonths(5000, 24, 100, 0);
    expect(months).toBeNull();
  });

  it('returns null when spending + interest exceed payment', () => {
    // $5000 at 24% APR = $100/mo interest + $50 spend = $150 needed, only $120 paid
    const months = calculatePayoffMonths(5000, 24, 120, 50);
    expect(months).toBeNull();
  });

  it('returns 1 month for very small balance with large payment', () => {
    // $10 balance with $500 payment
    const months = calculatePayoffMonths(10, 24, 500, 0);
    expect(months).toBe(1);
  });

  it('handles 0% APR correctly', () => {
    // $1000 at 0% APR with $100 payment = exactly 10 months
    const months = calculatePayoffMonths(1000, 0, 100, 0);
    expect(months).toBe(10);
  });

  it('accounts for ongoing spending correctly', () => {
    // $1000 at 0% APR, $200 payment, $50 spending
    // Net $150/month progress = ~7 months
    const months = calculatePayoffMonths(1000, 0, 200, 50);
    expect(months).toBe(7); // ceil(1000/150)
  });
});

// ─── getCreditCards ────────────────────────────────────────────────────────────

describe('getCreditCards', () => {
  it('returns only credit cards from mixed transactions', () => {
    const transactions: Transaction[] = [
      createCreditCard({ id: 'cc-1', debtType: DebtType.CREDIT_CARD }),
      {
        id: 'income-1',
        name: 'Salary',
        amount: 5000,
        type: TransactionType.INCOME,
        frequency: Frequency.MONTHLY,
        date: '2024-01-01',
      },
      {
        id: 'rent',
        name: 'Rent',
        amount: 1500,
        type: TransactionType.EXPENSE,
        frequency: Frequency.MONTHLY,
        date: '2024-01-01',
      },
      createCreditCard({ id: 'cc-2', name: 'Card 2' }),
      {
        id: 'loan-1',
        name: 'Car Loan',
        amount: 400,
        type: TransactionType.EXPENSE,
        frequency: Frequency.MONTHLY,
        date: '2024-01-01',
        debtType: DebtType.LOAN,
      },
    ];

    const cards = getCreditCards(transactions);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.id)).toEqual(['cc-1', 'cc-2']);
  });

  it('returns empty array when no credit cards present', () => {
    const transactions: Transaction[] = [
      {
        id: 'income-1',
        name: 'Salary',
        amount: 5000,
        type: TransactionType.INCOME,
        frequency: Frequency.MONTHLY,
        date: '2024-01-01',
      },
    ];
    expect(getCreditCards(transactions)).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(getCreditCards([])).toHaveLength(0);
  });
});

// ─── formatPayoffDate ──────────────────────────────────────────────────────────

describe('formatPayoffDate', () => {
  it('returns "Never" for null', () => {
    expect(formatPayoffDate(null)).toBe('Never');
  });

  it('formats a YYYY-MM string to "Mon YYYY"', () => {
    expect(formatPayoffDate('2027-03')).toBe('Mar 2027');
  });

  it('formats January correctly', () => {
    expect(formatPayoffDate('2026-01')).toBe('Jan 2026');
  });

  it('formats December correctly', () => {
    expect(formatPayoffDate('2028-12')).toBe('Dec 2028');
  });
});

// ─── getMonthSummary ───────────────────────────────────────────────────────────

describe('getMonthSummary', () => {
  it('sums up values across multiple card projections', () => {
    const projections = [
      {
        cardId: 'a',
        cardName: 'A',
        apr: 20,
        currentBalance: 5000,
        payoffDate: null,
        payoffMonths: null,
        totalInterestPaid: 0,
        monthlyInterestCost: 0,
        monthlyProjections: [
          {
            month: '2026-04',
            startingBalance: 5000,
            newCharges: 100,
            interestCharge: 83.33,
            minimumPayment: 150,
            extraPayment: 0,
            totalPayment: 150,
            endingBalance: 5033.33,
          },
        ],
      },
      {
        cardId: 'b',
        cardName: 'B',
        apr: 15,
        currentBalance: 3000,
        payoffDate: null,
        payoffMonths: null,
        totalInterestPaid: 0,
        monthlyInterestCost: 0,
        monthlyProjections: [
          {
            month: '2026-04',
            startingBalance: 3000,
            newCharges: 50,
            interestCharge: 37.5,
            minimumPayment: 100,
            extraPayment: 0,
            totalPayment: 100,
            endingBalance: 2987.5,
          },
        ],
      },
    ];

    const summary = getMonthSummary(projections, 0);
    expect(summary.totalBalance).toBeCloseTo(5033.33 + 2987.5, 2);
    expect(summary.totalPayment).toBeCloseTo(250, 2);
    expect(summary.totalInterest).toBeCloseTo(83.33 + 37.5, 2);
    expect(summary.totalNewCharges).toBeCloseTo(150, 2);
  });

  it('returns zeros for out-of-range month index', () => {
    const projections = [
      {
        cardId: 'a',
        cardName: 'A',
        apr: 20,
        currentBalance: 0,
        payoffDate: null,
        payoffMonths: null,
        totalInterestPaid: 0,
        monthlyInterestCost: 0,
        monthlyProjections: [],
      },
    ];
    const summary = getMonthSummary(projections, 99);
    expect(summary.totalBalance).toBe(0);
    expect(summary.totalPayment).toBe(0);
    expect(summary.totalInterest).toBe(0);
    expect(summary.totalNewCharges).toBe(0);
  });
});

// ─── generateCardProjection (long payoff scenarios) ────────────────────────────

describe('generateCardProjection - long payoff scenarios', () => {
  it('should calculate payoff for cards that take longer than 24 months', () => {
    const card = createCreditCard({
      currentBalance: 5000,
      apr: 24,
      minimumPayment: 150,
      extraPayment: 0,
    });

    const projection = generateCardProjection(
      card,
      0,
      PayoffStrategy.LOWEST_PAYMENT,
      [card],
      defaultSettings
    );

    expect(projection.payoffMonths).not.toBeNull();
    expect(projection.payoffMonths).toBeGreaterThan(24);
  });

  it('should calculate total interest correctly for long payoff periods', () => {
    const card = createCreditCard({
      currentBalance: 5000,
      apr: 24,
      minimumPayment: 200,
      extraPayment: 0,
    });

    const projection = generateCardProjection(
      card,
      0,
      PayoffStrategy.LOWEST_PAYMENT,
      [card],
      defaultSettings
    );

    expect(projection.totalInterestPaid).toBeGreaterThan(1000);
    expect(projection.payoffMonths).not.toBeNull();
  });

  it('should factor in monthly spending when calculating payoff', () => {
    const card = createCreditCard({
      currentBalance: 3000,
      apr: 20,
      minimumPayment: 150,
      extraPayment: 0,
    });

    const projection = generateCardProjection(
      card,
      50,
      PayoffStrategy.LOWEST_PAYMENT,
      [card],
      defaultSettings
    );

    expect(projection.payoffMonths).not.toBeNull();
    expect(projection.payoffMonths).toBeGreaterThan(30);
  });

  it('reports monthlyInterestCost from first month', () => {
    const card = createCreditCard({
      currentBalance: 6000,
      apr: 18,
      minimumPayment: 200,
    });

    const projection = generateCardProjection(
      card,
      0,
      PayoffStrategy.LOWEST_PAYMENT,
      [card],
      defaultSettings
    );

    // 6000 * 18% / 12 = $90
    expect(projection.monthlyInterestCost).toBeCloseTo(90, 0);
  });

  it('handles card with zero balance', () => {
    const card = createCreditCard({
      currentBalance: 0,
      apr: 24,
      minimumPayment: 100,
    });

    const projection = generateCardProjection(
      card,
      0,
      PayoffStrategy.LOWEST_PAYMENT,
      [card],
      defaultSettings
    );

    expect(projection.totalInterestPaid).toBe(0);
    // All months should have 0 ending balance
    projection.monthlyProjections.forEach((m) => {
      expect(m.endingBalance).toBe(0);
    });
  });
});

// ─── generateDebtProjectionSummary ─────────────────────────────────────────────

describe('generateDebtProjectionSummary', () => {
  it('should calculate accurate total interest for multi-year payoffs', () => {
    const cards = [
      createCreditCard({ id: '1', currentBalance: 5000, apr: 24, minimumPayment: 200 }),
      createCreditCard({ id: '2', name: 'Card 2', currentBalance: 3000, apr: 18, minimumPayment: 100 }),
    ];

    const settings: DebtSettings = {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 0,
      payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
    };

    const summary = generateDebtProjectionSummary(cards, settings);

    expect(summary.totalInterestCost).toBeGreaterThan(1500);
    expect(summary.latestPayoffDate).not.toBeNull();
  });

  it('should provide accurate payoff dates beyond 24 months', () => {
    const cards = [createCreditCard({ id: '1', currentBalance: 10000, apr: 22, minimumPayment: 200 })];

    const settings: DebtSettings = {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 0,
      payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
    };

    const summary = generateDebtProjectionSummary(cards, settings);
    expect(summary.latestPayoffDate).not.toBeNull();
  });

  it('returns zeroed summary when no credit cards present', () => {
    const transactions: Transaction[] = [
      {
        id: 'rent',
        name: 'Rent',
        amount: 1500,
        type: TransactionType.EXPENSE,
        frequency: Frequency.MONTHLY,
        date: '2024-01-01',
      },
    ];
    const summary = generateDebtProjectionSummary(transactions, defaultSettings);
    expect(summary.totalCurrentBalance).toBe(0);
    expect(summary.totalMonthlyPayments).toBe(0);
    expect(summary.totalInterestCost).toBe(0);
    expect(summary.projections).toHaveLength(0);
    expect(summary.earliestPayoffDate).toBeNull();
    expect(summary.latestPayoffDate).toBeNull();
  });

  it('computes totalCurrentBalance as sum of all card balances', () => {
    const cards = [
      createCreditCard({ id: '1', currentBalance: 3000, minimumPayment: 200, apr: 20 }),
      createCreditCard({ id: '2', name: 'Card 2', currentBalance: 7000, minimumPayment: 200, apr: 18 }),
    ];
    const summary = generateDebtProjectionSummary(cards, defaultSettings);
    expect(summary.totalCurrentBalance).toBe(10000);
  });
});

// ─── compareAllStrategies ──────────────────────────────────────────────────────

describe('compareAllStrategies', () => {
  it('returns exactly 3 strategies', () => {
    const cards = [
      createCreditCard({ id: '1', currentBalance: 5000, apr: 22, minimumPayment: 150 }),
    ];
    const settings: DebtSettings = {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 300,
      payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
    };

    const comparisons = compareAllStrategies(cards, settings);
    expect(comparisons).toHaveLength(3);
    expect(comparisons.map((c) => c.strategy)).toEqual([
      PayoffStrategy.LOWEST_PAYMENT,
      PayoffStrategy.FASTEST_PAYOFF,
      PayoffStrategy.SNOWBALL,
    ]);
  });

  it('strategies with extra budget have less interest than minimum-only', () => {
    // Single card scenario: adding extra payments via budget should reduce
    // total interest compared to just paying minimums.
    const cards = [
      createCreditCard({ id: '1', currentBalance: 5000, apr: 24, minimumPayment: 150, extraPayment: 0 }),
    ];
    const settings: DebtSettings = {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 300, // $150 extra above the $150 minimum
      payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
    };

    const comparisons = compareAllStrategies(cards, settings);
    const minimum = comparisons.find((c) => c.strategy === PayoffStrategy.LOWEST_PAYMENT)!;
    const avalanche = comparisons.find((c) => c.strategy === PayoffStrategy.FASTEST_PAYOFF)!;

    // Avalanche with $300/mo budget should pay less interest than minimum-only at $150/mo
    // because extra payments accelerate payoff and reduce interest accrual
    expect(avalanche.totalInterest).toBeLessThan(minimum.totalInterest);
    // Avalanche should also pay off faster
    expect(avalanche.payoffMonths).not.toBeNull();
    expect(minimum.payoffMonths).not.toBeNull();
    expect(avalanche.payoffMonths!).toBeLessThan(minimum.payoffMonths!);
  });

  it('all strategies have labels and descriptions', () => {
    const cards = [createCreditCard({ id: '1', currentBalance: 1000, apr: 20, minimumPayment: 100 })];
    const comparisons = compareAllStrategies(cards, defaultSettings);
    comparisons.forEach((c) => {
      expect(c.label).toBeTruthy();
      expect(c.description).toBeTruthy();
    });
  });

  it('each strategy has a monthlyPayment value', () => {
    const cards = [
      createCreditCard({ id: '1', currentBalance: 2000, apr: 20, minimumPayment: 100 }),
    ];
    const settings: DebtSettings = {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 300,
      payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
    };
    const comparisons = compareAllStrategies(cards, settings);
    comparisons.forEach((c) => {
      expect(typeof c.monthlyPayment).toBe('number');
      expect(c.monthlyPayment).toBeGreaterThanOrEqual(0);
    });
  });
});

import {
  generateCardProjection,
  generateDebtProjectionSummary,
  calculateMonthlyInterest,
  calculatePayoffMonths,
} from '@/utils/debtProjectionUtils';
import { Transaction, TransactionType, Frequency, DebtType, PayoffStrategy, DebtSettings } from '@/types';

describe('debtProjectionUtils', () => {
  describe('calculateMonthlyInterest', () => {
    it('should calculate monthly interest correctly', () => {
      // $1000 balance at 24% APR = 2% monthly = $20
      expect(calculateMonthlyInterest(1000, 24)).toBeCloseTo(20, 2);
    });

    it('should return 0 for zero or negative balance', () => {
      expect(calculateMonthlyInterest(0, 24)).toBe(0);
      expect(calculateMonthlyInterest(-100, 24)).toBe(0);
    });
  });

  describe('generateCardProjection - long payoff scenarios', () => {
    const createCreditCard = (overrides: Partial<Transaction> = {}): Transaction => ({
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
    });

    const defaultSettings: DebtSettings = {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 0,
      payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
    };

    it('should calculate payoff for cards that take longer than 24 months', () => {
      // Card with $5000 balance, 24% APR, $150 minimum payment, no new spending
      // At 24% APR, monthly interest is ~$100 initially, so $150 payment makes progress
      // This should take about 50 months to pay off
      const card = createCreditCard({
        currentBalance: 5000,
        apr: 24,
        minimumPayment: 150,
        extraPayment: 0,
      });

      const projection = generateCardProjection(
        card,
        0, // no monthly spending
        PayoffStrategy.LOWEST_PAYMENT,
        [card],
        defaultSettings
      );

      // Should return a valid payoff date (around 50 months)
      expect(projection.payoffMonths).not.toBeNull();
      expect(projection.payoffMonths).toBeGreaterThan(24);
    });

    it('should calculate total interest correctly for long payoff periods', () => {
      // Card with $5000 balance, 24% APR, $200 minimum payment
      // At 24% APR, monthly interest starts at $100, so $200 payment makes $100/month progress
      const card = createCreditCard({
        currentBalance: 5000,
        apr: 24,
        minimumPayment: 200,
        extraPayment: 0,
      });

      const projection = generateCardProjection(
        card,
        0, // no monthly spending
        PayoffStrategy.LOWEST_PAYMENT,
        [card],
        defaultSettings
      );

      // Should include all interest until payoff (about 32 months, ~$1400 total interest)
      expect(projection.totalInterestPaid).toBeGreaterThan(1000);
      expect(projection.payoffMonths).not.toBeNull();
    });

    it('should factor in monthly spending when calculating payoff', () => {
      // Card with $3000 balance, 20% APR, $150 payment, $50/mo new spending
      const card = createCreditCard({
        currentBalance: 3000,
        apr: 20,
        minimumPayment: 150,
        extraPayment: 0,
      });

      const projection = generateCardProjection(
        card,
        50, // $50/month new spending
        PayoffStrategy.LOWEST_PAYMENT,
        [card],
        defaultSettings
      );

      // With monthly spending factored in, payoff should take longer
      // Net payment = $150 - $50 = $100, minus interest
      expect(projection.payoffMonths).not.toBeNull();
      // Should take significantly longer with spending factored in
      expect(projection.payoffMonths).toBeGreaterThan(30);
    });
  });

  describe('generateDebtProjectionSummary', () => {
    const createCreditCard = (id: string, balance: number, apr: number, minPayment: number): Transaction => ({
      id,
      name: `Card ${id}`,
      amount: minPayment,
      type: TransactionType.EXPENSE,
      frequency: Frequency.MONTHLY,
      date: '2024-01-01',
      debtType: DebtType.CREDIT_CARD,
      apr,
      currentBalance: balance,
      minimumPayment: minPayment,
      extraPayment: 0,
    });

    it('should calculate accurate total interest for multi-year payoffs', () => {
      // Use payments that exceed monthly interest to ensure payoff
      // Card 1: $5000 at 24% = $100/mo interest, $200 payment = $100/mo progress
      // Card 2: $3000 at 18% = $45/mo interest, $100 payment = $55/mo progress
      const cards = [
        createCreditCard('1', 5000, 24, 200),
        createCreditCard('2', 3000, 18, 100),
      ];

      const settings: DebtSettings = {
        totalMonthlyBudget: 0,
        totalMonthlyPaymentBudget: 0,
        payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
      };

      const summary = generateDebtProjectionSummary(cards, settings);

      // Total interest should reflect the full payoff period
      // Card 1: ~$1400 interest over ~32 months
      // Card 2: ~$600 interest over ~35 months
      expect(summary.totalInterestCost).toBeGreaterThan(1500);
      expect(summary.latestPayoffDate).not.toBeNull();
    });

    it('should provide accurate payoff dates beyond 24 months', () => {
      const cards = [
        createCreditCard('1', 10000, 22, 200),
      ];

      const settings: DebtSettings = {
        totalMonthlyBudget: 0,
        totalMonthlyPaymentBudget: 0,
        payoffStrategy: PayoffStrategy.LOWEST_PAYMENT,
      };

      const summary = generateDebtProjectionSummary(cards, settings);

      // $10000 at 22% APR with $200 payments should take about 95 months
      expect(summary.latestPayoffDate).not.toBeNull();
    });
  });

  describe('calculatePayoffMonths', () => {
    it('should calculate payoff correctly without artificial limits', () => {
      // $5000 at 24% APR with $150 payment, no new spending
      // Monthly interest starts at $100, so $150 makes progress
      const months = calculatePayoffMonths(5000, 24, 150, 0);

      // Should return a valid number (around 50 months)
      expect(months).not.toBeNull();
      expect(months).toBeGreaterThan(24);
      expect(months).toBeLessThan(120); // Should be less than 10 years
    });

    it('should return null when payments cannot cover interest plus spending', () => {
      // $5000 at 24% APR = $100/mo interest, with only $80 payment
      const months = calculatePayoffMonths(5000, 24, 80, 0);
      expect(months).toBeNull();
    });

    it('should return null when payment exactly equals interest (no progress)', () => {
      // $5000 at 24% APR = $100/mo interest, with exactly $100 payment
      // Balance stays flat forever
      const months = calculatePayoffMonths(5000, 24, 100, 0);
      expect(months).toBeNull();
    });
  });
});

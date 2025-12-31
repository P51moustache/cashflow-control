import { addMonths, format } from 'date-fns';
import {
  Transaction,
  DebtType,
  DebtSettings,
  PayoffStrategy,
  DebtProjection,
  DebtProjectionMonth,
  DebtProjectionSummary,
} from '@/types';

const PROJECTION_MONTHS = 360; // 30 years max for accurate long-term payoff calculations

/**
 * Get all credit card transactions
 */
export function getCreditCards(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.debtType === DebtType.CREDIT_CARD);
}

/**
 * Calculate monthly interest charge
 */
export function calculateMonthlyInterest(balance: number, apr: number): number {
  if (balance <= 0) return 0;
  return balance * (apr / 100 / 12);
}

/**
 * Calculate spending allocation for each card based on percentages
 * Cards with 0% or unset percentage get no new charges
 */
export function calculateSpendingAllocation(
  cards: Transaction[],
  totalBudget: number
): Map<string, number> {
  const allocation = new Map<string, number>();

  if (cards.length === 0 || totalBudget <= 0) {
    return allocation;
  }

  // Only allocate spending to cards with explicit percentages > 0
  // Cards with 0% or unset percentage get no new charges
  cards.forEach(card => {
    const percentage = card.spendingPercentage ?? 0;
    allocation.set(card.id, totalBudget * (percentage / 100));
  });

  return allocation;
}

/**
 * Calculate extra payment distribution based on strategy and payment budget
 * - LOWEST_PAYMENT: No extra payments (just minimums)
 * - FASTEST_PAYOFF: Avalanche method - highest APR gets all extra
 * - SNOWBALL: Lowest balance first (for psychological wins)
 */
export function calculateExtraPaymentDistribution(
  cards: Transaction[],
  strategy: PayoffStrategy,
  currentBalances: Map<string, number>,
  totalPaymentBudget?: number
): Map<string, number> {
  const distribution = new Map<string, number>();

  if (strategy === PayoffStrategy.LOWEST_PAYMENT) {
    // No extra payments in lowest payment mode
    cards.forEach(card => distribution.set(card.id, 0));
    return distribution;
  }

  // Get cards with remaining balances
  const cardsWithBalances = cards
    .filter(card => (currentBalances.get(card.id) ?? card.currentBalance ?? 0) > 0);

  // Sort based on strategy
  if (strategy === PayoffStrategy.FASTEST_PAYOFF) {
    // Avalanche: highest APR first
    cardsWithBalances.sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
  } else if (strategy === PayoffStrategy.SNOWBALL) {
    // Snowball: lowest balance first
    cardsWithBalances.sort((a, b) => {
      const balanceA = currentBalances.get(a.id) ?? a.currentBalance ?? 0;
      const balanceB = currentBalances.get(b.id) ?? b.currentBalance ?? 0;
      return balanceA - balanceB;
    });
  }

  // Initialize all to 0
  cards.forEach(card => distribution.set(card.id, 0));

  // Calculate extra available
  let totalExtraAvailable: number;

  if (totalPaymentBudget !== undefined && totalPaymentBudget > 0) {
    // Use payment budget: budget minus all minimums
    const totalMinimums = cards.reduce(
      (sum, card) => sum + (card.minimumPayment ?? 0),
      0
    );
    totalExtraAvailable = Math.max(0, totalPaymentBudget - totalMinimums);
  } else {
    // Fallback: sum of individual extra payments (legacy behavior)
    totalExtraAvailable = cards.reduce(
      (sum, card) => sum + (card.extraPayment ?? 0),
      0
    );
  }

  // Give all extra to the target card based on strategy
  if (cardsWithBalances.length > 0 && totalExtraAvailable > 0) {
    distribution.set(cardsWithBalances[0].id, totalExtraAvailable);
  }

  return distribution;
}

/**
 * Generate monthly projection for a single credit card
 */
export function generateCardProjection(
  card: Transaction,
  monthlySpend: number,
  strategy: PayoffStrategy,
  allCards: Transaction[],
  settings: DebtSettings
): DebtProjection {
  const monthlyProjections: DebtProjectionMonth[] = [];
  let currentBalance = card.currentBalance ?? 0;
  let totalInterestPaid = 0;
  let payoffDate: string | null = null;
  let payoffMonths: number | null = null;

  const startDate = new Date();
  const minimumPayment = card.minimumPayment ?? 0;
  const baseExtraPayment = card.extraPayment ?? 0;

  // Track balances for all cards (needed for avalanche redistribution)
  const balances = new Map<string, number>();
  allCards.forEach(c => balances.set(c.id, c.currentBalance ?? 0));

  const initialBalance = currentBalance;
  let balanceIncreasing = false;

  for (let month = 0; month < PROJECTION_MONTHS; month++) {
    const monthDate = addMonths(startDate, month);
    const monthStr = format(monthDate, 'yyyy-MM');
    const startingBalance = currentBalance;

    if (currentBalance <= 0) {
      // Card is paid off
      monthlyProjections.push({
        month: monthStr,
        startingBalance: 0,
        newCharges: 0,
        interestCharge: 0,
        minimumPayment: 0,
        extraPayment: 0,
        totalPayment: 0,
        endingBalance: 0,
      });
      continue;
    }

    // Calculate interest
    const interestCharge = calculateMonthlyInterest(currentBalance, card.apr ?? 0);
    totalInterestPaid += interestCharge;

    // Add new charges
    const newCharges = monthlySpend;

    // Calculate balance after interest and charges
    currentBalance += interestCharge + newCharges;

    // Calculate extra payment based on strategy
    let extraPayment = baseExtraPayment;
    if (strategy === PayoffStrategy.FASTEST_PAYOFF || strategy === PayoffStrategy.SNOWBALL) {
      // In avalanche/snowball mode, check if this card should get all extra
      const extraDistribution = calculateExtraPaymentDistribution(
        allCards,
        strategy,
        balances,
        settings.totalMonthlyPaymentBudget
      );
      extraPayment = extraDistribution.get(card.id) ?? 0;
    }

    // Calculate total payment
    const totalPayment = Math.min(minimumPayment + extraPayment, currentBalance);

    // Apply payment
    currentBalance = Math.max(0, currentBalance - totalPayment);

    // Update balances map for next iteration
    balances.set(card.id, currentBalance);

    monthlyProjections.push({
      month: monthStr,
      startingBalance,
      newCharges,
      interestCharge,
      minimumPayment: Math.min(minimumPayment, startingBalance + interestCharge + newCharges),
      extraPayment: Math.min(extraPayment, Math.max(0, startingBalance + interestCharge + newCharges - minimumPayment)),
      totalPayment,
      endingBalance: currentBalance,
    });

    // Check if paid off
    if (currentBalance <= 0 && payoffDate === null) {
      payoffDate = monthStr;
      payoffMonths = month + 1;
    }

    // Check if balance is increasing (will never pay off)
    // Only check after first month to allow for initial fluctuation
    if (month > 0 && currentBalance >= initialBalance) {
      balanceIncreasing = true;
      break; // Exit early - no point calculating 360 months of growing debt
    }
  }

  // Get current month's interest (first month projection)
  const monthlyInterestCost = monthlyProjections.length > 0
    ? monthlyProjections[0].interestCharge
    : 0;

  return {
    cardId: card.id,
    cardName: card.name,
    apr: card.apr ?? 0,
    currentBalance: card.currentBalance ?? 0,
    monthlyProjections,
    payoffDate,
    payoffMonths,
    totalInterestPaid,
    monthlyInterestCost,
  };
}

/**
 * Generate complete debt projection for all credit cards
 */
export function generateDebtProjectionSummary(
  transactions: Transaction[],
  settings: DebtSettings
): DebtProjectionSummary {
  const cards = getCreditCards(transactions);

  if (cards.length === 0) {
    return {
      totalCurrentBalance: 0,
      totalMonthlyPayments: 0,
      totalInterestCost: 0,
      monthlyInterestCost: 0,
      earliestPayoffDate: null,
      latestPayoffDate: null,
      projections: [],
    };
  }

  // Calculate spending allocation
  const spendingAllocation = calculateSpendingAllocation(
    cards,
    settings.totalMonthlyBudget
  );

  // Generate projection for each card
  const projections: DebtProjection[] = cards.map(card => {
    const monthlySpend = spendingAllocation.get(card.id) ?? 0;
    return generateCardProjection(
      card,
      monthlySpend,
      settings.payoffStrategy,
      cards,
      settings
    );
  });

  // Calculate totals
  const totalCurrentBalance = cards.reduce(
    (sum, card) => sum + (card.currentBalance ?? 0),
    0
  );

  // Calculate total monthly payments based on strategy
  const totalMinimums = cards.reduce(
    (sum, card) => sum + (card.minimumPayment ?? 0),
    0
  );

  // If using a payoff strategy with payment budget, use that; otherwise sum individual payments
  let totalMonthlyPayments: number;
  if (
    settings.totalMonthlyPaymentBudget > 0 &&
    settings.payoffStrategy !== PayoffStrategy.LOWEST_PAYMENT
  ) {
    totalMonthlyPayments = settings.totalMonthlyPaymentBudget;
  } else if (settings.payoffStrategy === PayoffStrategy.LOWEST_PAYMENT) {
    totalMonthlyPayments = totalMinimums;
  } else {
    totalMonthlyPayments = cards.reduce(
      (sum, card) => sum + (card.minimumPayment ?? 0) + (card.extraPayment ?? 0),
      0
    );
  }

  const totalInterestCost = projections.reduce(
    (sum, proj) => sum + proj.totalInterestPaid,
    0
  );

  // Find earliest and latest payoff dates
  const payoffDates = projections
    .filter(p => p.payoffDate !== null)
    .map(p => p.payoffDate as string)
    .sort();

  const earliestPayoffDate = payoffDates.length > 0 ? payoffDates[0] : null;
  const latestPayoffDate = payoffDates.length > 0 ? payoffDates[payoffDates.length - 1] : null;

  // Sum monthly interest across all cards
  const monthlyInterestCost = projections.reduce(
    (sum, proj) => sum + proj.monthlyInterestCost,
    0
  );

  return {
    totalCurrentBalance,
    totalMonthlyPayments,
    totalInterestCost,
    monthlyInterestCost,
    earliestPayoffDate,
    latestPayoffDate,
    projections,
  };
}

/**
 * Calculate when a card will be paid off
 * Returns null if balance is increasing (payment < interest + new charges)
 */
export function calculatePayoffMonths(
  balance: number,
  apr: number,
  monthlyPayment: number,
  monthlySpend: number
): number | null {
  if (balance <= 0) return 0;

  const monthlyRate = apr / 100 / 12;
  let currentBalance = balance;
  let months = 0;
  const maxMonths = 360; // 30 years max

  while (currentBalance > 0 && months < maxMonths) {
    const interest = currentBalance * monthlyRate;
    currentBalance += interest + monthlySpend - monthlyPayment;
    months++;

    if (currentBalance >= balance && months > 1) {
      // Balance is increasing
      return null;
    }
  }

  return months < maxMonths ? months : null;
}

/**
 * Generate projection summary for a specific strategy (for comparison)
 */
export function generateProjectionForStrategy(
  transactions: Transaction[],
  settings: DebtSettings,
  strategy: PayoffStrategy
): DebtProjectionSummary {
  return generateDebtProjectionSummary(transactions, {
    ...settings,
    payoffStrategy: strategy,
  });
}

/**
 * Compare all payoff strategies and return summary for each
 */
export interface StrategyComparison {
  strategy: PayoffStrategy;
  label: string;
  description: string;
  totalInterest: number;
  payoffMonths: number | null;
  monthlyPayment: number;
}

export function compareAllStrategies(
  transactions: Transaction[],
  settings: DebtSettings
): StrategyComparison[] {
  const strategies = [
    {
      value: PayoffStrategy.LOWEST_PAYMENT,
      label: 'Minimum Payments',
      description: 'Pay only the minimum on each card',
    },
    {
      value: PayoffStrategy.FASTEST_PAYOFF,
      label: 'Avalanche',
      description: 'Extra payments to highest APR first',
    },
    {
      value: PayoffStrategy.SNOWBALL,
      label: 'Snowball',
      description: 'Extra payments to lowest balance first',
    },
  ];

  return strategies.map(({ value, label, description }) => {
    const projection = generateProjectionForStrategy(transactions, settings, value);

    // Find the latest payoff month
    const payoffMonths = projection.projections.reduce((max, p) => {
      if (p.payoffMonths === null) return null;
      if (max === null) return p.payoffMonths;
      return Math.max(max, p.payoffMonths);
    }, null as number | null);

    return {
      strategy: value,
      label,
      description,
      totalInterest: projection.totalInterestCost,
      payoffMonths,
      monthlyPayment: projection.totalMonthlyPayments,
    };
  });
}

/**
 * Format payoff date for display
 */
export function formatPayoffDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const [year, month] = dateStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Get projection data for a specific month across all cards
 */
export function getMonthSummary(
  projections: DebtProjection[],
  monthIndex: number
): {
  totalBalance: number;
  totalPayment: number;
  totalInterest: number;
  totalNewCharges: number;
} {
  let totalBalance = 0;
  let totalPayment = 0;
  let totalInterest = 0;
  let totalNewCharges = 0;

  projections.forEach(proj => {
    if (monthIndex < proj.monthlyProjections.length) {
      const month = proj.monthlyProjections[monthIndex];
      totalBalance += month.endingBalance;
      totalPayment += month.totalPayment;
      totalInterest += month.interestCharge;
      totalNewCharges += month.newCharges;
    }
  });

  return { totalBalance, totalPayment, totalInterest, totalNewCharges };
}

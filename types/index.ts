export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum Frequency {
  ONE_TIME = 'ONE_TIME',
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum DebtType {
  CREDIT_CARD = 'CREDIT_CARD',
  LOAN = 'LOAN',
}

export enum PayoffStrategy {
  LOWEST_PAYMENT = 'LOWEST_PAYMENT',
  FASTEST_PAYOFF = 'FASTEST_PAYOFF',
  SNOWBALL = 'SNOWBALL',
}

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  date: string; // ISO Date string (YYYY-MM-DD)
  dayOfMonth?: number; // For monthly recurring
  debtType?: DebtType;
  apr?: number;
  currentBalance?: number;
  creditLimit?: number;
  projectedMonthlySpend?: number; // New charges added to card monthly
  loanTermMonths?: number; // Total months for loan
  isFlexible?: boolean;
  minimumPayment?: number; // User-entered minimum payment for credit cards
  extraPayment?: number; // Extra payment above minimum
  spendingPercentage?: number; // Percentage of total CC budget (0-100)
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyBalance {
  date: string;
  balance: number;
  transactions: Transaction[];
  lowestPoint: boolean;
}

export interface UserSettings {
  id: number;
  currentBalance: number;
  updatedAt?: string;
}

export interface DebtSettings {
  totalMonthlyBudget: number; // Monthly spending on cards (new charges)
  totalMonthlyPaymentBudget: number; // Total available to pay toward cards
  payoffStrategy: PayoffStrategy;
}

export interface DebtProjectionMonth {
  month: string; // YYYY-MM format
  startingBalance: number;
  newCharges: number;
  interestCharge: number;
  minimumPayment: number;
  extraPayment: number;
  totalPayment: number;
  endingBalance: number;
}

export interface DebtProjection {
  cardId: string;
  cardName: string;
  apr: number;
  currentBalance: number;
  monthlyProjections: DebtProjectionMonth[];
  payoffDate: string | null; // null if won't pay off in projection period
  payoffMonths: number | null;
  totalInterestPaid: number;
  monthlyInterestCost: number; // Current month's interest charge
}

export interface DebtProjectionSummary {
  totalCurrentBalance: number;
  totalMonthlyPayments: number;
  totalInterestCost: number;
  monthlyInterestCost: number; // Total monthly interest across all cards
  earliestPayoffDate: string | null;
  latestPayoffDate: string | null;
  projections: DebtProjection[];
}

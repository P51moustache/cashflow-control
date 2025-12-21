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

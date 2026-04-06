/**
 * Database tests with mocked expo-sqlite.
 *
 * expo-sqlite is not available in the Jest/Node environment, so we mock the
 * module entirely and verify that the wrapper functions in db/database.ts
 * handle errors gracefully (returning defaults instead of throwing).
 */

import { PayoffStrategy } from '@/types';

// ─── Mock expo-sqlite ──────────────────────────────────────────────────────────

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockExecAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
    execAsync: mockExecAsync,
  }),
}));

// Import AFTER mock is set up
import {
  getAllTransactions,
  getUserSettings,
  getDebtSettings,
} from '@/db/database';

// Reset mocks and the module-level `db` cache between tests
beforeEach(() => {
  jest.clearAllMocks();
  // The database module caches the db handle. We need to ensure execAsync
  // (initDatabase) succeeds so getDatabase() resolves.
  mockExecAsync.mockResolvedValue(undefined);
});

// ─── getAllTransactions ─────────────────────────────────────────────────────────

describe('getAllTransactions', () => {
  it('returns empty array when the database query throws', async () => {
    mockGetAllAsync.mockRejectedValueOnce(new Error('db read failed'));

    const result = await getAllTransactions();
    expect(result).toEqual([]);
  });

  it('returns mapped transactions on success', async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 't1',
        name: 'Rent',
        amount: 1500,
        type: 'EXPENSE',
        frequency: 'MONTHLY',
        date: '2024-01-01',
        day_of_month: 1,
        debt_type: null,
        apr: null,
        current_balance: null,
        credit_limit: null,
        projected_monthly_spend: null,
        loan_term_months: null,
        is_flexible: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]);

    const result = await getAllTransactions();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
    expect(result[0].name).toBe('Rent');
    expect(result[0].amount).toBe(1500);
    expect(result[0].dayOfMonth).toBe(1);
    expect(result[0].isFlexible).toBe(false);
  });
});

// ─── getUserSettings ───────────────────────────────────────────────────────────

describe('getUserSettings', () => {
  it('returns default settings when the database query throws', async () => {
    mockGetFirstAsync.mockRejectedValueOnce(new Error('db error'));

    const result = await getUserSettings();
    expect(result).toEqual({ id: 1, currentBalance: 0 });
  });

  it('returns default settings when row is null', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null);

    const result = await getUserSettings();
    expect(result).toEqual({ id: 1, currentBalance: 0 });
  });

  it('maps row correctly on success', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({
      id: 1,
      current_balance: 4567.89,
      updated_at: '2024-06-15T12:00:00Z',
    });

    const result = await getUserSettings();
    expect(result.currentBalance).toBe(4567.89);
    expect(result.updatedAt).toBe('2024-06-15T12:00:00Z');
  });
});

// ─── getDebtSettings ───────────────────────────────────────────────────────────

describe('getDebtSettings', () => {
  it('returns default settings when the database query throws', async () => {
    mockGetFirstAsync.mockRejectedValueOnce(new Error('db error'));

    const result = await getDebtSettings();
    expect(result).toEqual({
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 0,
      payoffStrategy: PayoffStrategy.SNOWBALL,
    });
  });

  it('returns default settings when row is null', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null);

    const result = await getDebtSettings();
    expect(result).toEqual({
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 0,
      payoffStrategy: PayoffStrategy.SNOWBALL,
    });
  });

  it('maps row correctly on success', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({
      total_monthly_budget: 500,
      total_monthly_payment_budget: 800,
      payoff_strategy: 'FASTEST_PAYOFF',
    });

    const result = await getDebtSettings();
    expect(result.totalMonthlyBudget).toBe(500);
    expect(result.totalMonthlyPaymentBudget).toBe(800);
    expect(result.payoffStrategy).toBe('FASTEST_PAYOFF');
  });
});

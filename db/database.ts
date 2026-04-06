import * as SQLite from 'expo-sqlite';
import { Transaction, TransactionType, Frequency, DebtType, UserSettings, DebtSettings, PayoffStrategy } from '@/types';

const DATABASE_NAME = 'cashflow.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await initDatabase(db);
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      frequency TEXT NOT NULL,
      date TEXT NOT NULL,
      day_of_month INTEGER,
      debt_type TEXT,
      apr REAL,
      current_balance REAL,
      credit_limit REAL,
      projected_monthly_spend REAL,
      loan_term_months INTEGER,
      is_flexible INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_balance REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO user_settings (id, current_balance) VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS debt_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      total_monthly_budget REAL NOT NULL DEFAULT 0,
      total_monthly_payment_budget REAL NOT NULL DEFAULT 0,
      payoff_strategy TEXT NOT NULL DEFAULT 'SNOWBALL',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO debt_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// Transaction CRUD operations
export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      name: string;
      amount: number;
      type: string;
      frequency: string;
      date: string;
      day_of_month: number | null;
      debt_type: string | null;
      apr: number | null;
      current_balance: number | null;
      credit_limit: number | null;
      projected_monthly_spend: number | null;
      loan_term_months: number | null;
      is_flexible: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM transactions ORDER BY date ASC');

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      type: row.type as TransactionType,
      frequency: row.frequency as Frequency,
      date: row.date,
      dayOfMonth: row.day_of_month ?? undefined,
      debtType: row.debt_type as DebtType | undefined,
      apr: row.apr ?? undefined,
      currentBalance: row.current_balance ?? undefined,
      creditLimit: row.credit_limit ?? undefined,
      projectedMonthlySpend: row.projected_monthly_spend ?? undefined,
      loanTermMonths: row.loan_term_months ?? undefined,
      isFlexible: row.is_flexible === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

export async function createTransaction(transaction: Transaction): Promise<void> {
  try {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
      `INSERT INTO transactions (
        id, name, amount, type, frequency, date, day_of_month,
        debt_type, apr, current_balance, credit_limit,
        projected_monthly_spend, loan_term_months, is_flexible,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      transaction.id,
      transaction.name,
      transaction.amount,
      transaction.type,
      transaction.frequency,
      transaction.date,
      transaction.dayOfMonth ?? null,
      transaction.debtType ?? null,
      transaction.apr ?? null,
      transaction.currentBalance ?? null,
      transaction.creditLimit ?? null,
      transaction.projectedMonthlySpend ?? null,
      transaction.loanTermMonths ?? null,
      transaction.isFlexible ? 1 : 0,
      now,
      now
    );
  } catch (error) {
    console.error('Failed to create transaction:', error);
    throw new Error('Unable to save transaction. Please try again.');
  }
}

export async function updateTransaction(transaction: Transaction): Promise<void> {
  try {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
      `UPDATE transactions SET
        name = ?, amount = ?, type = ?, frequency = ?, date = ?,
        day_of_month = ?, debt_type = ?, apr = ?, current_balance = ?,
        credit_limit = ?, projected_monthly_spend = ?, loan_term_months = ?,
        is_flexible = ?, updated_at = ?
      WHERE id = ?`,
      transaction.name,
      transaction.amount,
      transaction.type,
      transaction.frequency,
      transaction.date,
      transaction.dayOfMonth ?? null,
      transaction.debtType ?? null,
      transaction.apr ?? null,
      transaction.currentBalance ?? null,
      transaction.creditLimit ?? null,
      transaction.projectedMonthlySpend ?? null,
      transaction.loanTermMonths ?? null,
      transaction.isFlexible ? 1 : 0,
      now,
      transaction.id
    );
  } catch (error) {
    console.error('Failed to update transaction:', error);
    throw new Error('Unable to update transaction. Please try again.');
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    throw new Error('Unable to delete transaction. Please try again.');
  }
}

// User Settings operations
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{
      id: number;
      current_balance: number;
      updated_at: string;
    }>('SELECT * FROM user_settings WHERE id = 1');

    if (!row) {
      return { id: 1, currentBalance: 0 };
    }

    return {
      id: row.id,
      currentBalance: row.current_balance,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Failed to fetch user settings:', error);
    return { id: 1, currentBalance: 0 };
  }
}

export async function updateBalance(balance: number): Promise<void> {
  try {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
      'UPDATE user_settings SET current_balance = ?, updated_at = ? WHERE id = 1',
      balance,
      now
    );
  } catch (error) {
    console.error('Failed to update balance:', error);
    throw new Error('Unable to update balance. Please try again.');
  }
}

// Debt Settings operations
export async function getDebtSettings(): Promise<DebtSettings> {
  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{
      total_monthly_budget: number;
      total_monthly_payment_budget: number;
      payoff_strategy: string;
    }>('SELECT * FROM debt_settings WHERE id = 1');

    if (!row) {
      return {
        totalMonthlyBudget: 0,
        totalMonthlyPaymentBudget: 0,
        payoffStrategy: PayoffStrategy.SNOWBALL,
      };
    }

    return {
      totalMonthlyBudget: row.total_monthly_budget,
      totalMonthlyPaymentBudget: row.total_monthly_payment_budget,
      payoffStrategy: row.payoff_strategy as PayoffStrategy,
    };
  } catch (error) {
    console.error('Failed to fetch debt settings:', error);
    return {
      totalMonthlyBudget: 0,
      totalMonthlyPaymentBudget: 0,
      payoffStrategy: PayoffStrategy.SNOWBALL,
    };
  }
}

export async function updateDebtSettings(settings: Partial<DebtSettings>): Promise<void> {
  try {
    const database = await getDatabase();
    const current = await getDebtSettings();
    const merged = { ...current, ...settings };
    const now = new Date().toISOString();

    await database.runAsync(
      `UPDATE debt_settings SET
        total_monthly_budget = ?,
        total_monthly_payment_budget = ?,
        payoff_strategy = ?,
        updated_at = ?
      WHERE id = 1`,
      merged.totalMonthlyBudget,
      merged.totalMonthlyPaymentBudget,
      merged.payoffStrategy,
      now
    );
  } catch (error) {
    console.error('Failed to update debt settings:', error);
    throw new Error('Unable to save debt settings. Please try again.');
  }
}

// Sync Queue operations

export interface SyncQueueItem {
  id: number;
  table_name: string;
  record_id: string;
  operation: string;
  payload: string;
  created_at: string;
  synced_at: string | null;
}

export async function addToSyncQueue(
  tableName: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const database = await getDatabase();
    const now = new Date().toISOString();
    await database.runAsync(
      'INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      tableName, recordId, operation, JSON.stringify(payload), now
    );
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
  }
}

export async function getUnsyncedItems(): Promise<SyncQueueItem[]> {
  try {
    const database = await getDatabase();
    return await database.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC'
    );
  } catch (error) {
    console.error('Failed to get unsynced items:', error);
    return [];
  }
}

export async function markSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const database = await getDatabase();
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    await database.runAsync(
      `UPDATE sync_queue SET synced_at = ? WHERE id IN (${placeholders})`,
      now, ...ids
    );
  } catch (error) {
    console.error('Failed to mark items as synced:', error);
  }
}

export async function clearSyncedItems(): Promise<void> {
  try {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM sync_queue WHERE synced_at IS NOT NULL');
  } catch (error) {
    console.error('Failed to clear synced items from queue:', error);
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = 'last_sync_time'"
    );
    return row?.value ?? null;
  } catch (error) {
    console.error('Failed to get last sync time:', error);
    return null;
  }
}

export async function setLastSyncTime(time: string): Promise<void> {
  try {
    const database = await getDatabase();
    await database.runAsync(
      "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_sync_time', ?)",
      time
    );
  } catch (error) {
    console.error('Failed to set last sync time:', error);
  }
}

export async function getSyncQueueCount(): Promise<number> {
  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL'
    );
    return row?.count ?? 0;
  } catch (error) {
    console.error('Failed to get sync queue count:', error);
    return 0;
  }
}

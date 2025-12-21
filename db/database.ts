import * as SQLite from 'expo-sqlite';
import { Transaction, TransactionType, Frequency, DebtType, UserSettings } from '@/types';

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
  `);
}

// Transaction CRUD operations
export async function getAllTransactions(): Promise<Transaction[]> {
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
}

export async function createTransaction(transaction: Transaction): Promise<void> {
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
}

export async function updateTransaction(transaction: Transaction): Promise<void> {
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
}

export async function deleteTransaction(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

// User Settings operations
export async function getUserSettings(): Promise<UserSettings> {
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
}

export async function updateBalance(balance: number): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    'UPDATE user_settings SET current_balance = ?, updated_at = ? WHERE id = 1',
    balance,
    now
  );
}

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Transaction, DailyBalance } from '@/types';
import { generateProjection } from '@/utils/financeUtils';
import {
  getAllTransactions,
  createTransaction,
  updateTransaction as updateTransactionDb,
  deleteTransaction as deleteTransactionDb,
  getUserSettings,
  updateBalance as updateBalanceDb,
} from '@/db/database';

interface FinanceContextType {
  transactions: Transaction[];
  currentBalance: number;
  projection: DailyBalance[];
  lowestBalance: number;
  isLoading: boolean;
  addTransaction: (t: Transaction) => Promise<void>;
  updateTransaction: (t: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  updateBalance: (amount: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [projection, setProjection] = useState<DailyBalance[]>([]);
  const [lowestBalance, setLowestBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [txs, settings] = await Promise.all([
        getAllTransactions(),
        getUserSettings(),
      ]);
      setTransactions(txs);
      setCurrentBalance(settings.currentBalance);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recalculate projection whenever transactions or balance changes
  useEffect(() => {
    const proj = generateProjection(currentBalance, transactions);
    setProjection(proj);

    const min = proj.reduce((min, day) => (day.balance < min ? day.balance : min), Infinity);
    setLowestBalance(min === Infinity ? currentBalance : min);
  }, [transactions, currentBalance]);

  const addTransaction = useCallback(async (t: Transaction) => {
    await createTransaction(t);
    setTransactions((prev) => [...prev, t]);
  }, []);

  const updateTransaction = useCallback(async (t: Transaction) => {
    await updateTransactionDb(t);
    setTransactions((prev) => prev.map((tx) => (tx.id === t.id ? t : tx)));
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await deleteTransactionDb(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateBalance = useCallback(async (amount: number) => {
    await updateBalanceDb(amount);
    setCurrentBalance(amount);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadData();
  }, [loadData]);

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        currentBalance,
        projection,
        lowestBalance,
        isLoading,
        addTransaction,
        updateTransaction,
        removeTransaction,
        updateBalance,
        refresh,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within FinanceProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Toast from 'react-native-toast-message';
import { Transaction, DailyBalance, DebtSettings, DebtProjectionSummary, PayoffStrategy } from '@/types';
import { generateProjection } from '@/utils/financeUtils';
import { generateDebtProjectionSummary } from '@/utils/debtProjectionUtils';
import {
  getAllTransactions,
  createTransaction,
  updateTransaction as updateTransactionDb,
  deleteTransaction as deleteTransactionDb,
  getUserSettings,
  updateBalance as updateBalanceDb,
  getDebtSettings,
  updateDebtSettings as updateDebtSettingsDb,
} from '@/db/database';

interface FinanceContextType {
  transactions: Transaction[];
  currentBalance: number;
  projection: DailyBalance[];
  lowestBalance: number;
  isLoading: boolean;
  debtSettings: DebtSettings;
  debtProjection: DebtProjectionSummary | null;
  addTransaction: (t: Transaction) => Promise<void>;
  updateTransaction: (t: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  updateBalance: (amount: number) => Promise<void>;
  updateDebtSettings: (settings: Partial<DebtSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [projection, setProjection] = useState<DailyBalance[]>([]);
  const [lowestBalance, setLowestBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [debtSettings, setDebtSettings] = useState<DebtSettings>({
    totalMonthlyBudget: 0,
    totalMonthlyPaymentBudget: 0,
    payoffStrategy: PayoffStrategy.SNOWBALL,
  });
  const [debtProjection, setDebtProjection] = useState<DebtProjectionSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [txs, settings, dSettings] = await Promise.all([
        getAllTransactions(),
        getUserSettings(),
        getDebtSettings(),
      ]);
      setTransactions(txs);
      setCurrentBalance(settings.currentBalance);
      setDebtSettings(dSettings);
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

  // Recalculate debt projection when transactions or debt settings change
  useEffect(() => {
    const projection = generateDebtProjectionSummary(transactions, debtSettings);
    setDebtProjection(projection);
  }, [transactions, debtSettings]);

  const addTransaction = useCallback(async (t: Transaction) => {
    try {
      await createTransaction(t);
      setTransactions((prev) => [...prev, t]);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const updateTransaction = useCallback(async (t: Transaction) => {
    try {
      await updateTransactionDb(t);
      setTransactions((prev) => prev.map((tx) => (tx.id === t.id ? t : tx)));
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    try {
      await deleteTransactionDb(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Delete Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const updateBalanceFn = useCallback(async (amount: number) => {
    try {
      await updateBalanceDb(amount);
      setCurrentBalance(amount);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const updateDebtSettingsFn = useCallback(async (settings: Partial<DebtSettings>) => {
    try {
      await updateDebtSettingsDb(settings);
      setDebtSettings((prev) => ({ ...prev, ...settings }));
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
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
        debtSettings,
        debtProjection,
        addTransaction,
        updateTransaction,
        removeTransaction,
        updateBalance: updateBalanceFn,
        updateDebtSettings: updateDebtSettingsFn,
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

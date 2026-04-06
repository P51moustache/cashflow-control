import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
  addToSyncQueue,
} from '@/db/database';
import { syncEngine, SyncStatus, transactionToSyncPayload } from '@/lib/sync';
import { supabase } from '@/lib/supabase';

interface FinanceContextType {
  transactions: Transaction[];
  currentBalance: number;
  projection: DailyBalance[];
  lowestBalance: number;
  isLoading: boolean;
  debtSettings: DebtSettings;
  debtProjection: DebtProjectionSummary | null;
  syncStatus: SyncStatus;
  lastSynced: string;
  addTransaction: (t: Transaction) => Promise<void>;
  updateTransaction: (t: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  updateBalance: (amount: number) => Promise<void>;
  updateDebtSettings: (settings: Partial<DebtSettings>) => Promise<void>;
  refresh: () => Promise<void>;
  triggerSync: () => Promise<void>;
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<string>('Never');
  const syncStatusUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to sync engine status changes
  useEffect(() => {
    syncStatusUnsubRef.current = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });

    // Load initial last-synced time
    syncEngine.getLastSyncTimeFormatted().then(setLastSynced);

    return () => {
      if (syncStatusUnsubRef.current) {
        syncStatusUnsubRef.current();
        syncStatusUnsubRef.current = null;
      }
    };
  }, []);

  // Keep last-synced display up to date when sync status changes
  useEffect(() => {
    if (syncStatus === 'success') {
      syncEngine.getLastSyncTimeFormatted().then(setLastSynced);
    }
  }, [syncStatus]);

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
      // Queue for sync to Supabase
      await addToSyncQueue('transactions', t.id, 'INSERT', transactionToSyncPayload(t));
      Toast.show({ type: 'success', text1: 'Transaction Added', text2: t.name });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const updateTransaction = useCallback(async (t: Transaction) => {
    try {
      await updateTransactionDb(t);
      setTransactions((prev) => prev.map((tx) => (tx.id === t.id ? t : tx)));
      // Queue for sync to Supabase
      await addToSyncQueue('transactions', t.id, 'UPDATE', transactionToSyncPayload(t));
      Toast.show({ type: 'success', text1: 'Transaction Updated' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    try {
      await deleteTransactionDb(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      // Queue for sync to Supabase (soft delete on server side)
      await addToSyncQueue('transactions', id, 'DELETE', {});
      Toast.show({ type: 'success', text1: 'Transaction Deleted' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Delete Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const updateBalanceFn = useCallback(async (amount: number) => {
    try {
      await updateBalanceDb(amount);
      setCurrentBalance(amount);
      // Queue for sync to Supabase
      await addToSyncQueue('user_settings', '1', 'UPDATE', {
        current_balance: amount,
        updated_at: new Date().toISOString(),
      });
      Toast.show({ type: 'success', text1: 'Balance Updated' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, []);

  const updateDebtSettingsFn = useCallback(async (settings: Partial<DebtSettings>) => {
    try {
      await updateDebtSettingsDb(settings);
      const merged = { ...debtSettings, ...settings };
      setDebtSettings(merged);
      // Queue for sync to Supabase
      await addToSyncQueue('debt_settings', '1', 'UPDATE', {
        total_monthly_budget: merged.totalMonthlyBudget,
        total_monthly_payment_budget: merged.totalMonthlyPaymentBudget,
        payoff_strategy: merged.payoffStrategy,
        updated_at: new Date().toISOString(),
      });
      Toast.show({ type: 'success', text1: 'Settings Saved' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
      throw error;
    }
  }, [debtSettings]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadData();
  }, [loadData]);

  const triggerSync = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await syncEngine.performSync(session.user.id);
      }
    } catch (error) {
      console.error('Manual sync trigger failed:', error);
    }
  }, []);

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
        syncStatus,
        lastSynced,
        addTransaction,
        updateTransaction,
        removeTransaction,
        updateBalance: updateBalanceFn,
        updateDebtSettings: updateDebtSettingsFn,
        refresh,
        triggerSync,
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

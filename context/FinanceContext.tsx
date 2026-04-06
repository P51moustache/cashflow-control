import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
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
import { addBreadcrumb } from '@/lib/sentry';
import { track } from '@/lib/analytics';

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
  // projection, lowestBalance, and debtProjection are derived via useMemo below
  const [isLoading, setIsLoading] = useState(true);
  const [debtSettings, setDebtSettings] = useState<DebtSettings>({
    totalMonthlyBudget: 0,
    totalMonthlyPaymentBudget: 0,
    payoffStrategy: PayoffStrategy.SNOWBALL,
  });
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

  // Derive projection synchronously from transactions + balance
  const projection = useMemo(
    () => generateProjection(currentBalance, transactions),
    [currentBalance, transactions]
  );

  const lowestBalance = useMemo(() => {
    const min = projection.reduce(
      (m, day) => (day.balance < m ? day.balance : m),
      Infinity
    );
    return min === Infinity ? currentBalance : min;
  }, [projection, currentBalance]);

  // Derive debt projection synchronously from transactions + settings
  const debtProjection = useMemo(
    () => generateDebtProjectionSummary(transactions, debtSettings),
    [transactions, debtSettings]
  );

  const addTransaction = useCallback(async (t: Transaction) => {
    try {
      await createTransaction(t);
      setTransactions((prev) => [...prev, t]);
      // Queue for sync to Supabase
      await addToSyncQueue('transactions', t.id, 'INSERT', transactionToSyncPayload(t));
      addBreadcrumb('Transaction added', 'finance', { name: t.name, amount: t.amount, type: t.type, frequency: t.frequency });
      track('transaction_added', { type: t.type, frequency: t.frequency });
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
      addBreadcrumb('Transaction updated', 'finance', { id: t.id, name: t.name });
      track('transaction_updated');
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
      addBreadcrumb('Transaction deleted', 'finance', { id });
      track('transaction_deleted');
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
      addBreadcrumb('Balance updated', 'finance', { amount });
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
      addBreadcrumb('Debt settings updated', 'finance', { strategy: merged.payoffStrategy });
      if (settings.payoffStrategy) {
        track('debt_strategy_changed', { strategy: settings.payoffStrategy });
      }
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

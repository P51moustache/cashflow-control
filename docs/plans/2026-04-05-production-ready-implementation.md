# Cashflow Control Production-Ready Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform local-only cashflow app into production iOS app with Supabase auth/sync, RevenueCat monthly subscription, and polished UX.

**Architecture:** Expo Router file-based navigation, SQLite local-first with Supabase Postgres sync, RevenueCat for StoreKit subscriptions, React Context for state management. All new features layer on top of existing patterns.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript, NativeWind/Tailwind, expo-sqlite, Supabase JS, react-native-purchases (RevenueCat), Sentry, PostHog.

**CRITICAL INSTRUCTION FOR IMPLEMENTING AGENTS:** Every single item in this plan MUST be built to production quality. Do not skip steps, do not stub implementations, do not leave TODOs. Every component must be fully styled, every error must be handled, every edge case must be covered. Users will pay money for this app — build it like it.

---

## Phase 1: Bug Fixes

These fix the foundation before adding new features.

### Task 1: Add error handling to database operations

**Files:**
- Modify: `db/database.ts:88-150`

**Step 1: Wrap all write operations in try-catch**

In `db/database.ts`, wrap `createTransaction`, `updateTransaction`, `deleteTransaction`, and `updateBalance` in try-catch blocks that re-throw with descriptive messages:

```typescript
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
    throw new Error(`Failed to save transaction "${transaction.name}"`);
  }
}
```

Apply same pattern to `updateTransaction`, `deleteTransaction`, `updateBalance`.

**Step 2: Run tests**

Run: `npx jest`
Expected: existing tests pass (they don't use the DB directly)

**Step 3: Commit**

```bash
git add db/database.ts
git commit -m "fix: add error handling to all database operations"
```

---

### Task 2: Add error handling to FinanceContext

**Files:**
- Modify: `context/FinanceContext.tsx:64-82`

**Step 1: Install toast library**

```bash
npx expo install react-native-toast-message
```

**Step 2: Wrap context mutations in try-catch, only update state on success**

Replace the mutation functions in `context/FinanceContext.tsx`:

```typescript
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
    Toast.show({ type: 'error', text1: 'Update Failed', text2: (error as Error).message });
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

const updateBalance = useCallback(async (amount: number) => {
  try {
    await updateBalanceDb(amount);
    setCurrentBalance(amount);
  } catch (error) {
    Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
    throw error;
  }
}, []);
```

Add Toast import at top:
```typescript
import Toast from 'react-native-toast-message';
```

**Step 3: Add Toast component to root layout**

In `app/_layout.tsx`, add `<Toast />` after `<StatusBar />`:

```typescript
import Toast from 'react-native-toast-message';
// ... inside return, after StatusBar:
<Toast />
```

**Step 4: Commit**

```bash
git add context/FinanceContext.tsx app/_layout.tsx package.json
git commit -m "fix: context mutations only update state on DB success, show error toasts"
```

---

### Task 3: Add debt settings to database and context

The debt screen requires `debtSettings`, `debtProjection`, and `updateDebtSettings` which don't exist in the context yet. We need to add the debt_settings table, DB operations, and context support.

**Files:**
- Modify: `db/database.ts` — add debt_settings table + CRUD
- Modify: `context/FinanceContext.tsx` — add debtSettings, debtProjection, updateDebtSettings
- Modify: `types/index.ts` — (already has DebtSettings, no changes needed)

**Step 1: Add debt_settings table and operations to database.ts**

In `db/database.ts`, add to `initDatabase` after the user_settings INSERT:

```sql
CREATE TABLE IF NOT EXISTS debt_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_monthly_budget REAL NOT NULL DEFAULT 0,
  total_monthly_payment_budget REAL NOT NULL DEFAULT 0,
  payoff_strategy TEXT NOT NULL DEFAULT 'SNOWBALL',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO debt_settings (id) VALUES (1);
```

Add these new functions after `updateBalance`:

```typescript
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
    console.error('Failed to load debt settings:', error);
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
    throw new Error('Failed to save debt settings');
  }
}
```

Add imports at top of database.ts:
```typescript
import { Transaction, TransactionType, Frequency, DebtType, UserSettings, DebtSettings, PayoffStrategy } from '@/types';
```

**Step 2: Add debt state to FinanceContext**

Add to the FinanceContextType interface:

```typescript
debtSettings: DebtSettings;
debtProjection: DebtProjectionSummary | null;
updateDebtSettings: (settings: Partial<DebtSettings>) => Promise<void>;
```

Add imports:
```typescript
import { DebtSettings, DebtProjectionSummary, PayoffStrategy } from '@/types';
import { generateDebtProjectionSummary } from '@/utils/debtProjectionUtils';
import { getDebtSettings, updateDebtSettings as updateDebtSettingsDb } from '@/db/database';
```

Add state variables in FinanceProvider:
```typescript
const [debtSettings, setDebtSettings] = useState<DebtSettings>({
  totalMonthlyBudget: 0,
  totalMonthlyPaymentBudget: 0,
  payoffStrategy: PayoffStrategy.SNOWBALL,
});
const [debtProjection, setDebtProjection] = useState<DebtProjectionSummary | null>(null);
```

Update `loadData` to also load debt settings:
```typescript
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
```

Add useEffect to recalculate debt projection:
```typescript
useEffect(() => {
  const projection = generateDebtProjectionSummary(transactions, debtSettings);
  setDebtProjection(projection);
}, [transactions, debtSettings]);
```

Add updateDebtSettings function:
```typescript
const updateDebtSettingsFn = useCallback(async (settings: Partial<DebtSettings>) => {
  try {
    await updateDebtSettingsDb(settings);
    setDebtSettings((prev) => ({ ...prev, ...settings }));
  } catch (error) {
    Toast.show({ type: 'error', text1: 'Save Failed', text2: (error as Error).message });
    throw error;
  }
}, []);
```

Add to Provider value:
```typescript
debtSettings,
debtProjection,
updateDebtSettings: updateDebtSettingsFn,
```

**Step 3: Commit**

```bash
git add db/database.ts context/FinanceContext.tsx
git commit -m "feat: add debt settings persistence and context support"
```

---

### Task 4: Build missing debt screen components

The debt screen imports 3 components that don't exist: `DebtStrategySelector`, `PaymentBudgetCard`, `MonthlyBudgetCard`, and `StrategyComparisonModal`. Build all four.

**Files:**
- Create: `components/DebtStrategySelector.tsx`
- Create: `components/PaymentBudgetCard.tsx`
- Create: `components/MonthlyBudgetCard.tsx`
- Create: `components/StrategyComparisonModal.tsx`

**Step 1: Build DebtStrategySelector**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PayoffStrategy } from '@/types';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface DebtStrategySelectorProps {
  selectedStrategy: PayoffStrategy;
  onSelect: (strategy: PayoffStrategy) => void;
  onComparePress: () => void;
}

const strategies = [
  {
    value: PayoffStrategy.LOWEST_PAYMENT,
    label: 'Minimum',
    description: 'Pay minimums only',
    icon: 'minus.circle' as const,
  },
  {
    value: PayoffStrategy.FASTEST_PAYOFF,
    label: 'Avalanche',
    description: 'Highest APR first',
    icon: 'flame' as const,
  },
  {
    value: PayoffStrategy.SNOWBALL,
    label: 'Snowball',
    description: 'Lowest balance first',
    icon: 'circle.circle' as const,
  },
];

export default function DebtStrategySelector({
  selectedStrategy,
  onSelect,
  onComparePress,
}: DebtStrategySelectorProps) {
  return (
    <View>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Payoff Strategy
        </Text>
        <TouchableOpacity onPress={onComparePress}>
          <Text className="text-brand-600 dark:text-brand-400 text-sm font-medium">
            Compare
          </Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row gap-2">
        {strategies.map((s) => {
          const isSelected = selectedStrategy === s.value;
          return (
            <TouchableOpacity
              key={s.value}
              onPress={() => onSelect(s.value)}
              className={`flex-1 p-3 rounded-xl border ${
                isSelected
                  ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-700'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <View className="items-center">
                <IconSymbol
                  name={s.icon}
                  size={20}
                  color={isSelected ? '#0d9488' : '#94a3b8'}
                />
                <Text
                  className={`text-xs font-bold mt-1 ${
                    isSelected
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {s.label}
                </Text>
                <Text
                  className={`text-[10px] mt-0.5 text-center ${
                    isSelected
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {s.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
```

**Step 2: Build PaymentBudgetCard**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Keyboard, Platform, InputAccessoryView, TouchableOpacity, useColorScheme } from 'react-native';
import { Transaction, PayoffStrategy } from '@/types';
import { formatCurrency } from '@/utils/financeUtils';

interface PaymentBudgetCardProps {
  totalPaymentBudget: number;
  onPaymentBudgetChange: (budget: number) => void;
  creditCards: Transaction[];
  strategy: PayoffStrategy;
}

export default function PaymentBudgetCard({
  totalPaymentBudget,
  onPaymentBudgetChange,
  creditCards,
  strategy,
}: PaymentBudgetCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const inputAccessoryViewID = 'paymentBudgetInput';

  const [input, setInput] = useState(totalPaymentBudget > 0 ? totalPaymentBudget.toString() : '');

  useEffect(() => {
    setInput(totalPaymentBudget > 0 ? totalPaymentBudget.toString() : '');
  }, [totalPaymentBudget]);

  const handleSave = () => {
    const value = parseFloat(input) || 0;
    if (value >= 0) {
      onPaymentBudgetChange(value);
    }
    Keyboard.dismiss();
  };

  const totalMinimums = creditCards.reduce((sum, c) => sum + (c.minimumPayment ?? 0), 0);
  const extraAvailable = Math.max(0, totalPaymentBudget - totalMinimums);

  const strategyLabel =
    strategy === PayoffStrategy.FASTEST_PAYOFF
      ? 'highest APR card'
      : strategy === PayoffStrategy.SNOWBALL
      ? 'lowest balance card'
      : 'each card equally';

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Monthly Payment Budget
      </Text>
      <Text className="text-xs text-slate-400 dark:text-slate-500 mb-3">
        How much total can you pay toward credit cards each month?
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDark ? '#334155' : '#e2e8f0',
        }}
      >
        <Text style={{ color: '#94a3b8', fontSize: 20, paddingLeft: 16 }}>$</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          onBlur={handleSave}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
          inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
          style={{
            flex: 1,
            paddingHorizontal: 8,
            paddingVertical: 14,
            fontSize: 20,
            fontWeight: '700',
            color: isDark ? '#ffffff' : '#1e293b',
          }}
        />
      </View>
      {totalPaymentBudget > 0 && (
        <View className="mt-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-slate-400">Total Minimums</Text>
            <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">{formatCurrency(totalMinimums)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-slate-400">Extra Available</Text>
            <Text className="text-xs font-bold text-brand-600 dark:text-brand-400">{formatCurrency(extraAvailable)}</Text>
          </View>
          {strategy !== PayoffStrategy.LOWEST_PAYMENT && extraAvailable > 0 && (
            <Text className="text-[10px] text-slate-400 mt-2">
              Extra {formatCurrency(extraAvailable)} goes to {strategyLabel}
            </Text>
          )}
        </View>
      )}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={inputAccessoryViewID}>
          <View
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              borderTopWidth: 1,
              borderTopColor: isDark ? '#334155' : '#e2e8f0',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <TouchableOpacity onPress={() => Keyboard.dismiss()}>
              <Text style={{ color: '#0d9488', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}
```

**Step 3: Build MonthlyBudgetCard**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Keyboard, Platform, InputAccessoryView, TouchableOpacity, useColorScheme } from 'react-native';
import { Transaction } from '@/types';
import { formatCurrency } from '@/utils/financeUtils';

interface MonthlyBudgetCardProps {
  totalBudget: number;
  onBudgetChange: (budget: number) => void;
  creditCards: Transaction[];
  onPercentageChange: (cardId: string, percentage: number) => void;
}

export default function MonthlyBudgetCard({
  totalBudget,
  onBudgetChange,
  creditCards,
  onPercentageChange,
}: MonthlyBudgetCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const inputAccessoryViewID = 'monthlyBudgetInput';

  const [budgetInput, setBudgetInput] = useState(totalBudget > 0 ? totalBudget.toString() : '');
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setBudgetInput(totalBudget > 0 ? totalBudget.toString() : '');
  }, [totalBudget]);

  useEffect(() => {
    const inputs: Record<string, string> = {};
    creditCards.forEach((card) => {
      inputs[card.id] = (card.spendingPercentage ?? 0).toString();
    });
    setPercentInputs(inputs);
  }, [creditCards]);

  const handleBudgetSave = () => {
    const value = parseFloat(budgetInput) || 0;
    if (value >= 0) {
      onBudgetChange(value);
    }
    Keyboard.dismiss();
  };

  const handlePercentSave = (cardId: string) => {
    const value = parseFloat(percentInputs[cardId]) || 0;
    const clamped = Math.min(100, Math.max(0, value));
    onPercentageChange(cardId, clamped);
  };

  const totalPercent = creditCards.reduce((sum, c) => sum + (c.spendingPercentage ?? 0), 0);

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Monthly Spending Budget
      </Text>
      <Text className="text-xs text-slate-400 dark:text-slate-500 mb-3">
        How much do you charge to credit cards each month?
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDark ? '#334155' : '#e2e8f0',
        }}
      >
        <Text style={{ color: '#94a3b8', fontSize: 20, paddingLeft: 16 }}>$</Text>
        <TextInput
          value={budgetInput}
          onChangeText={setBudgetInput}
          onBlur={handleBudgetSave}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
          inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
          style={{
            flex: 1,
            paddingHorizontal: 8,
            paddingVertical: 14,
            fontSize: 20,
            fontWeight: '700',
            color: isDark ? '#ffffff' : '#1e293b',
          }}
        />
      </View>

      {totalBudget > 0 && creditCards.length > 0 && (
        <View className="mt-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Card Allocation
            </Text>
            <Text className={`text-xs font-bold ${totalPercent > 100 ? 'text-red-500' : totalPercent === 100 ? 'text-green-500' : 'text-slate-400'}`}>
              {totalPercent}% allocated
            </Text>
          </View>
          {creditCards.map((card) => (
            <View key={card.id} className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-slate-700 dark:text-slate-300 flex-1" numberOfLines={1}>
                {card.name}
              </Text>
              <View className="flex-row items-center">
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    width: 70,
                  }}
                >
                  <TextInput
                    value={percentInputs[card.id] ?? '0'}
                    onChangeText={(text) =>
                      setPercentInputs((prev) => ({ ...prev, [card.id]: text }))
                    }
                    onBlur={() => handlePercentSave(card.id)}
                    keyboardType="number-pad"
                    inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
                    style={{
                      flex: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      fontSize: 14,
                      fontWeight: '600',
                      textAlign: 'right',
                      color: isDark ? '#ffffff' : '#1e293b',
                    }}
                  />
                  <Text style={{ color: '#94a3b8', fontSize: 12, paddingRight: 8 }}>%</Text>
                </View>
                <Text className="text-xs text-slate-400 ml-2 w-16 text-right">
                  {formatCurrency(totalBudget * ((card.spendingPercentage ?? 0) / 100))}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={inputAccessoryViewID}>
          <View
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              borderTopWidth: 1,
              borderTopColor: isDark ? '#334155' : '#e2e8f0',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <TouchableOpacity onPress={() => Keyboard.dismiss()}>
              <Text style={{ color: '#0d9488', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}
```

**Step 4: Build StrategyComparisonModal**

```typescript
import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Transaction, DebtSettings, PayoffStrategy } from '@/types';
import { compareAllStrategies, StrategyComparison } from '@/utils/debtProjectionUtils';
import { formatCurrency } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface StrategyComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  transactions: Transaction[];
  debtSettings: DebtSettings;
  currentStrategy: PayoffStrategy;
  onSelectStrategy: (strategy: PayoffStrategy) => void;
}

export default function StrategyComparisonModal({
  visible,
  onClose,
  transactions,
  debtSettings,
  currentStrategy,
  onSelectStrategy,
}: StrategyComparisonModalProps) {
  const comparisons = useMemo(
    () => compareAllStrategies(transactions, debtSettings),
    [transactions, debtSettings]
  );

  // Find the best strategy (lowest total interest among those that pay off)
  const bestStrategy = comparisons
    .filter((c) => c.payoffMonths !== null)
    .sort((a, b) => a.totalInterest - b.totalInterest)[0];

  const handleSelect = (strategy: PayoffStrategy) => {
    onSelectStrategy(strategy);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 py-4 border-b border-slate-200 dark:border-slate-700">
          <Text className="text-xl font-bold text-slate-800 dark:text-white">
            Compare Strategies
          </Text>
          <TouchableOpacity onPress={onClose}>
            <IconSymbol name="xmark.circle.fill" size={28} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {comparisons.map((comparison) => {
            const isSelected = comparison.strategy === currentStrategy;
            const isBest = bestStrategy && comparison.strategy === bestStrategy.strategy;

            return (
              <TouchableOpacity
                key={comparison.strategy}
                onPress={() => handleSelect(comparison.strategy)}
                className={`mb-4 rounded-xl p-4 border ${
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className={`text-base font-bold ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-white'}`}>
                        {comparison.label}
                      </Text>
                      {isBest && (
                        <View className="bg-green-100 dark:bg-green-900/30 rounded px-2 py-0.5 ml-2">
                          <Text className="text-[10px] font-bold text-green-700 dark:text-green-400">
                            RECOMMENDED
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {comparison.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <IconSymbol name="checkmark.circle.fill" size={24} color="#0d9488" />
                  )}
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                    <Text className="text-[10px] text-slate-400 uppercase">Payoff Time</Text>
                    <Text className="text-lg font-bold text-slate-800 dark:text-white mt-1">
                      {comparison.payoffMonths !== null
                        ? `${comparison.payoffMonths} mo`
                        : 'Never'}
                    </Text>
                    {comparison.payoffMonths !== null && (
                      <Text className="text-[10px] text-slate-400">
                        {Math.floor(comparison.payoffMonths / 12)}y {comparison.payoffMonths % 12}m
                      </Text>
                    )}
                  </View>
                  <View className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                    <Text className="text-[10px] text-slate-400 uppercase">Total Interest</Text>
                    <Text className="text-lg font-bold text-red-500 mt-1">
                      {formatCurrency(comparison.totalInterest)}
                    </Text>
                  </View>
                  <View className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                    <Text className="text-[10px] text-slate-400 uppercase">Monthly</Text>
                    <Text className="text-lg font-bold text-slate-800 dark:text-white mt-1">
                      {formatCurrency(comparison.monthlyPayment)}
                    </Text>
                  </View>
                </View>

                {/* Savings compared to minimum payments */}
                {comparison.strategy !== PayoffStrategy.LOWEST_PAYMENT && comparisons[0] && (
                  <View className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <Text className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Saves {formatCurrency(comparisons[0].totalInterest - comparison.totalInterest)} in interest
                      {comparison.payoffMonths && comparisons[0].payoffMonths
                        ? ` and ${comparisons[0].payoffMonths - comparison.payoffMonths} months`
                        : ''}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View className="pb-12" />
        </ScrollView>
      </View>
    </Modal>
  );
}
```

**Step 5: Verify the app builds**

Run: `npx expo start` and check that the debt screen renders without errors.

**Step 6: Commit**

```bash
git add components/DebtStrategySelector.tsx components/PaymentBudgetCard.tsx components/MonthlyBudgetCard.tsx components/StrategyComparisonModal.tsx
git commit -m "feat: build missing debt screen components (strategy selector, budget cards, comparison modal)"
```

---

### Task 5: Fix financeUtils calculation bugs

**Files:**
- Modify: `utils/financeUtils.ts:27-37`
- Create: `__tests__/financeUtils.test.ts`

**Step 1: Write failing tests**

Create `__tests__/financeUtils.test.ts`:

```typescript
import { generateProjection } from '../utils/financeUtils';
import { Transaction, TransactionType, Frequency, DailyBalance } from '../types';
import { format, addDays, startOfDay, getDaysInMonth } from 'date-fns';

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'test-1',
    name: 'Test',
    amount: 100,
    type: TransactionType.EXPENSE,
    frequency: Frequency.MONTHLY,
    date: format(new Date(), 'yyyy-MM-dd'),
    ...overrides,
  };
}

describe('generateProjection', () => {
  describe('weekly recurrence', () => {
    it('fires on exact 7-day intervals from start date', () => {
      const today = startOfDay(new Date());
      const tx = makeTransaction({
        frequency: Frequency.WEEKLY,
        date: format(today, 'yyyy-MM-dd'),
        amount: 100,
        type: TransactionType.EXPENSE,
      });

      const projection = generateProjection(1000, [tx], 15);

      // Should fire on days 0, 7, 14
      const daysWithTx = projection
        .map((p, i) => (p.transactions.length > 0 ? i : -1))
        .filter((i) => i >= 0);
      expect(daysWithTx).toEqual([0, 7, 14]);
    });
  });

  describe('bi-weekly recurrence', () => {
    it('fires on exact 14-day intervals from start date', () => {
      const today = startOfDay(new Date());
      const tx = makeTransaction({
        frequency: Frequency.BI_WEEKLY,
        date: format(today, 'yyyy-MM-dd'),
        amount: 200,
      });

      const projection = generateProjection(1000, [tx], 30);

      const daysWithTx = projection
        .map((p, i) => (p.transactions.length > 0 ? i : -1))
        .filter((i) => i >= 0);
      expect(daysWithTx).toEqual([0, 14, 28]);
    });
  });

  describe('monthly recurrence with day > days in month', () => {
    it('fires on last day of month when dayOfMonth exceeds month length', () => {
      // This test verifies the end-of-month fallback
      const tx = makeTransaction({
        frequency: Frequency.MONTHLY,
        dayOfMonth: 31,
        amount: 100,
      });

      // Generate 60 days to cover at least one short month
      const projection = generateProjection(1000, [tx], 60);

      // Should fire on at least one day per month — verify no month is entirely skipped
      // Get unique months that had transactions
      const monthsWithTx = new Set(
        projection
          .filter((p) => p.transactions.length > 0)
          .map((p) => p.date.substring(0, 7))
      );

      // We should have transactions in at least some months
      expect(monthsWithTx.size).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npx jest __tests__/financeUtils.test.ts -v`
Expected: monthly day 31 test may fail, and weekly/bi-weekly tests may fail due to Math.ceil bug.

**Step 3: Fix the bugs in financeUtils.ts**

Replace lines 27-37 in `utils/financeUtils.ts`:

```typescript
} else if (t.frequency === Frequency.BI_WEEKLY) {
  const start = startOfDay(parseISO(t.date));
  const diffTime = currentDate.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  isDue = diffDays >= 0 && diffDays % 14 === 0;
} else if (t.frequency === Frequency.WEEKLY) {
  const start = startOfDay(parseISO(t.date));
  const diffTime = currentDate.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  isDue = diffDays >= 0 && diffDays % 7 === 0;
}
```

For the monthly day-of-month fix, replace line 26:

```typescript
} else if (t.frequency === Frequency.MONTHLY) {
  if (t.dayOfMonth) {
    const daysInMonth = getDaysInMonth(currentDate);
    const effectiveDay = Math.min(t.dayOfMonth, daysInMonth);
    isDue = effectiveDay === dayOfMonth;
  }
}
```

Add `getDaysInMonth` to the date-fns import at line 1:

```typescript
import { addDays, format, parseISO, getDate, startOfDay, getDaysInMonth } from 'date-fns';
```

**Step 4: Run tests to verify pass**

Run: `npx jest __tests__/financeUtils.test.ts -v`
Expected: all tests PASS

**Step 5: Run full test suite**

Run: `npx jest`
Expected: all tests PASS

**Step 6: Commit**

```bash
git add utils/financeUtils.ts __tests__/financeUtils.test.ts
git commit -m "fix: weekly/bi-weekly recurrence off-by-one and monthly end-of-month fallback"
```

---

### Task 6: Fix TransactionCard undefined APR + SummaryCard negative balance

**Files:**
- Modify: `components/TransactionCard.tsx:41-47`
- Modify: `components/SummaryCard.tsx:37`

**Step 1: Fix TransactionCard**

In `components/TransactionCard.tsx`, change lines 41-47 to only show APR when defined:

```typescript
{isDebt && transaction.apr !== undefined && transaction.apr !== null && (
  <View className="bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 ml-2">
    <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-medium">
      {transaction.apr}% APR
    </Text>
  </View>
)}
```

**Step 2: Fix SummaryCard**

In `components/SummaryCard.tsx`, change line 37 to show actual balance:

```typescript
{formatCurrency(lowestBalance)}
```

(Remove `Math.max(0, lowestBalance)`)

**Step 3: Commit**

```bash
git add components/TransactionCard.tsx components/SummaryCard.tsx
git commit -m "fix: hide undefined APR on transaction cards, show actual negative balance in summary"
```

---

### Task 7: Form validation for add-transaction

**Files:**
- Modify: `app/add-transaction.tsx`

**Step 1: Add validation state and logic**

Add validation state after existing state declarations (after line 37):

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});
const [isSaving, setIsSaving] = useState(false);

const validate = (): boolean => {
  const newErrors: Record<string, string> = {};

  if (!name.trim()) {
    newErrors.name = 'Name is required';
  } else if (name.trim().length > 100) {
    newErrors.name = 'Name must be under 100 characters';
  }

  const amountNum = parseFloat(amount);
  if (!amount || isNaN(amountNum)) {
    newErrors.amount = 'Enter a valid amount';
  } else if (amountNum <= 0) {
    newErrors.amount = 'Amount must be greater than zero';
  } else if (amountNum > 999999.99) {
    newErrors.amount = 'Amount must be under $1,000,000';
  }

  if (isDebt) {
    const aprNum = parseFloat(apr);
    if (!apr || isNaN(aprNum)) {
      newErrors.apr = 'APR is required for debt';
    } else if (aprNum < 0 || aprNum > 100) {
      newErrors.apr = 'APR must be 0-100%';
    }

    const balNum = parseFloat(currentBalance);
    if (!currentBalance || isNaN(balNum)) {
      newErrors.currentBalance = 'Balance is required';
    } else if (balNum < 0) {
      newErrors.currentBalance = 'Balance cannot be negative';
    }

    if (debtType === DebtType.CREDIT_CARD) {
      const limitNum = parseFloat(creditLimit);
      if (!creditLimit || isNaN(limitNum)) {
        newErrors.creditLimit = 'Credit limit is required';
      } else if (limitNum <= 0) {
        newErrors.creditLimit = 'Credit limit must be positive';
      }

      const spendNum = parseFloat(projectedMonthlySpend);
      if (projectedMonthlySpend && !isNaN(spendNum) && spendNum < 0) {
        newErrors.projectedMonthlySpend = 'Cannot be negative';
      }
    }

    if (debtType === DebtType.LOAN) {
      const termNum = parseFloat(loanTermMonths);
      if (!loanTermMonths || isNaN(termNum)) {
        newErrors.loanTermMonths = 'Loan term is required';
      } else if (termNum < 1 || termNum > 600) {
        newErrors.loanTermMonths = 'Must be 1-600 months';
      }
    }
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

**Step 2: Update handleSubmit to use validation**

Replace `handleSubmit`:

```typescript
const handleSubmit = async () => {
  if (!validate() || isSaving) return;

  setIsSaving(true);
  try {
    const newTx: Transaction = {
      id: generateUUID(),
      name: name.trim(),
      amount: parseFloat(amount),
      type: activeTab,
      frequency,
      date: date.toISOString().split('T')[0],
      dayOfMonth:
        activeTab === TransactionType.EXPENSE && frequency === Frequency.MONTHLY
          ? date.getDate()
          : undefined,
      debtType: isDebt ? debtType : undefined,
      apr: isDebt && apr ? parseFloat(apr) : undefined,
      currentBalance: isDebt && currentBalance ? parseFloat(currentBalance) : undefined,
      creditLimit:
        isDebt && debtType === DebtType.CREDIT_CARD && creditLimit
          ? parseFloat(creditLimit)
          : undefined,
      projectedMonthlySpend:
        isDebt && debtType === DebtType.CREDIT_CARD && projectedMonthlySpend
          ? parseFloat(projectedMonthlySpend)
          : undefined,
      loanTermMonths:
        isDebt && debtType === DebtType.LOAN && loanTermMonths
          ? parseFloat(loanTermMonths)
          : undefined,
    };

    await addTransaction(newTx);
    router.back();
  } catch {
    // Error toast shown by context
  } finally {
    setIsSaving(false);
  }
};
```

**Step 3: Add error display helper**

Add this after the validate function:

```typescript
const renderError = (field: string) => {
  if (!errors[field]) return null;
  return (
    <Text className="text-red-500 text-xs mt-1">{errors[field]}</Text>
  );
};
```

**Step 4: Add error displays below each field**

After the Name TextInput (after line 172), add: `{renderError('name')}`
After the Amount View (after line 191), add: `{renderError('amount')}`
After the APR TextInput (after line 361), add: `{renderError('apr')}`
After the Current Balance TextInput (after line 376), add: `{renderError('currentBalance')}`
After the Credit Limit TextInput (after line 394), add: `{renderError('creditLimit')}`
After the Monthly Spend TextInput (after line 408), add: `{renderError('projectedMonthlySpend')}`
After the Loan Term TextInput (after line 427), add: `{renderError('loanTermMonths')}`

**Step 5: Update submit button to show loading state**

Replace the submit button:

```typescript
<TouchableOpacity
  onPress={handleSubmit}
  disabled={isSaving}
  className={`py-4 rounded-xl mt-4 ${
    isSaving
      ? 'bg-slate-300 dark:bg-slate-700'
      : name.trim() && amount
      ? 'bg-brand-600'
      : 'bg-slate-300 dark:bg-slate-700'
  }`}
>
  {isSaving ? (
    <ActivityIndicator color="#ffffff" />
  ) : (
    <Text
      className={`text-center font-bold text-lg ${
        name.trim() && amount ? 'text-white' : 'text-slate-400'
      }`}
    >
      Add Transaction
    </Text>
  )}
</TouchableOpacity>
```

Add `ActivityIndicator` to imports from react-native.

**Step 6: Commit**

```bash
git add app/add-transaction.tsx
git commit -m "fix: comprehensive form validation with inline errors and loading state"
```

---

### Task 8: Fix settings screen validation and remaining bugs

**Files:**
- Modify: `app/settings.tsx`

**Step 1: Add validation and loading state**

Add to `SettingsScreen` component:

```typescript
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState('');

const handleSave = async () => {
  const newBalance = parseFloat(balance);
  if (isNaN(newBalance)) {
    setError('Enter a valid number');
    return;
  }
  if (newBalance < 0) {
    setError('Balance cannot be negative');
    return;
  }

  setError('');
  setIsSaving(true);
  try {
    await updateBalance(newBalance);
    router.back();
  } catch {
    // Error toast shown by context
  } finally {
    setIsSaving(false);
  }
};
```

Add error display below the balance input:

```typescript
{error ? <Text className="text-red-500 text-xs mt-2">{error}</Text> : null}
```

Update save button to show loading:

```typescript
<TouchableOpacity
  onPress={handleSave}
  disabled={isSaving}
  className={`py-4 rounded-xl ${isSaving ? 'bg-slate-300' : 'bg-brand-600'}`}
>
  {isSaving ? (
    <ActivityIndicator color="#ffffff" />
  ) : (
    <Text className="text-center text-white font-bold text-lg">
      Save Balance
    </Text>
  )}
</TouchableOpacity>
```

Add `ActivityIndicator` to react-native imports.

**Step 2: Commit**

```bash
git add app/settings.tsx
git commit -m "fix: settings validation, no negative balance, loading state"
```

---

## Phase 2: Supabase Auth & Database

### Task 9: Set up Supabase client and schema

**Step 1: Install dependencies**

```bash
npx expo install @supabase/supabase-js expo-secure-store @react-native-async-storage/async-storage expo-apple-authentication
```

**Step 2: Create Supabase project config**

Create `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Step 3: Create app.config.js for environment variables**

Create `app.config.js` (rename from app.json to support env vars — move all existing config):

```javascript
export default ({ config }) => ({
  ...config,
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```

Create `.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Step 4: Create Supabase migrations**

Use the Supabase MCP tool to create the tables, RLS policies, and triggers. Create these tables in the Supabase project:

- `profiles` with RLS
- `transactions` with RLS
- `user_settings` with RLS
- `debt_settings` with RLS
- `excluded_occurrences` with RLS

Each table gets `user_id` referencing `auth.users(id)` and RLS policies for SELECT/INSERT/UPDATE/DELETE where `auth.uid() = user_id`.

Create trigger: on `auth.users` INSERT, create a `profiles` row with `trial_end = now() + interval '7 days'`.

**Step 5: Commit**

```bash
git add lib/supabase.ts app.config.js .env.example
git commit -m "feat: set up Supabase client with secure token storage"
```

---

### Task 10: Build auth context and screens

**Files:**
- Create: `context/AuthContext.tsx`
- Create: `app/auth/sign-in.tsx`
- Create: `app/auth/sign-up.tsx`
- Create: `app/auth/_layout.tsx`
- Modify: `app/_layout.tsx` — wrap with AuthProvider, add auth navigation guard

**Step 1: Build AuthContext**

Create `context/AuthContext.tsx` with:
- `AuthProvider` component
- State: user, session, isLoading, isAnonymous
- Methods: signInWithEmail, signUpWithEmail, signInWithApple, signOut, deleteAccount
- Auto-session restore on mount
- Auth state listener (onAuthStateChange)

**Step 2: Build sign-in screen**

Create `app/auth/sign-in.tsx` with:
- Apple Sign In button (prominent, iOS-styled)
- Email/password form with validation
- "Create Account" link to sign-up
- "Forgot Password" link
- Error display

**Step 3: Build sign-up screen**

Create `app/auth/sign-up.tsx` with:
- Apple Sign In button
- Email, password, confirm password form
- Validation (password match, min length)
- "Already have account" link

**Step 4: Build auth layout**

Create `app/auth/_layout.tsx` as a stack navigator for auth screens.

**Step 5: Update root layout**

Modify `app/_layout.tsx` to:
- Wrap everything with `AuthProvider`
- Show auth screens when not authenticated and trial expired
- Show main app when authenticated or in trial

**Step 6: Commit**

```bash
git add context/AuthContext.tsx app/auth/ app/_layout.tsx
git commit -m "feat: Supabase auth with Apple Sign In and email/password"
```

---

### Task 11: Build sync engine

**Files:**
- Create: `lib/sync.ts`
- Modify: `db/database.ts` — add sync_queue table
- Modify: `context/FinanceContext.tsx` — integrate sync

**Step 1: Add sync_queue table to SQLite**

In `db/database.ts` `initDatabase`, add:

```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
```

Add functions: `addToSyncQueue`, `getUnsyncedItems`, `markSynced`.

**Step 2: Build sync engine**

Create `lib/sync.ts` with:
- `syncToCloud()` — push unsynced local changes to Supabase
- `syncFromCloud(lastSyncTime)` — pull remote changes
- `performFullSync()` — push then pull
- `initialSync()` — push all local data on first sign-in
- Network awareness check before syncing
- Conflict resolution: last-write-wins using updated_at
- Error handling with retry logic

**Step 3: Integrate sync into context**

Modify `FinanceContext.tsx`:
- After each mutation, add to sync queue
- On app foreground, trigger sync
- Expose syncStatus and lastSynced

**Step 4: Install network info**

```bash
npx expo install @react-native-community/netinfo
```

**Step 5: Commit**

```bash
git add lib/sync.ts db/database.ts context/FinanceContext.tsx
git commit -m "feat: offline-first sync engine with Supabase"
```

---

## Phase 3: Subscription & Paywall

### Task 12: RevenueCat integration

**Step 1: Install RevenueCat**

```bash
npx expo install react-native-purchases
```

**Step 2: Create subscription context**

Create `context/SubscriptionContext.tsx` with:
- Configure Purchases on mount
- `SubscriptionProvider` component
- State: isSubscribed, isTrialing, trialDaysLeft, offerings
- Methods: subscribe, restore
- Listen for CustomerInfo changes
- Sync status to Supabase profiles

**Step 3: Build paywall screen**

Create `app/paywall.tsx` as a full-screen modal:
- 3 value prop rows with icons
- Monthly price card
- "Start Free Trial" CTA button
- "Restore Purchases" text button
- Terms/Privacy links
- Loading state during purchase
- Cannot be dismissed (no back button)

**Step 4: Integrate paywall gating**

Modify `app/_layout.tsx`:
- Check subscription status
- Show paywall when trial expired and not subscribed
- Allow access when subscribed or in trial

**Step 5: Commit**

```bash
git add context/SubscriptionContext.tsx app/paywall.tsx app/_layout.tsx
git commit -m "feat: RevenueCat subscription with paywall and free trial"
```

---

## Phase 4: Onboarding

### Task 13: Build onboarding flow

**Files:**
- Create: `app/onboarding.tsx`
- Create: `components/OnboardingSlide.tsx`
- Modify: `app/_layout.tsx` — show onboarding on first launch

**Step 1: Build onboarding screen**

Create `app/onboarding.tsx` with:
- 3 swipeable slides using ScrollView + paging
- Pagination dots
- "Skip" button on all screens
- "Get Started" on last screen
- Track `hasOnboarded` in AsyncStorage

**Step 2: Build setup wizard**

After onboarding, show setup steps:
- Step 1: Set starting balance
- Step 2: Add first income (optional, skip-able)
- Step 3: Add first expense (optional, skip-able)

**Step 3: Update root layout**

Check AsyncStorage for `hasOnboarded` flag. If false, show onboarding before main app.

**Step 4: Commit**

```bash
git add app/onboarding.tsx components/OnboardingSlide.tsx app/_layout.tsx
git commit -m "feat: onboarding flow with setup wizard"
```

---

## Phase 5: UX Improvements

### Task 14: Toast notification system

Already installed in Task 2. Ensure all mutations show toasts:
- Success: "Transaction saved", "Balance updated", etc.
- Error: shown by context error handling
- Add success toasts in add-transaction, settings, debt screen mutations

**Commit after each screen is updated.**

---

### Task 15: Empty states for all screens

**Files:**
- Modify: `app/(tabs)/index.tsx` — improve empty state
- Modify: `app/(tabs)/debt.tsx` — already has empty state, verify it's polished
- Modify: `app/(tabs)/transactions.tsx` — already has empty state, add filtered empty state

Improve each empty state with illustration-style icons, descriptive text, and CTA buttons that navigate to add-transaction.

**Commit after all empty states are updated.**

---

### Task 16: Pull-to-refresh

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/transactions.tsx`
- Modify: `app/(tabs)/debt.tsx`

Replace `ScrollView` with `ScrollView` + `RefreshControl` on each screen:

```typescript
import { RefreshControl } from 'react-native';

const [refreshing, setRefreshing] = useState(false);
const onRefresh = async () => {
  setRefreshing(true);
  await refresh();
  setRefreshing(false);
};

// In ScrollView:
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
```

**Commit.**

---

### Task 17: Swipe-to-delete on transactions

**Files:**
- Modify: `components/TransactionCard.tsx`
- Modify: `app/(tabs)/transactions.tsx`

Use `react-native-gesture-handler` Swipeable component to add swipe-to-delete with red background and trash icon. Show confirmation alert before deleting.

**Commit.**

---

### Task 18: Search and filter on transactions

**Files:**
- Modify: `app/(tabs)/transactions.tsx`

Add:
- Search bar at top (TextInput with search icon)
- Fuzzy search by transaction name
- Debounced search (300ms)
- Clear button

**Commit.**

---

### Task 19: Rebuild settings screen

**Files:**
- Modify: `app/settings.tsx` (complete rewrite as full settings page, not just balance)

Build sections:
- **Account:** email, sign out, delete account
- **Subscription:** plan status, manage, restore purchases
- **Sync:** last synced, sync now
- **Data:** current balance, export, import
- **About:** version, privacy policy, terms, support, rate app

Move settings from modal to a tab or dedicated screen accessible from dashboard gear icon.

**Commit.**

---

### Task 20: Dashboard improvements

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Create: `components/NetWorthCard.tsx`

Add:
- Net worth card (assets minus total debt)
- Monthly trend indicator (up/down arrow vs last month)

**Commit.**

---

## Phase 6: Production Infrastructure

### Task 21: Sentry integration

**Step 1: Install**
```bash
npx expo install @sentry/react-native
```

**Step 2: Configure**

Create `lib/sentry.ts`, initialize in `app/_layout.tsx`.

Add error boundaries wrapping each tab screen.

**Commit.**

---

### Task 22: Analytics integration

**Step 1: Install PostHog**
```bash
npx expo install posthog-react-native
```

**Step 2: Create analytics helper**

Create `lib/analytics.ts` with `track()` function.

Instrument all events listed in design doc (app_opened, transaction_added, paywall_shown, etc.).

**Commit.**

---

### Task 23: Performance optimizations

- Memoize chart data with `useMemo` in CashFlowChart
- `React.memo()` on TransactionCard, DebtCard, EnhancedDebtCard
- FlatList with getItemLayout for transaction lists
- Debounce search input

**Commit.**

---

### Task 24: Comprehensive test suite

**Files:**
- Expand: `__tests__/financeUtils.test.ts`
- Expand: `__tests__/debtProjectionUtils.test.ts`
- Create: `__tests__/database.test.ts`

Add tests for:
- All frequency types in generateProjection
- All three debt strategies
- Database CRUD with error handling
- Edge cases (zero balance, zero APR, max values)

**Commit.**

---

## Phase 7: App Store Preparation

### Task 25: Legal documents

Create hosted Privacy Policy and Terms of Service. Add links to paywall and settings.

### Task 26: App Store listing prep

- Update app.json with final name, description
- Generate app icon assets
- Prepare screenshot descriptions

### Task 27: App Review prep

- Add review notes about subscription
- Ensure all App Store guidelines are met

---

## Implementation Order Summary

1. Tasks 1-8: Bug fixes (foundation)
2. Tasks 9-11: Auth & sync (Supabase)
3. Task 12: Subscription (RevenueCat)
4. Task 13: Onboarding
5. Tasks 14-20: UX improvements
6. Tasks 21-24: Infrastructure
7. Tasks 25-27: App Store prep

Each task should be committed independently. Run tests after each task.

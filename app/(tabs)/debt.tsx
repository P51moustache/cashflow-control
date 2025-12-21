import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFinance } from '@/context/FinanceContext';
import DebtCard from '@/components/DebtCard';
import { formatCurrency } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function DebtScreen() {
  const { transactions, isLoading } = useFinance();

  // Filter debts (transactions with debtType set)
  const debts = transactions.filter((t) => t.debtType);
  const totalDebt = debts.reduce((sum, t) => sum + (t.currentBalance || 0), 0);
  const totalMonthlyPayments = debts.reduce((sum, t) => sum + t.amount, 0);

  // Calculate Blended APR
  const blendedAPR =
    totalDebt > 0
      ? debts.reduce(
          (acc, t) => acc + (t.apr || 0) * (t.currentBalance || 0),
          0
        ) / totalDebt
      : 0;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
      </SafeAreaView>
    );
  }

  if (debts.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="opacity-20 mb-4">
            <IconSymbol name="creditcard.fill" size={64} color="#94a3b8" />
          </View>
          <Text className="text-slate-400 dark:text-slate-500 text-center text-lg mb-2">
            No debts tracked yet
          </Text>
          <Text className="text-slate-300 dark:text-slate-600 text-center text-sm">
            Add an expense and enable "Track as Debt" to see debt projections here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-2 pb-24">
          {/* Header Stats Card */}
          <View className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 shadow-lg mb-6 relative overflow-hidden">
            <View className="absolute top-0 right-0 p-4 opacity-10">
              <IconSymbol name="chart.line.uptrend.xyaxis" size={80} color="#ffffff" />
            </View>
            <View className="relative z-10">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                Total Liability
              </Text>
              <Text className="text-white text-3xl font-bold mb-4">
                {formatCurrency(totalDebt)}
              </Text>
              <View className="flex-row gap-8">
                <View>
                  <Text className="text-slate-400 text-[10px] uppercase">
                    Blended APR
                  </Text>
                  <Text className="font-mono font-bold text-lg text-brand-300">
                    {blendedAPR.toFixed(1)}%
                  </Text>
                </View>
                <View>
                  <Text className="text-slate-400 text-[10px] uppercase">
                    Monthly Commit
                  </Text>
                  <Text className="font-mono font-bold text-lg text-white">
                    {formatCurrency(totalMonthlyPayments)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Section Title */}
          <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Your Accounts
          </Text>

          {/* Debt Cards */}
          {debts.map((debt) => (
            <DebtCard key={debt.id} debt={debt} />
          ))}

          {/* Tip */}
          <View className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 mt-2">
            <Text className="text-brand-700 dark:text-brand-300 text-sm font-medium mb-1">
              Debt Payoff Tip
            </Text>
            <Text className="text-brand-600 dark:text-brand-400 text-xs">
              Focus extra payments on the highest APR debt first (avalanche method)
              to minimize total interest paid.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

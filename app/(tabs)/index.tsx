import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import BalanceCard from '@/components/BalanceCard';
import NetWorthCard from '@/components/NetWorthCard';
import SummaryCard from '@/components/SummaryCard';
import CashFlowChart from '@/components/CashFlowChart';
import TransactionCard from '@/components/TransactionCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatCurrency } from '@/utils/financeUtils';
import { TransactionType, Frequency } from '@/types';
import { trackScreen } from '@/lib/analytics';

export default function DashboardScreen() {
  const { transactions, isLoading, refresh } = useFinance();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    trackScreen('Dashboard');
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Get upcoming transactions (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const upcomingTransactions = transactions
    .filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= today && txDate <= nextWeek;
    })
    .slice(0, 3);

  // Monthly cashflow calculations (considers only monthly/recurring transactions)
  const getMonthlyAmount = (t: typeof transactions[0]): number => {
    switch (t.frequency) {
      case Frequency.MONTHLY:
        return t.amount;
      case Frequency.BI_WEEKLY:
        return t.amount * (26 / 12); // ~2.167x per month
      case Frequency.WEEKLY:
        return t.amount * (52 / 12); // ~4.333x per month
      case Frequency.ONE_TIME:
        return 0; // One-time transactions don't count toward monthly
      default:
        return t.amount;
    }
  };

  const monthlyIncome = transactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + getMonthlyAmount(t), 0);

  const monthlyExpenses = transactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + getMonthlyAmount(t), 0);

  const netCashflow = monthlyIncome - monthlyExpenses;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
        <Text className="text-slate-500 dark:text-slate-400 mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0d9488"
            colors={['#0d9488']}
          />
        }
      >
        <View className="px-4 pt-2 pb-24">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-2xl font-bold text-slate-800 dark:text-white">
                Cashflow
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 text-sm">
                Your 45-day projection
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => router.push('/settings')}
                className="bg-slate-200 dark:bg-slate-700 rounded-full p-2.5"
              >
                <IconSymbol name="gearshape.fill" size={22} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/add-transaction')}
                className="bg-brand-600 rounded-full p-3"
              >
                <IconSymbol name="plus.circle.fill" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {transactions.length === 0 ? (
            /* Welcome Empty State */
            <View className="bg-white dark:bg-slate-800 rounded-2xl p-8 items-center border border-slate-100 dark:border-slate-700 mt-4">
              <View className="mb-4">
                <IconSymbol name="sparkles" size={56} color="#0d9488" />
              </View>
              <Text className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">
                Welcome to Cashflow Control
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-center text-sm mb-6 leading-5">
                Add your income and expenses to see your cashflow projection
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/add-transaction')}
                className="bg-brand-600 px-8 py-3 rounded-xl"
              >
                <Text className="text-white font-bold text-base">Get Started</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Balance Card */}
              <View className="mb-4">
                <BalanceCard />
              </View>

              {/* Net Worth Card */}
              <View className="mb-4">
                <NetWorthCard />
              </View>

              {/* Summary Card */}
              <View className="mb-4">
                <SummaryCard />
              </View>

              {/* Chart */}
              <View className="mb-6">
                <CashFlowChart />
              </View>

              {/* Upcoming Transactions */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Upcoming (7 days)
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
                    <Text className="text-brand-600 dark:text-brand-400 text-sm font-medium">
                      View All
                    </Text>
                  </TouchableOpacity>
                </View>
                {upcomingTransactions.length > 0 ? (
                  upcomingTransactions.map((tx) => (
                    <TransactionCard key={tx.id} transaction={tx} />
                  ))
                ) : (
                  <View className="bg-white dark:bg-slate-800 rounded-xl p-6 items-center border border-slate-100 dark:border-slate-700">
                    <Text className="text-slate-400 dark:text-slate-500">
                      No upcoming transactions
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/add-transaction')}
                      className="mt-3"
                    >
                      <Text className="text-brand-600 dark:text-brand-400 font-medium">
                        + Add your first transaction
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Quick Stats */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <Text className="text-green-600 dark:text-green-400 text-xs font-bold uppercase">
                    Monthly Income
                  </Text>
                  <Text className="text-green-700 dark:text-green-300 text-lg font-bold mt-1">
                    {formatCurrency(monthlyIncome)}
                  </Text>
                </View>
                <View className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <Text className="text-red-600 dark:text-red-400 text-xs font-bold uppercase">
                    Monthly Expenses
                  </Text>
                  <Text className="text-red-700 dark:text-red-300 text-lg font-bold mt-1">
                    {formatCurrency(monthlyExpenses)}
                  </Text>
                </View>
              </View>

              {/* Monthly Trend */}
              <View
                className={`rounded-xl p-4 ${
                  netCashflow >= 0
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <IconSymbol
                      name={netCashflow >= 0 ? 'arrow.up.circle.fill' : 'arrow.down.circle.fill'}
                      size={24}
                      color={netCashflow >= 0 ? '#16a34a' : '#ef4444'}
                    />
                    <Text
                      className={`text-base font-bold ml-2 ${
                        netCashflow >= 0
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      Net {netCashflow >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(netCashflow))}/mo
                    </Text>
                  </View>
                  <Text
                    className={`text-xs font-medium ${
                      netCashflow >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    Monthly Cashflow
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

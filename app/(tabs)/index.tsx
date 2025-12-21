import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import BalanceCard from '@/components/BalanceCard';
import SummaryCard from '@/components/SummaryCard';
import CashFlowChart from '@/components/CashFlowChart';
import TransactionCard from '@/components/TransactionCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TransactionType } from '@/types';

export default function DashboardScreen() {
  const { transactions, isLoading } = useFinance();
  const router = useRouter();

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
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity
              onPress={() => router.push('/add-transaction')}
              className="bg-brand-600 rounded-full p-3 shadow-lg shadow-brand-600/30"
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <View className="mb-4">
            <BalanceCard />
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
          <View className="flex-row gap-3">
            <View className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <Text className="text-green-600 dark:text-green-400 text-xs font-bold uppercase">
                Monthly Income
              </Text>
              <Text className="text-green-700 dark:text-green-300 text-lg font-bold mt-1">
                $
                {transactions
                  .filter((t) => t.type === TransactionType.INCOME)
                  .reduce((sum, t) => sum + t.amount, 0)
                  .toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
              <Text className="text-red-600 dark:text-red-400 text-xs font-bold uppercase">
                Monthly Expenses
              </Text>
              <Text className="text-red-700 dark:text-red-300 text-lg font-bold mt-1">
                $
                {transactions
                  .filter((t) => t.type === TransactionType.EXPENSE)
                  .reduce((sum, t) => sum + t.amount, 0)
                  .toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

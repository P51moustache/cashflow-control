import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import TransactionCard from '@/components/TransactionCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TransactionType } from '@/types';

type FilterType = 'all' | 'income' | 'expense';

export default function TransactionsScreen() {
  const { transactions, removeTransaction, isLoading, refresh } = useFinance();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'income') return t.type === TransactionType.INCOME;
    if (filter === 'expense') return t.type === TransactionType.EXPENSE;
    return true;
  });

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeTransaction(id);
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-slate-800 dark:text-white">
            Transactions
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            {filteredTransactions.length} items
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/add-transaction')}
          className="bg-brand-600 rounded-full p-3"
        >
          <IconSymbol name="plus.circle.fill" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row px-4 mb-4 gap-2">
        {(['all', 'income', 'expense'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg ${
              filter === f
                ? 'bg-brand-600'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Text
              className={`text-center font-medium text-sm capitalize ${
                filter === f
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 px-4"
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
        <View className="pb-24">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onDelete={() => handleDelete(tx.id, tx.name)}
              />
            ))
          ) : transactions.length > 0 && filter !== 'all' ? (
            /* Filtered but no results for this filter */
            <View className="bg-white dark:bg-slate-800 rounded-xl p-8 items-center border border-slate-100 dark:border-slate-700 mt-4">
              <Text className="text-4xl mb-4">
                {filter === 'income' ? '💰' : '💸'}
              </Text>
              <Text className="text-slate-800 dark:text-slate-200 font-semibold text-base mb-1 text-center">
                No {filter} transactions
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-center text-sm">
                Try a different filter or add a new one
              </Text>
              <TouchableOpacity
                onPress={() => setFilter('all')}
                className="mt-4 bg-slate-100 dark:bg-slate-700 px-6 py-3 rounded-xl"
              >
                <Text className="text-slate-700 dark:text-slate-200 font-semibold">
                  Show All
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* No transactions at all */
            <View className="bg-white dark:bg-slate-800 rounded-xl p-8 items-center border border-slate-100 dark:border-slate-700 mt-4">
              <Text className="text-4xl mb-4">📋</Text>
              <Text className="text-slate-800 dark:text-slate-200 font-semibold text-base mb-1 text-center">
                No transactions yet
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-center text-sm">
                Add your first income or expense to get started
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/add-transaction')}
                className="mt-4 bg-brand-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-semibold">
                  Add Transaction
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

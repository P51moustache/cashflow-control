import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import TransactionCard from '@/components/TransactionCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Transaction, TransactionType } from '@/types';
import { trackScreen } from '@/lib/analytics';

type FilterType = 'all' | 'income' | 'expense';

export default function TransactionsScreen() {
  const { transactions, removeTransaction, isLoading, refresh } = useFinance();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    trackScreen('Transactions');
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const matchesFilter =
          filter === 'all' ||
          (filter === 'income' && t.type === TransactionType.INCOME) ||
          (filter === 'expense' && t.type === TransactionType.EXPENSE);
        const matchesSearch =
          !searchQuery ||
          t.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
      }),
    [transactions, filter, searchQuery]
  );

  const handleDelete = useCallback(
    (id: string, name: string) => {
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
    },
    [removeTransaction]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
      </SafeAreaView>
    );
  }

  // Determine the type of empty state to show
  const hasTransactions = transactions.length > 0;
  const hasActiveSearch = searchQuery.length > 0;
  const hasActiveFilter = filter !== 'all';

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onDelete={() => handleDelete(item.id, item.name)}
      />
    ),
    [handleDelete]
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Transaction> | null | undefined, index: number) => ({
      length: 85,
      offset: 85 * index,
      index,
    }),
    []
  );

  const listEmptyComponent = useMemo(() => {
    if (hasTransactions && (hasActiveSearch || hasActiveFilter)) {
      return (
        <View className="bg-white dark:bg-slate-800 rounded-xl p-8 items-center border border-slate-100 dark:border-slate-700 mt-4">
          <IconSymbol name="magnifyingglass" size={40} color="#94a3b8" />
          <Text className="text-slate-800 dark:text-slate-200 font-semibold text-base mb-1 mt-3 text-center">
            No matching transactions
          </Text>
          <Text className="text-slate-400 dark:text-slate-500 text-center text-sm">
            {hasActiveSearch
              ? `No results for "${searchQuery}"${hasActiveFilter ? ` in ${filter}` : ''}`
              : `No ${filter} transactions found`}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setFilter('all');
            }}
            className="mt-4 bg-slate-100 dark:bg-slate-700 px-6 py-3 rounded-xl"
          >
            <Text className="text-slate-700 dark:text-slate-200 font-semibold">
              Clear Filters
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
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
    );
  }, [hasTransactions, hasActiveSearch, hasActiveFilter, searchQuery, filter, router]);

  const listHeaderComponent = useMemo(
    () => (
      <View>
        {/* Search Bar */}
        <View className="mb-3">
          <View className="flex-row items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3">
            <IconSymbol name="magnifyingglass" size={18} color="#94a3b8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search transactions..."
              placeholderTextColor="#94a3b8"
              className="flex-1 py-3 px-2 text-slate-800 dark:text-white"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row mb-4 gap-2">
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
      </View>
    ),
    [searchQuery, filter]
  );

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

      <FlatList
        data={filteredTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={listEmptyComponent}
        ListHeaderComponent={listHeaderComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0d9488"
            colors={['#0d9488']}
          />
        }
        contentContainerStyle={{ paddingBottom: 96, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        getItemLayout={getItemLayout}
      />
    </SafeAreaView>
  );
}

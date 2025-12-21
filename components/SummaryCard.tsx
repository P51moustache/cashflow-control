import React from 'react';
import { View, Text } from 'react-native';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/utils/financeUtils';

export default function SummaryCard() {
  const { lowestBalance, projection } = useFinance();

  // Find the date of the lowest balance
  const lowestDay = projection.find((p) => p.lowestPoint);
  const lowestDate = lowestDay
    ? new Date(lowestDay.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  const isNegative = lowestBalance < 0;
  const isSafe = lowestBalance > 500;

  return (
    <View className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Safe to Spend
          </Text>
          <Text
            className={`text-2xl font-bold ${
              isNegative
                ? 'text-red-500'
                : isSafe
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-orange-500'
            }`}
          >
            {formatCurrency(Math.max(0, lowestBalance))}
          </Text>
          <Text className="text-slate-400 dark:text-slate-500 text-xs mt-1">
            Lowest balance on {lowestDate}
          </Text>
        </View>
        <View
          className={`w-16 h-16 rounded-full items-center justify-center ${
            isNegative
              ? 'bg-red-100 dark:bg-red-900/30'
              : isSafe
              ? 'bg-brand-100 dark:bg-brand-900/30'
              : 'bg-orange-100 dark:bg-orange-900/30'
          }`}
        >
          <Text className="text-2xl">{isNegative ? '⚠️' : isSafe ? '✓' : '!'}</Text>
        </View>
      </View>
      {isNegative && (
        <View className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <Text className="text-red-600 dark:text-red-400 text-sm font-medium">
            Warning: You may overdraft by {formatCurrency(Math.abs(lowestBalance))}
          </Text>
        </View>
      )}
    </View>
  );
}

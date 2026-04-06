import React from 'react';
import { View, Text } from 'react-native';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/utils/financeUtils';
import { DebtType } from '@/types';

export default function NetWorthCard() {
  const { currentBalance, transactions } = useFinance();

  // Total assets = current checking balance
  const totalAssets = currentBalance;

  // Total debt = sum of all credit card currentBalance values
  const totalDebt = transactions
    .filter((t) => t.debtType === DebtType.CREDIT_CARD && typeof t.currentBalance === 'number')
    .reduce((sum, t) => sum + (t.currentBalance ?? 0), 0);

  // Net worth = assets - debt
  const netWorth = totalAssets - totalDebt;
  const isPositive = netWorth >= 0;

  return (
    <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
      <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Net Worth
      </Text>
      <View className="flex-row justify-between items-start">
        {/* Assets */}
        <View className="flex-1 items-center">
          <Text className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">
            Assets
          </Text>
          <Text className="text-green-600 dark:text-green-400 text-base font-bold">
            {formatCurrency(totalAssets)}
          </Text>
        </View>

        {/* Divider */}
        <View className="w-px h-10 bg-slate-200 dark:bg-slate-600 mx-2 self-center" />

        {/* Debt */}
        <View className="flex-1 items-center">
          <Text className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">
            Debt
          </Text>
          <Text className="text-red-500 dark:text-red-400 text-base font-bold">
            {totalDebt > 0 ? `-${formatCurrency(totalDebt)}` : formatCurrency(0)}
          </Text>
        </View>

        {/* Divider */}
        <View className="w-px h-10 bg-slate-200 dark:bg-slate-600 mx-2 self-center" />

        {/* Net Worth */}
        <View className="flex-1 items-center">
          <Text className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">
            Net Worth
          </Text>
          <Text
            className={`text-base font-bold ${
              isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-500 dark:text-red-400'
            }`}
          >
            {isPositive ? formatCurrency(netWorth) : `-${formatCurrency(Math.abs(netWorth))}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

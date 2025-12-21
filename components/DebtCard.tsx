import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { addMonths, format } from 'date-fns';
import { Transaction, DebtType } from '@/types';
import { formatCurrency } from '@/utils/financeUtils';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface DebtCardProps {
  debt: Transaction;
}

export default function DebtCard({ debt }: DebtCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = Dimensions.get('window');

  const isHighInterest = (debt.apr || 0) > 20;

  // Calculate 6-month projection
  const getDebtProjection = () => {
    const data = [];
    let balance = debt.currentBalance || 0;
    const rate = (debt.apr || 0) / 100 / 12;
    const payment = debt.amount;
    const newCharges = debt.projectedMonthlySpend || 0;

    for (let i = 0; i <= 6; i++) {
      data.push({
        value: Math.max(0, balance),
        label: i % 2 === 0 ? format(addMonths(new Date(), i), 'MMM') : '',
      });
      const interest = balance * rate;
      balance += interest + newCharges;
      balance -= payment;
    }
    return data;
  };

  const projectionData = getDebtProjection();
  const limit = debt.creditLimit || 0;
  const utilization =
    limit > 0 && debt.currentBalance ? (debt.currentBalance / limit) * 100 : 0;

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-4">
      {/* Header */}
      <View className="p-4 border-b border-slate-50 dark:border-slate-700 flex-row justify-between items-start">
        <View>
          <Text className="font-bold text-slate-800 dark:text-white text-base">
            {debt.name}
          </Text>
          <View
            className={`mt-1 px-2 py-0.5 rounded self-start ${
              isHighInterest
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-slate-100 dark:bg-slate-700'
            }`}
          >
            <Text
              className={`text-[10px] font-medium ${
                isHighInterest
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {debt.apr}% APR
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-lg font-bold text-slate-800 dark:text-white">
            {formatCurrency(debt.currentBalance || 0)}
          </Text>
          <Text className="text-xs text-slate-400 dark:text-slate-500">
            Payment: {formatCurrency(debt.amount)}/mo
          </Text>
        </View>
      </View>

      <View className="p-4">
        {/* Credit Utilization (for credit cards) */}
        {debt.debtType === DebtType.CREDIT_CARD && limit > 0 && (
          <View className="mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                Utilization
              </Text>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                {utilization.toFixed(0)}% of {formatCurrency(limit)}
              </Text>
            </View>
            <View className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${
                  utilization > 80
                    ? 'bg-red-500'
                    : utilization > 30
                    ? 'bg-orange-400'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </View>
          </View>
        )}

        {/* Mini Projection Chart */}
        <View>
          <View className="flex-row items-center mb-2">
            <Text className="text-[10px] text-slate-400 dark:text-slate-500">
              6-Month Projection
            </Text>
            {debt.projectedMonthlySpend ? (
              <Text className="text-[10px] text-slate-300 dark:text-slate-600 ml-1">
                (+{formatCurrency(debt.projectedMonthlySpend)}/mo spend)
              </Text>
            ) : null}
          </View>
          <View style={{ marginLeft: -10 }}>
            <LineChart
              data={projectionData}
              width={screenWidth - 80}
              height={80}
              spacing={(screenWidth - 100) / projectionData.length}
              initialSpacing={0}
              color="#ef4444"
              thickness={2}
              hideDataPoints
              hideRules
              hideYAxisText
              xAxisColor="transparent"
              yAxisColor="transparent"
              xAxisLabelTextStyle={{
                color: isDark ? '#64748b' : '#94a3b8',
                fontSize: 8,
              }}
              areaChart
              startFillColor="#ef4444"
              startOpacity={0.15}
              endOpacity={0.02}
              curved
              adjustToWidth
            />
          </View>
        </View>
      </View>
    </View>
  );
}

import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { format, parseISO } from 'date-fns';
import { useFinance } from '@/context/FinanceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: screenWidth } = Dimensions.get('window');

export default function CashFlowChart() {
  const { projection } = useFinance();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (projection.length === 0) {
    return (
      <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <Text className="text-slate-500 dark:text-slate-400 text-center py-8">
          No projection data available
        </Text>
      </View>
    );
  }

  const data = projection.map((p, index) => ({
    value: p.balance,
    label: index % 7 === 0 ? format(parseISO(p.date), 'MMM d') : '',
    dataPointText: '',
  }));

  const minBalance = Math.min(...projection.map((p) => p.balance));
  const maxBalance = Math.max(...projection.map((p) => p.balance));
  const hasNegative = minBalance < 0;

  const chartWidth = screenWidth - 80;

  return (
    <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
        45-Day Projection
      </Text>
      <LineChart
        data={data}
        width={chartWidth}
        height={180}
        spacing={chartWidth / data.length}
        initialSpacing={0}
        color={hasNegative ? '#ef4444' : '#0d9488'}
        thickness={2}
        hideDataPoints
        hideRules
        yAxisColor="transparent"
        xAxisColor={isDark ? '#334155' : '#e2e8f0'}
        yAxisTextStyle={{
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 10,
        }}
        xAxisLabelTextStyle={{
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 10,
          width: 40,
        }}
        areaChart
        startFillColor={hasNegative ? '#ef4444' : '#0d9488'}
        startOpacity={0.3}
        endOpacity={0.05}
        curved
        adjustToWidth
        yAxisOffset={minBalance < 0 ? minBalance - 100 : 0}
        noOfSections={4}
        formatYLabel={(label) => {
          const num = Number(label);
          if (Math.abs(num) >= 1000) {
            return `$${(num / 1000).toFixed(1)}k`;
          }
          return `$${num.toFixed(0)}`;
        }}
      />
      {hasNegative && (
        <View className="flex-row items-center mt-2">
          <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
          <Text className="text-xs text-red-500">
            Warning: Balance goes negative
          </Text>
        </View>
      )}
    </View>
  );
}

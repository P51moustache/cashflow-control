import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  useColorScheme,
  useWindowDimensions,
  InputAccessoryView,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Transaction, DebtProjection } from '@/types';
import { formatCurrency } from '@/utils/financeUtils';
import { formatPayoffDate } from '@/utils/debtProjectionUtils';

interface EnhancedDebtCardProps {
  card: Transaction;
  projection: DebtProjection | undefined;
  onMinimumPaymentChange: (cardId: string, amount: number) => void;
  onExtraPaymentChange: (cardId: string, amount: number) => void;
}

export default function EnhancedDebtCard({
  card,
  projection,
  onMinimumPaymentChange,
  onExtraPaymentChange,
}: EnhancedDebtCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  // Chart width: screen width - padding (32) - card padding (32) - some buffer
  const chartWidth = width - 32 - 32 - 16;
  const inputAccessoryViewID = `debtCard-${card.id}`;

  const [minInput, setMinInput] = useState(
    card.minimumPayment ? card.minimumPayment.toString() : ''
  );
  const [extraInput, setExtraInput] = useState(
    card.extraPayment ? card.extraPayment.toString() : ''
  );

  useEffect(() => {
    setMinInput(card.minimumPayment ? card.minimumPayment.toString() : '');
    setExtraInput(card.extraPayment ? card.extraPayment.toString() : '');
  }, [card.minimumPayment, card.extraPayment]);

  const handleMinSave = () => {
    const value = parseFloat(minInput) || 0;
    onMinimumPaymentChange(card.id, value);
    Keyboard.dismiss();
  };

  const handleExtraSave = () => {
    const value = parseFloat(extraInput) || 0;
    onExtraPaymentChange(card.id, value);
    Keyboard.dismiss();
  };

  const apr = card.apr ?? 0;
  const balance = card.currentBalance ?? 0;
  const creditLimit = card.creditLimit ?? 0;
  const utilization = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;

  const totalPayment = (card.minimumPayment ?? 0) + (card.extraPayment ?? 0);

  // Prepare chart data from projection (first 12 months)
  const chartData = projection?.monthlyProjections.slice(0, 12).map((month, index) => ({
    value: month.endingBalance,
    label: index % 3 === 0 ? month.month.split('-')[1] : '',
    labelTextStyle: { color: isDark ? '#64748b' : '#94a3b8', fontSize: 10 },
  })) ?? [];

  // Calculate spacing based on chart width
  const chartSpacing = Math.max(16, (chartWidth - 40) / 12);

  const getUtilizationColor = () => {
    if (utilization > 80) return 'bg-red-500';
    if (utilization > 30) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 mb-4">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-800 dark:text-white" numberOfLines={1}>
            {card.name}
          </Text>
          <Text className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {formatCurrency(balance)}
          </Text>
        </View>
        <View className={`px-2 py-1 rounded ${apr > 20 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
          <Text className={`text-xs font-bold ${apr > 20 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {apr}% APR
          </Text>
        </View>
      </View>

      {/* Credit Utilization */}
      {creditLimit > 0 && (
        <View className="mb-4">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-slate-400">Credit Utilization</Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400">
              {utilization.toFixed(0)}% of {formatCurrency(creditLimit)}
            </Text>
          </View>
          <View className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <View
              className={`h-full ${getUtilizationColor()}`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </View>
        </View>
      )}

      {/* Payment Inputs */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Min Payment
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark ? '#334155' : '#e2e8f0',
            }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 14, paddingLeft: 10 }}>$</Text>
            <TextInput
              value={minInput}
              onChangeText={setMinInput}
              onBlur={handleMinSave}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#94a3b8"
              inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
              style={{
                flex: 1,
                paddingHorizontal: 6,
                paddingVertical: 10,
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? '#ffffff' : '#1e293b',
              }}
            />
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Extra Payment
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark ? '#334155' : '#e2e8f0',
            }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 14, paddingLeft: 10 }}>$</Text>
            <TextInput
              value={extraInput}
              onChangeText={setExtraInput}
              onBlur={handleExtraSave}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#94a3b8"
              inputAccessoryViewID={Platform.OS === 'ios' ? inputAccessoryViewID : undefined}
              style={{
                flex: 1,
                paddingHorizontal: 6,
                paddingVertical: 10,
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? '#ffffff' : '#1e293b',
              }}
            />
          </View>
        </View>
      </View>

      {/* Total and Payoff Info */}
      <View className="flex-row justify-between items-center py-2 border-t border-slate-100 dark:border-slate-700">
        <View>
          <Text className="text-xs text-slate-400">Total Payment</Text>
          <Text className="text-lg font-bold text-brand-600 dark:text-brand-400">
            {formatCurrency(totalPayment)}/mo
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-slate-400">Payoff</Text>
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {projection?.payoffMonths
              ? `${projection.payoffMonths} months`
              : 'Never'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-slate-400">Monthly Interest</Text>
          <Text className="text-sm font-semibold text-red-500">
            {formatCurrency(projection?.monthlyInterestCost ?? 0)}
          </Text>
        </View>
      </View>

      {/* Balance Projection Chart */}
      {chartData.length > 0 && (
        <View className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <Text className="text-xs text-slate-400 mb-2">12-Month Balance Projection</Text>
          <LineChart
            data={chartData}
            width={chartWidth}
            height={80}
            hideDataPoints
            thickness={2}
            color="#0d9488"
            yAxisColor="transparent"
            xAxisColor="transparent"
            hideYAxisText
            curved
            areaChart
            startFillColor="#0d948830"
            endFillColor="#0d948805"
            startOpacity={0.3}
            endOpacity={0.05}
            noOfSections={3}
            yAxisLabelWidth={0}
            spacing={chartSpacing}
            initialSpacing={0}
            endSpacing={0}
          />
        </View>
      )}

      {/* iOS Keyboard Done Button */}
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
              <Text
                style={{
                  color: '#0d9488',
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

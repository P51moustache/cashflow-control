import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  useColorScheme,
  InputAccessoryView,
  Platform,
} from 'react-native';
import { Transaction, PayoffStrategy } from '@/types';
import { formatCurrency } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface PaymentBudgetCardProps {
  totalPaymentBudget: number;
  onPaymentBudgetChange: (budget: number) => void;
  creditCards: Transaction[];
  strategy: PayoffStrategy;
}

const INPUT_ACCESSORY_ID = 'paymentBudgetInput';

export default function PaymentBudgetCard({
  totalPaymentBudget,
  onPaymentBudgetChange,
  creditCards,
  strategy,
}: PaymentBudgetCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [budgetInput, setBudgetInput] = useState(
    totalPaymentBudget > 0 ? totalPaymentBudget.toString() : ''
  );

  useEffect(() => {
    setBudgetInput(totalPaymentBudget > 0 ? totalPaymentBudget.toString() : '');
  }, [totalPaymentBudget]);

  const handleSave = () => {
    const value = parseFloat(budgetInput) || 0;
    onPaymentBudgetChange(value);
    Keyboard.dismiss();
  };

  const totalMinimums = creditCards.reduce(
    (sum, card) => sum + (card.minimumPayment ?? 0),
    0
  );
  const extraAvailable = Math.max(0, totalPaymentBudget - totalMinimums);

  const getStrategyNote = (): string => {
    switch (strategy) {
      case PayoffStrategy.FASTEST_PAYOFF:
        return 'Extra goes to highest APR card first (Avalanche)';
      case PayoffStrategy.SNOWBALL:
        return 'Extra goes to lowest balance card first (Snowball)';
      case PayoffStrategy.LOWEST_PAYMENT:
        return 'Only minimum payments will be made';
      default:
        return '';
    }
  };

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      {/* Title */}
      <Text className="text-base font-semibold text-slate-800 dark:text-white mb-1">
        Monthly Payment Budget
      </Text>
      <Text className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        How much total can you pay toward credit cards each month?
      </Text>

      {/* Dollar Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: isDark ? '#334155' : '#e2e8f0',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            color: isDark ? '#64748b' : '#94a3b8',
            fontSize: 24,
            fontWeight: '700',
          }}
        >
          $
        </Text>
        <TextInput
          value={budgetInput}
          onChangeText={setBudgetInput}
          onBlur={handleSave}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
          inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
          style={{
            flex: 1,
            paddingHorizontal: 8,
            paddingVertical: 14,
            fontSize: 24,
            fontWeight: '700',
            color: isDark ? '#ffffff' : '#1e293b',
          }}
        />
      </View>

      {/* Breakdown Section */}
      {totalPaymentBudget > 0 && (
        <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          {/* Total Minimums */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              Total Minimums
            </Text>
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {formatCurrency(totalMinimums)}
            </Text>
          </View>

          {/* Extra Available */}
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              Extra Available
            </Text>
            <Text
              className={`text-sm font-bold ${
                extraAvailable > 0
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-400'
              }`}
            >
              {formatCurrency(extraAvailable)}
            </Text>
          </View>

          {/* Strategy Note */}
          <View className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5 flex-row items-start">
            <IconSymbol
              name="info.circle"
              size={14}
              color={isDark ? '#94a3b8' : '#64748b'}
              style={{ marginTop: 1, marginRight: 8 }}
            />
            <Text className="text-xs text-slate-500 dark:text-slate-400 flex-1">
              {getStrategyNote()}
            </Text>
          </View>
        </View>
      )}

      {/* iOS Keyboard Done Button */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
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

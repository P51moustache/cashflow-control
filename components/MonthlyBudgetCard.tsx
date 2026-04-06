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
import { Transaction } from '@/types';
import { formatCurrency } from '@/utils/financeUtils';

interface MonthlyBudgetCardProps {
  totalBudget: number;
  onBudgetChange: (budget: number) => void;
  creditCards: Transaction[];
  onPercentageChange: (cardId: string, percentage: number) => void;
}

const INPUT_ACCESSORY_ID = 'monthlyBudgetInput';

export default function MonthlyBudgetCard({
  totalBudget,
  onBudgetChange,
  creditCards,
  onPercentageChange,
}: MonthlyBudgetCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [budgetInput, setBudgetInput] = useState(
    totalBudget > 0 ? totalBudget.toString() : ''
  );
  const [percentageInputs, setPercentageInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setBudgetInput(totalBudget > 0 ? totalBudget.toString() : '');
  }, [totalBudget]);

  useEffect(() => {
    const inputs: Record<string, string> = {};
    creditCards.forEach((card) => {
      const pct = card.spendingPercentage ?? 0;
      inputs[card.id] = pct > 0 ? pct.toString() : '';
    });
    setPercentageInputs(inputs);
  }, [creditCards]);

  const handleBudgetSave = () => {
    const value = parseFloat(budgetInput) || 0;
    onBudgetChange(value);
    Keyboard.dismiss();
  };

  const handlePercentageSave = (cardId: string) => {
    const value = parseFloat(percentageInputs[cardId]) || 0;
    onPercentageChange(cardId, value);
  };

  const handlePercentageInputChange = (cardId: string, text: string) => {
    setPercentageInputs((prev) => ({ ...prev, [cardId]: text }));
  };

  const totalAllocated = creditCards.reduce(
    (sum, card) => sum + (card.spendingPercentage ?? 0),
    0
  );

  const getAllocationColor = (): string => {
    if (totalAllocated === 100) return 'text-green-600 dark:text-green-400';
    if (totalAllocated > 100) return 'text-red-600 dark:text-red-400';
    return 'text-amber-600 dark:text-amber-400';
  };

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      {/* Title */}
      <Text className="text-base font-semibold text-slate-800 dark:text-white mb-1">
        Monthly Spending Budget
      </Text>
      <Text className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        How much do you charge to credit cards each month?
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
          onBlur={handleBudgetSave}
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

      {/* Per-Card Allocation */}
      {totalBudget > 0 && creditCards.length > 0 && (
        <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Card Allocation
          </Text>

          {creditCards.map((card) => {
            const pct = card.spendingPercentage ?? 0;
            const dollarAmount = totalBudget * (pct / 100);

            return (
              <View
                key={card.id}
                className="flex-row items-center justify-between mb-2.5"
              >
                {/* Card name */}
                <Text
                  className="text-sm text-slate-700 dark:text-slate-300 flex-1 mr-3"
                  numberOfLines={1}
                >
                  {card.name}
                </Text>

                {/* Percentage input */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    width: 72,
                  }}
                >
                  <TextInput
                    value={percentageInputs[card.id] ?? ''}
                    onChangeText={(text) => handlePercentageInputChange(card.id, text)}
                    onBlur={() => handlePercentageSave(card.id)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    inputAccessoryViewID={
                      Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined
                    }
                    style={{
                      flex: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 8,
                      fontSize: 14,
                      fontWeight: '600',
                      color: isDark ? '#ffffff' : '#1e293b',
                      textAlign: 'right',
                    }}
                  />
                  <Text
                    style={{
                      color: '#94a3b8',
                      fontSize: 14,
                      paddingRight: 8,
                    }}
                  >
                    %
                  </Text>
                </View>

                {/* Dollar amount */}
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 w-20 text-right ml-2">
                  {formatCurrency(dollarAmount)}
                </Text>
              </View>
            );
          })}

          {/* Total Allocated */}
          <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <Text className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Total Allocated
            </Text>
            <Text className={`text-sm font-bold ${getAllocationColor()}`}>
              {totalAllocated}%
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

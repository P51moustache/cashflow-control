import React from 'react';
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { PayoffStrategy } from '@/types';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface DebtStrategySelectorProps {
  selectedStrategy: PayoffStrategy;
  onSelect: (strategy: PayoffStrategy) => void;
  onComparePress: () => void;
}

const STRATEGIES = [
  {
    value: PayoffStrategy.LOWEST_PAYMENT,
    label: 'Minimum',
    description: 'Pay minimums only',
    icon: 'minus.circle' as const,
  },
  {
    value: PayoffStrategy.FASTEST_PAYOFF,
    label: 'Avalanche',
    description: 'Highest APR first',
    icon: 'flame' as const,
  },
  {
    value: PayoffStrategy.SNOWBALL,
    label: 'Snowball',
    description: 'Lowest balance first',
    icon: 'circle.circle' as const,
  },
];

export default function DebtStrategySelector({
  selectedStrategy,
  onSelect,
  onComparePress,
}: DebtStrategySelectorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View>
      {/* Header row */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Payoff Strategy
        </Text>
        <TouchableOpacity
          onPress={onComparePress}
          className="px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30"
        >
          <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400">
            Compare
          </Text>
        </TouchableOpacity>
      </View>

      {/* Strategy cards row */}
      <View className="flex-row gap-2">
        {STRATEGIES.map((strategy) => {
          const isSelected = selectedStrategy === strategy.value;
          return (
            <TouchableOpacity
              key={strategy.value}
              onPress={() => onSelect(strategy.value)}
              className={`flex-1 rounded-xl p-3 border ${
                isSelected
                  ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500 dark:border-brand-400'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
              }`}
              activeOpacity={0.7}
            >
              <View className="items-center">
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${
                    isSelected
                      ? 'bg-brand-100 dark:bg-brand-800/50'
                      : 'bg-slate-100 dark:bg-slate-700'
                  }`}
                >
                  <IconSymbol
                    name={strategy.icon}
                    size={20}
                    color={
                      isSelected
                        ? isDark
                          ? '#14b8a6'
                          : '#0d9488'
                        : isDark
                        ? '#94a3b8'
                        : '#64748b'
                    }
                  />
                </View>
                <Text
                  className={`text-xs font-bold text-center ${
                    isSelected
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {strategy.label}
                </Text>
                <Text
                  className={`text-[10px] text-center mt-0.5 ${
                    isSelected
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  numberOfLines={1}
                >
                  {strategy.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

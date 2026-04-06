import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Transaction, DebtSettings, PayoffStrategy } from '@/types';
import {
  compareAllStrategies,
  StrategyComparison,
} from '@/utils/debtProjectionUtils';
import { formatCurrency } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface StrategyComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  transactions: Transaction[];
  debtSettings: DebtSettings;
  currentStrategy: PayoffStrategy;
  onSelectStrategy: (strategy: PayoffStrategy) => void;
}

function formatMonths(months: number | null): string {
  if (months === null) return 'Never';
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${months} mo`;
  if (remaining === 0) return `${years} yr`;
  return `${years} yr ${remaining} mo`;
}

export default function StrategyComparisonModal({
  visible,
  onClose,
  transactions,
  debtSettings,
  currentStrategy,
  onSelectStrategy,
}: StrategyComparisonModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const comparisons = useMemo(
    () => compareAllStrategies(transactions, debtSettings),
    [transactions, debtSettings]
  );

  // Find the strategy with lowest total interest (that actually pays off)
  const recommendedStrategy = useMemo(() => {
    const payable = comparisons.filter((c) => c.payoffMonths !== null);
    if (payable.length === 0) return null;
    return payable.reduce((best, current) =>
      current.totalInterest < best.totalInterest ? current : best
    ).strategy;
  }, [comparisons]);

  // Get minimum-payment baseline for savings comparison
  const minimumBaseline = useMemo(() => {
    return comparisons.find(
      (c) => c.strategy === PayoffStrategy.LOWEST_PAYMENT
    );
  }, [comparisons]);

  const handleSelect = (strategy: PayoffStrategy) => {
    onSelectStrategy(strategy);
    onClose();
  };

  const getStrategyIcon = (strategy: PayoffStrategy) => {
    switch (strategy) {
      case PayoffStrategy.LOWEST_PAYMENT:
        return 'minus.circle' as const;
      case PayoffStrategy.FASTEST_PAYOFF:
        return 'flame' as const;
      case PayoffStrategy.SNOWBALL:
        return 'circle.circle' as const;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        className="flex-1 bg-slate-50 dark:bg-slate-900"
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <Text className="text-lg font-bold text-slate-800 dark:text-white">
            Compare Strategies
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <IconSymbol
              name="xmark"
              size={16}
              color={isDark ? '#94a3b8' : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {comparisons.map((comparison) => {
            const isSelected = currentStrategy === comparison.strategy;
            const isRecommended = comparison.strategy === recommendedStrategy;

            // Calculate savings vs minimum payments
            const interestSavings =
              minimumBaseline && comparison.strategy !== PayoffStrategy.LOWEST_PAYMENT
                ? minimumBaseline.totalInterest - comparison.totalInterest
                : 0;
            const monthsSaved =
              minimumBaseline &&
              minimumBaseline.payoffMonths !== null &&
              comparison.payoffMonths !== null &&
              comparison.strategy !== PayoffStrategy.LOWEST_PAYMENT
                ? minimumBaseline.payoffMonths - comparison.payoffMonths
                : 0;

            return (
              <TouchableOpacity
                key={comparison.strategy}
                onPress={() => handleSelect(comparison.strategy)}
                className={`rounded-xl p-4 mb-3 border ${
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 dark:border-brand-400'
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                }`}
                activeOpacity={0.7}
              >
                {/* Header row with name + badges */}
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center flex-1">
                    <IconSymbol
                      name={getStrategyIcon(comparison.strategy)}
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
                    <Text
                      className={`text-base font-bold ml-2 ${
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {comparison.label}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    {isRecommended && (
                      <View className="bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                        <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                          Recommended
                        </Text>
                      </View>
                    )}
                    {isSelected && (
                      <IconSymbol
                        name="checkmark.circle.fill"
                        size={22}
                        color={isDark ? '#14b8a6' : '#0d9488'}
                      />
                    )}
                  </View>
                </View>

                {/* Description */}
                <Text className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                  {comparison.description}
                </Text>

                {/* Stats boxes */}
                <View className="flex-row gap-2 mb-2">
                  {/* Payoff Time */}
                  <View
                    className={`flex-1 rounded-lg p-2.5 ${
                      isSelected
                        ? 'bg-brand-100/50 dark:bg-brand-800/30'
                        : 'bg-slate-50 dark:bg-slate-700/50'
                    }`}
                  >
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">
                      Payoff Time
                    </Text>
                    <Text
                      className={`text-sm font-bold ${
                        comparison.payoffMonths === null
                          ? 'text-red-500'
                          : isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {formatMonths(comparison.payoffMonths)}
                    </Text>
                  </View>

                  {/* Total Interest */}
                  <View
                    className={`flex-1 rounded-lg p-2.5 ${
                      isSelected
                        ? 'bg-brand-100/50 dark:bg-brand-800/30'
                        : 'bg-slate-50 dark:bg-slate-700/50'
                    }`}
                  >
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">
                      Total Interest
                    </Text>
                    <Text
                      className={`text-sm font-bold ${
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {formatCurrency(comparison.totalInterest)}
                    </Text>
                  </View>

                  {/* Monthly Payment */}
                  <View
                    className={`flex-1 rounded-lg p-2.5 ${
                      isSelected
                        ? 'bg-brand-100/50 dark:bg-brand-800/30'
                        : 'bg-slate-50 dark:bg-slate-700/50'
                    }`}
                  >
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">
                      Monthly
                    </Text>
                    <Text
                      className={`text-sm font-bold ${
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {formatCurrency(comparison.monthlyPayment)}
                    </Text>
                  </View>
                </View>

                {/* Savings comparison */}
                {comparison.strategy !== PayoffStrategy.LOWEST_PAYMENT &&
                  (interestSavings > 0 || monthsSaved > 0) && (
                    <View className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 mt-1">
                      <Text className="text-xs font-medium text-green-700 dark:text-green-400">
                        {interestSavings > 0 && monthsSaved > 0
                          ? `Saves ${formatCurrency(interestSavings)} in interest and ${monthsSaved} months`
                          : interestSavings > 0
                          ? `Saves ${formatCurrency(interestSavings)} in interest`
                          : `Saves ${monthsSaved} months`}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

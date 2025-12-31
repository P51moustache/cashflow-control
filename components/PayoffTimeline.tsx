import React from 'react';
import { View, Text } from 'react-native';
import { DebtProjection } from '@/types';
import { formatPayoffDate } from '@/utils/debtProjectionUtils';
import { formatCurrency } from '@/utils/financeUtils';

interface PayoffTimelineProps {
  projections: DebtProjection[];
  totalInterestCost: number;
}

const CARD_COLORS = [
  '#0d9488', // teal
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
];

export default function PayoffTimeline({
  projections,
  totalInterestCost,
}: PayoffTimelineProps) {
  // Sort by payoff date
  const sortedProjections = [...projections]
    .filter(p => p.payoffMonths !== null)
    .sort((a, b) => (a.payoffMonths ?? 999) - (b.payoffMonths ?? 999));

  const neverPayoff = projections.filter(p => p.payoffMonths === null);

  // Find max months for scale
  const maxMonths = Math.max(
    ...sortedProjections.map(p => p.payoffMonths ?? 0),
    24
  );

  if (projections.length === 0) {
    return null;
  }

  return (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
        Payoff Timeline
      </Text>

      {/* Timeline Visual */}
      <View className="mb-4">
        {/* Timeline Bar */}
        <View className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full relative">
          {/* Markers for each card */}
          {sortedProjections.map((proj, index) => {
            const position = ((proj.payoffMonths ?? 0) / maxMonths) * 100;
            return (
              <View
                key={proj.cardId}
                style={{
                  position: 'absolute',
                  left: `${Math.min(position, 95)}%`,
                  top: -4,
                }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: CARD_COLORS[index % CARD_COLORS.length],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                  }}
                />
              </View>
            );
          })}

          {/* End marker */}
          {sortedProjections.length > 0 && (
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: -6,
              }}
            >
              <Text className="text-lg">🎉</Text>
            </View>
          )}
        </View>

        {/* Time labels */}
        <View className="flex-row justify-between mt-2">
          <Text className="text-xs text-slate-400">Now</Text>
          <Text className="text-xs text-slate-400">{maxMonths} months</Text>
        </View>
      </View>

      {/* Card Legend */}
      <View className="gap-2">
        {sortedProjections.map((proj, index) => (
          <View key={proj.cardId} className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: CARD_COLORS[index % CARD_COLORS.length],
                  marginRight: 8,
                }}
              />
              <Text className="text-sm text-slate-700 dark:text-slate-300" numberOfLines={1}>
                {proj.cardName}
              </Text>
            </View>
            <Text className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {proj.payoffMonths} mo ({formatPayoffDate(proj.payoffDate)})
            </Text>
          </View>
        ))}

        {/* Cards that won't pay off */}
        {neverPayoff.map((proj) => (
          <View key={proj.cardId} className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#ef4444',
                  marginRight: 8,
                }}
              />
              <Text className="text-sm text-slate-700 dark:text-slate-300" numberOfLines={1}>
                {proj.cardName}
              </Text>
            </View>
            <Text className="text-sm font-medium text-red-500">
              Balance increasing
            </Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex-row justify-between">
        <View>
          <Text className="text-xs text-slate-400">Debt Free By</Text>
          <Text className="text-sm font-semibold text-green-600 dark:text-green-400">
            {sortedProjections.length > 0
              ? formatPayoffDate(sortedProjections[sortedProjections.length - 1].payoffDate)
              : 'N/A'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-slate-400">Monthly Interest</Text>
          <Text className="text-sm font-semibold text-red-500">
            {formatCurrency(
              projections.reduce((sum, p) => sum + (p.monthlyInterestCost ?? 0), 0)
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

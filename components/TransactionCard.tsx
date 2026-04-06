import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Transaction, TransactionType } from '@/types';
import { formatCurrency, getFrequencyLabel } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface TransactionCardProps {
  transaction: Transaction;
  onDelete?: () => void;
}

export default function TransactionCard({ transaction, onDelete }: TransactionCardProps) {
  const isIncome = transaction.type === TransactionType.INCOME;
  const isDebt = !!transaction.debtType;
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => (
    <TouchableOpacity
      onPress={() => {
        swipeableRef.current?.close();
        onDelete?.();
      }}
      className="bg-red-500 justify-center items-center px-6 rounded-xl mb-3"
    >
      <IconSymbol name="trash.fill" size={24} color="#ffffff" />
      <Text className="text-white text-xs font-medium mt-1">Delete</Text>
    </TouchableOpacity>
  );

  const cardContent = (
    <View className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-row items-center flex-1">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              isIncome
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}
          >
            <IconSymbol
              name={isIncome ? 'arrow.up.circle.fill' : 'arrow.down.circle.fill'}
              size={24}
              color={isIncome ? '#22c55e' : '#ef4444'}
            />
          </View>
          <View className="flex-1">
            <Text className="text-slate-800 dark:text-slate-200 font-semibold text-base">
              {transaction.name}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-slate-400 dark:text-slate-500 text-xs">
                {getFrequencyLabel(transaction.frequency)}
              </Text>
              {isDebt && transaction.apr != null && (
                <View className="bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 ml-2">
                  <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                    {transaction.apr}% APR
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View className="items-end">
          <Text
            className={`font-bold text-lg ${
              isIncome
                ? 'text-green-600 dark:text-green-400'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            {isIncome ? '+' : '-'}
            {formatCurrency(transaction.amount)}
          </Text>
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="mt-2"
            >
              <IconSymbol name="trash.fill" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {isDebt && transaction.currentBalance !== undefined && (
        <View className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <View className="flex-row justify-between">
            <Text className="text-slate-400 dark:text-slate-500 text-xs">
              Current Balance
            </Text>
            <Text className="text-slate-600 dark:text-slate-300 text-xs font-medium">
              {formatCurrency(transaction.currentBalance)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  if (onDelete) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={80}
        overshootRight={false}
      >
        {cardContent}
      </Swipeable>
    );
  }

  return cardContent;
}

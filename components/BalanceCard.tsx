import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

function BalanceCard() {
  const { currentBalance } = useFinance();
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      activeOpacity={0.8}
      className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5"
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Current Balance
          </Text>
          <Text className="text-white text-3xl font-bold">
            {formatCurrency(currentBalance)}
          </Text>
        </View>
        <View className="bg-slate-800 rounded-full p-2">
          <IconSymbol name="gearshape.fill" size={20} color="#94a3b8" />
        </View>
      </View>
      <Text className="text-slate-500 text-xs mt-2">
        Tap to update balance
      </Text>
    </TouchableOpacity>
  );
}

export default React.memo(BalanceCard);

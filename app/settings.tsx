import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/utils/financeUtils';

export default function SettingsScreen() {
  const { currentBalance, updateBalance } = useFinance();
  const router = useRouter();
  const [balance, setBalance] = useState('');

  useEffect(() => {
    setBalance(currentBalance.toString());
  }, [currentBalance]);

  const handleSave = async () => {
    const newBalance = parseFloat(balance);
    if (!isNaN(newBalance)) {
      await updateBalance(newBalance);
      router.back();
    }
  };

  const presetAmounts = [500, 1000, 2500, 5000];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50 dark:bg-slate-900"
    >
      <View className="flex-1 px-4 pt-4">
        {/* Current Balance Display */}
        <View className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 mb-6">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            Current Balance
          </Text>
          <Text className="text-white text-4xl font-bold">
            {formatCurrency(currentBalance)}
          </Text>
        </View>

        {/* Balance Input */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            New Balance
          </Text>
          <View className="flex-row items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Text className="text-slate-400 text-2xl pl-4">$</Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              className="flex-1 p-4 text-slate-800 dark:text-white text-2xl font-bold"
              autoFocus
            />
          </View>
        </View>

        {/* Quick Presets */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Quick Set
          </Text>
          <View className="flex-row gap-2">
            {presetAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                onPress={() => setBalance(amount.toString())}
                className="flex-1 bg-white dark:bg-slate-800 py-3 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-center text-slate-700 dark:text-slate-300 font-medium">
                  ${amount.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info Card */}
        <View className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 mb-6">
          <Text className="text-brand-700 dark:text-brand-300 text-sm font-medium mb-1">
            What is this?
          </Text>
          <Text className="text-brand-600 dark:text-brand-400 text-xs">
            Enter your current checking account balance. This is the starting point
            for all cash flow projections.
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          className="bg-brand-600 py-4 rounded-xl shadow-lg shadow-brand-600/30"
        >
          <Text className="text-center text-white font-bold text-lg">
            Save Balance
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

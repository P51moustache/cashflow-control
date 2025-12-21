import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFinance } from '@/context/FinanceContext';
import { Transaction, TransactionType, Frequency, DebtType } from '@/types';
import { generateUUID } from '@/utils/financeUtils';

export default function AddTransactionScreen() {
  const { addTransaction } = useFinance();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TransactionType>(TransactionType.EXPENSE);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
  const [isDebt, setIsDebt] = useState(false);
  const [debtType, setDebtType] = useState<DebtType>(DebtType.CREDIT_CARD);
  const [apr, setApr] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [projectedMonthlySpend, setProjectedMonthlySpend] = useState('');
  const [loanTermMonths, setLoanTermMonths] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !amount) return;

    const newTx: Transaction = {
      id: generateUUID(),
      name: name.trim(),
      amount: parseFloat(amount),
      type: activeTab,
      frequency,
      date: date.toISOString().split('T')[0],
      dayOfMonth:
        activeTab === TransactionType.EXPENSE && frequency === Frequency.MONTHLY
          ? date.getDate()
          : undefined,
      debtType: isDebt ? debtType : undefined,
      apr: isDebt && apr ? parseFloat(apr) : undefined,
      currentBalance: isDebt && currentBalance ? parseFloat(currentBalance) : undefined,
      creditLimit:
        isDebt && debtType === DebtType.CREDIT_CARD && creditLimit
          ? parseFloat(creditLimit)
          : undefined,
      projectedMonthlySpend:
        isDebt && debtType === DebtType.CREDIT_CARD && projectedMonthlySpend
          ? parseFloat(projectedMonthlySpend)
          : undefined,
      loanTermMonths:
        isDebt && debtType === DebtType.LOAN && loanTermMonths
          ? parseFloat(loanTermMonths)
          : undefined,
    };

    await addTransaction(newTx);
    router.back();
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const frequencies: { value: Frequency; label: string }[] = [
    { value: Frequency.ONE_TIME, label: 'One Time' },
    { value: Frequency.WEEKLY, label: 'Weekly' },
    { value: Frequency.BI_WEEKLY, label: 'Bi-Weekly' },
    { value: Frequency.MONTHLY, label: 'Monthly' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50 dark:bg-slate-900"
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4 pb-8">
          {/* Type Tabs */}
          <View className="flex-row bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6">
            <TouchableOpacity
              onPress={() => setActiveTab(TransactionType.EXPENSE)}
              className={`flex-1 py-3 rounded-lg ${
                activeTab === TransactionType.EXPENSE
                  ? 'bg-white dark:bg-slate-700 shadow-sm'
                  : ''
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === TransactionType.EXPENSE
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setActiveTab(TransactionType.INCOME);
                setIsDebt(false);
              }}
              className={`flex-1 py-3 rounded-lg ${
                activeTab === TransactionType.INCOME
                  ? 'bg-white dark:bg-slate-700 shadow-sm'
                  : ''
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === TransactionType.INCOME
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Name Field */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={
                activeTab === TransactionType.EXPENSE ? 'e.g. Rent, Netflix' : 'e.g. Paycheck'
              }
              placeholderTextColor="#94a3b8"
              className="bg-white dark:bg-slate-800 rounded-xl p-4 text-slate-800 dark:text-white font-medium border border-slate-200 dark:border-slate-700"
            />
          </View>

          {/* Amount Field */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              Amount
            </Text>
            <View className="flex-row items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Text className="text-slate-400 text-lg pl-4">$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                className="flex-1 p-4 text-slate-800 dark:text-white text-lg font-bold"
              />
            </View>
          </View>

          {/* Frequency & Date Row */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Frequency
              </Text>
              <View className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {frequencies.map((f) => (
                  <TouchableOpacity
                    key={f.value}
                    onPress={() => setFrequency(f.value)}
                    className={`p-3 border-b border-slate-100 dark:border-slate-700 ${
                      frequency === f.value ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    }`}
                  >
                    <Text
                      className={`text-center text-sm ${
                        frequency === f.value
                          ? 'text-brand-600 dark:text-brand-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Next Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-slate-800 dark:text-white text-center font-medium">
                  {date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
              )}
            </View>
          </View>

          {/* Debt Tracking (Expense only) */}
          {activeTab === TransactionType.EXPENSE && (
            <View className="mb-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Track as Debt
                  </Text>
                  <Text className="text-xs text-slate-400 dark:text-slate-500">
                    Enable to track balance & interest
                  </Text>
                </View>
                <Switch
                  value={isDebt}
                  onValueChange={setIsDebt}
                  trackColor={{ false: '#cbd5e1', true: '#0d9488' }}
                  thumbColor="#ffffff"
                />
              </View>

              {isDebt && (
                <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                  {/* Debt Type Selector */}
                  <View className="flex-row gap-2 mb-4">
                    <TouchableOpacity
                      onPress={() => setDebtType(DebtType.CREDIT_CARD)}
                      className={`flex-1 py-2 rounded-lg border ${
                        debtType === DebtType.CREDIT_CARD
                          ? 'bg-white dark:bg-slate-700 border-brand-200 dark:border-brand-700'
                          : 'border-transparent'
                      }`}
                    >
                      <Text
                        className={`text-center text-xs font-bold ${
                          debtType === DebtType.CREDIT_CARD
                            ? 'text-brand-700 dark:text-brand-300'
                            : 'text-slate-400'
                        }`}
                      >
                        Credit Card
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setDebtType(DebtType.LOAN)}
                      className={`flex-1 py-2 rounded-lg border ${
                        debtType === DebtType.LOAN
                          ? 'bg-white dark:bg-slate-700 border-brand-200 dark:border-brand-700'
                          : 'border-transparent'
                      }`}
                    >
                      <Text
                        className={`text-center text-xs font-bold ${
                          debtType === DebtType.LOAN
                            ? 'text-brand-700 dark:text-brand-300'
                            : 'text-slate-400'
                        }`}
                      >
                        Loan
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* APR & Balance Row */}
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-slate-500 mb-1">
                        APR (%)
                      </Text>
                      <TextInput
                        value={apr}
                        onChangeText={setApr}
                        keyboardType="decimal-pad"
                        placeholder="19.99"
                        placeholderTextColor="#94a3b8"
                        className="bg-white dark:bg-slate-700 rounded-lg p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-slate-500 mb-1">
                        Current Balance
                      </Text>
                      <TextInput
                        value={currentBalance}
                        onChangeText={setCurrentBalance}
                        keyboardType="decimal-pad"
                        placeholder="2500"
                        placeholderTextColor="#94a3b8"
                        className="bg-white dark:bg-slate-700 rounded-lg p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
                      />
                    </View>
                  </View>

                  {/* Credit Card specific fields */}
                  {debtType === DebtType.CREDIT_CARD && (
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-slate-500 mb-1">
                          Credit Limit
                        </Text>
                        <TextInput
                          value={creditLimit}
                          onChangeText={setCreditLimit}
                          keyboardType="decimal-pad"
                          placeholder="5000"
                          placeholderTextColor="#94a3b8"
                          className="bg-white dark:bg-slate-700 rounded-lg p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-slate-500 mb-1">
                          Monthly Spend
                        </Text>
                        <TextInput
                          value={projectedMonthlySpend}
                          onChangeText={setProjectedMonthlySpend}
                          keyboardType="decimal-pad"
                          placeholder="500"
                          placeholderTextColor="#94a3b8"
                          className="bg-white dark:bg-slate-700 rounded-lg p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
                        />
                      </View>
                    </View>
                  )}

                  {/* Loan specific fields */}
                  {debtType === DebtType.LOAN && (
                    <View>
                      <Text className="text-xs font-semibold text-slate-500 mb-1">
                        Loan Term (months)
                      </Text>
                      <TextInput
                        value={loanTermMonths}
                        onChangeText={setLoanTermMonths}
                        keyboardType="number-pad"
                        placeholder="60"
                        placeholderTextColor="#94a3b8"
                        className="bg-white dark:bg-slate-700 rounded-lg p-3 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!name.trim() || !amount}
            className={`py-4 rounded-xl mt-4 ${
              name.trim() && amount
                ? 'bg-brand-600 shadow-lg shadow-brand-600/30'
                : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <Text
              className={`text-center font-bold text-lg ${
                name.trim() && amount ? 'text-white' : 'text-slate-400'
              }`}
            >
              Add Transaction
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

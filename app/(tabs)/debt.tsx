import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/utils/financeUtils';
import { getCreditCards } from '@/utils/debtProjectionUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';
import DebtStrategySelector from '@/components/DebtStrategySelector';
import PaymentBudgetCard from '@/components/PaymentBudgetCard';
import MonthlyBudgetCard from '@/components/MonthlyBudgetCard';
import EnhancedDebtCard from '@/components/EnhancedDebtCard';
import PayoffTimeline from '@/components/PayoffTimeline';
import StrategyComparisonModal from '@/components/StrategyComparisonModal';

export default function DebtScreen() {
  const {
    transactions,
    isLoading,
    debtSettings,
    debtProjection,
    updateDebtSettings,
    updateTransaction,
    refresh,
  } = useFinance();

  const router = useRouter();
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Get credit cards only (not loans for now)
  const creditCards = getCreditCards(transactions);
  const totalDebt = creditCards.reduce((sum, t) => sum + (t.currentBalance || 0), 0);
  const totalMonthlyPayments = debtProjection?.totalMonthlyPayments ?? 0;

  // Calculate Blended APR
  const blendedAPR =
    totalDebt > 0
      ? creditCards.reduce(
          (acc, t) => acc + (t.apr || 0) * (t.currentBalance || 0),
          0
        ) / totalDebt
      : 0;

  const handleStrategyChange = async (strategy: typeof debtSettings.payoffStrategy) => {
    await updateDebtSettings({ payoffStrategy: strategy });
  };

  const handleBudgetChange = async (budget: number) => {
    await updateDebtSettings({ totalMonthlyBudget: budget });
  };

  const handlePaymentBudgetChange = async (budget: number) => {
    await updateDebtSettings({ totalMonthlyPaymentBudget: budget });
  };

  const handlePercentageChange = async (cardId: string, percentage: number) => {
    const card = creditCards.find(c => c.id === cardId);
    if (card) {
      await updateTransaction({ ...card, spendingPercentage: percentage });
    }
  };

  const handleMinimumPaymentChange = async (cardId: string, amount: number) => {
    const card = creditCards.find(c => c.id === cardId);
    if (card) {
      await updateTransaction({ ...card, minimumPayment: amount });
    }
  };

  const handleExtraPaymentChange = async (cardId: string, amount: number) => {
    const card = creditCards.find(c => c.id === cardId);
    if (card) {
      await updateTransaction({ ...card, extraPayment: amount });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#0d9488" />
      </SafeAreaView>
    );
  }

  if (creditCards.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="opacity-20 mb-4">
            <IconSymbol name="creditcard.fill" size={64} color="#94a3b8" />
          </View>
          <Text className="text-slate-400 dark:text-slate-500 text-center text-lg mb-2">
            No credit cards tracked yet
          </Text>
          <Text className="text-slate-300 dark:text-slate-600 text-center text-sm mb-6">
            Add an expense and enable "Track as Debt" to see payoff projections here
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/add-transaction')}
            className="bg-brand-600 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold text-base">Add a Credit Card</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0d9488"
            colors={['#0d9488']}
          />
        }
      >
        <View className="px-4 pt-2 pb-24">
          {/* Header Stats Card */}
          <View className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 mb-4 relative overflow-hidden">
            <View className="absolute top-0 right-0 p-4 opacity-10">
              <IconSymbol name="chart.line.uptrend.xyaxis" size={80} color="#ffffff" />
            </View>
            <View className="relative z-10">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                Total Credit Card Debt
              </Text>
              <Text className="text-white text-3xl font-bold mb-4">
                {formatCurrency(totalDebt)}
              </Text>
              <View className="flex-row gap-6">
                <View>
                  <Text className="text-slate-400 text-[10px] uppercase">
                    Blended APR
                  </Text>
                  <Text className="font-mono font-bold text-lg text-brand-300">
                    {blendedAPR.toFixed(1)}%
                  </Text>
                </View>
                <View>
                  <Text className="text-slate-400 text-[10px] uppercase">
                    Monthly Payments
                  </Text>
                  <Text className="font-mono font-bold text-lg text-white">
                    {formatCurrency(totalMonthlyPayments)}
                  </Text>
                </View>
                <View>
                  <Text className="text-slate-400 text-[10px] uppercase">
                    Monthly Interest
                  </Text>
                  <Text className="font-mono font-bold text-lg text-red-400">
                    {formatCurrency(debtProjection?.monthlyInterestCost ?? 0)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Strategy Selector */}
          <View className="mb-4">
            <DebtStrategySelector
              selectedStrategy={debtSettings.payoffStrategy}
              onSelect={handleStrategyChange}
              onComparePress={() => setShowComparisonModal(true)}
            />
          </View>

          {/* Payment Budget Card - How much you can pay toward cards */}
          <View className="mb-4">
            <PaymentBudgetCard
              totalPaymentBudget={debtSettings.totalMonthlyPaymentBudget}
              onPaymentBudgetChange={handlePaymentBudgetChange}
              creditCards={creditCards}
              strategy={debtSettings.payoffStrategy}
            />
          </View>

          {/* Monthly Budget Card - New spending on cards */}
          <View className="mb-4">
            <MonthlyBudgetCard
              totalBudget={debtSettings.totalMonthlyBudget}
              onBudgetChange={handleBudgetChange}
              creditCards={creditCards}
              onPercentageChange={handlePercentageChange}
            />
          </View>

          {/* Payoff Timeline */}
          {debtProjection && debtProjection.projections.length > 0 && (
            <View className="mb-4">
              <PayoffTimeline
                projections={debtProjection.projections}
                totalInterestCost={debtProjection.totalInterestCost}
              />
            </View>
          )}

          {/* Section Title */}
          <Text className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 mt-2">
            Your Credit Cards
          </Text>

          {/* Credit Card Cards */}
          {creditCards.map((card) => {
            const projection = debtProjection?.projections.find(
              p => p.cardId === card.id
            );
            return (
              <EnhancedDebtCard
                key={card.id}
                card={card}
                projection={projection}
                onMinimumPaymentChange={handleMinimumPaymentChange}
                onExtraPaymentChange={handleExtraPaymentChange}
              />
            );
          })}

          {/* Tip */}
          <View className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 mt-2">
            <Text className="text-brand-700 dark:text-brand-300 text-sm font-medium mb-1">
              How Projections Work
            </Text>
            <Text className="text-brand-600 dark:text-brand-400 text-xs">
              Set your monthly CC spending budget and allocate it across cards. Enter your minimum
              payment for each card. Use "Compare" to see how different strategies affect your payoff.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Strategy Comparison Modal */}
      <StrategyComparisonModal
        visible={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        transactions={transactions}
        debtSettings={debtSettings}
        currentStrategy={debtSettings.payoffStrategy}
        onSelectStrategy={handleStrategyChange}
      />
    </SafeAreaView>
  );
}

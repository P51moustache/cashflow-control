import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Platform,
  Animated,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFinance } from '@/context/FinanceContext';
import { Transaction, TransactionType, Frequency } from '@/types';
import { generateUUID } from '@/utils/financeUtils';
import { setOnboardingComplete } from '@/utils/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Slide data ---

interface SlideData {
  icon: string;
  title: string;
  description: string;
}

const slides: SlideData[] = [
  {
    icon: 'chart.line.uptrend.xyaxis',
    title: 'Track Your Cashflow',
    description:
      "See exactly where your money goes and what's coming up. Never be surprised by a bill again.",
  },
  {
    icon: 'creditcard.fill',
    title: 'Crush Your Debt',
    description:
      'Compare payoff strategies and find the fastest, cheapest path to being debt-free.',
  },
  {
    icon: 'calendar.badge.clock',
    title: 'See Your Future Balance',
    description:
      'Project your balance days and weeks ahead so you always know where you stand.',
  },
];

// --- Frequency options ---

const frequencyOptions: { value: Frequency; label: string }[] = [
  { value: Frequency.WEEKLY, label: 'Weekly' },
  { value: Frequency.BI_WEEKLY, label: 'Bi-Weekly' },
  { value: Frequency.MONTHLY, label: 'Monthly' },
];

// --- Component ---

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { addTransaction, updateBalance } = useFinance();

  // --- Intro slides state ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideScrollRef = useRef<ScrollView>(null);
  const [showSetup, setShowSetup] = useState(false);

  // --- Setup wizard state ---
  const [setupStep, setSetupStep] = useState(0);
  const stepFadeAnim = useRef(new Animated.Value(1)).current;

  // Step 1: Balance
  const [balance, setBalance] = useState('');

  // Step 2: Income
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<Frequency>(Frequency.MONTHLY);

  // Step 3: Expense
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseFrequency, setExpenseFrequency] = useState<Frequency>(Frequency.MONTHLY);

  // --- Handlers ---

  const onSlideScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentSlide && index >= 0 && index < slides.length) {
        setCurrentSlide(index);
      }
    },
    [currentSlide]
  );

  const goToSlide = useCallback((index: number) => {
    slideScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setCurrentSlide(index);
  }, []);

  const startSetup = useCallback(() => {
    setShowSetup(true);
  }, []);

  const skipOnboarding = useCallback(async () => {
    await setOnboardingComplete();
    router.replace('/(tabs)');
  }, [router]);

  const animateStepTransition = useCallback(
    (nextStep: number) => {
      Animated.timing(stepFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setSetupStep(nextStep);
        Animated.timing(stepFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [stepFadeAnim]
  );

  const handleBalanceContinue = useCallback(() => {
    animateStepTransition(1);
  }, [animateStepTransition]);

  const handleAddIncome = useCallback(() => {
    animateStepTransition(2);
  }, [animateStepTransition]);

  const handleAddExpense = useCallback(async () => {
    // Save everything and finish
    try {
      // Save balance if provided
      const parsedBalance = parseFloat(balance);
      if (!isNaN(parsedBalance) && parsedBalance >= 0) {
        await updateBalance(parsedBalance);
      }

      // Save income if provided
      const parsedIncomeAmount = parseFloat(incomeAmount);
      if (incomeName.trim() && !isNaN(parsedIncomeAmount) && parsedIncomeAmount > 0) {
        const today = new Date();
        const incomeTx: Transaction = {
          id: generateUUID(),
          name: incomeName.trim(),
          amount: parsedIncomeAmount,
          type: TransactionType.INCOME,
          frequency: incomeFrequency,
          date: today.toISOString().split('T')[0],
          dayOfMonth:
            incomeFrequency === Frequency.MONTHLY ? today.getDate() : undefined,
        };
        await addTransaction(incomeTx);
      }

      // Save expense if provided
      const parsedExpenseAmount = parseFloat(expenseAmount);
      if (expenseName.trim() && !isNaN(parsedExpenseAmount) && parsedExpenseAmount > 0) {
        const today = new Date();
        const expenseTx: Transaction = {
          id: generateUUID(),
          name: expenseName.trim(),
          amount: parsedExpenseAmount,
          type: TransactionType.EXPENSE,
          frequency: expenseFrequency,
          date: today.toISOString().split('T')[0],
          dayOfMonth:
            expenseFrequency === Frequency.MONTHLY ? today.getDate() : undefined,
        };
        await addTransaction(expenseTx);
      }

      await setOnboardingComplete();
      router.replace('/(tabs)');
    } catch (error) {
      // If saving fails, still mark onboarding done so they're not stuck
      console.error('Error saving onboarding data:', error);
      await setOnboardingComplete();
      router.replace('/(tabs)');
    }
  }, [
    balance,
    incomeName,
    incomeAmount,
    incomeFrequency,
    expenseName,
    expenseAmount,
    expenseFrequency,
    updateBalance,
    addTransaction,
    router,
  ]);

  // --- Render: Intro Slides ---

  if (!showSetup) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
        edges={['top', 'bottom']}
      >
        {/* Skip Button */}
        <View className="flex-row justify-end px-6 pt-2">
          <TouchableOpacity
            onPress={skipOnboarding}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="py-2 px-4"
          >
            <Text className="text-brand-600 dark:text-brand-400 font-semibold text-base">
              Skip
            </Text>
          </TouchableOpacity>
        </View>

        {/* Slides */}
        <ScrollView
          ref={slideScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onSlideScroll}
          scrollEventThrottle={16}
          bounces={false}
          className="flex-1"
        >
          {slides.map((slide, index) => (
            <View
              key={index}
              style={{ width: SCREEN_WIDTH }}
              className="flex-1 items-center justify-center px-10"
            >
              <View
                className="w-28 h-28 rounded-3xl items-center justify-center mb-10"
                style={{
                  backgroundColor: isDark
                    ? 'rgba(20, 184, 166, 0.15)'
                    : 'rgba(13, 148, 136, 0.1)',
                }}
              >
                <IconSymbol
                  name={slide.icon as any}
                  size={56}
                  color={isDark ? '#2dd4bf' : '#0d9488'}
                />
              </View>
              <Text
                className={`text-3xl font-bold text-center mb-4 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {slide.title}
              </Text>
              <Text
                className={`text-lg text-center leading-7 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
                style={{ maxWidth: 320 }}
              >
                {slide.description}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Bottom: Dots or Get Started */}
        <View className="pb-8 px-6">
          {currentSlide === slides.length - 1 ? (
            // Last slide: "Get Started" button
            <TouchableOpacity
              onPress={startSetup}
              activeOpacity={0.8}
              className="bg-brand-600 rounded-2xl"
              style={{ paddingVertical: 18 }}
            >
              <Text className="text-center font-bold text-lg text-white tracking-wide">
                Get Started
              </Text>
            </TouchableOpacity>
          ) : (
            // Dots + Next
            <View className="items-center">
              <View className="flex-row items-center mb-6">
                {slides.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => goToSlide(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <View
                      className={`rounded-full mx-1.5 ${
                        index === currentSlide
                          ? 'bg-brand-600'
                          : isDark
                            ? 'bg-slate-700'
                            : 'bg-slate-300'
                      }`}
                      style={{
                        width: index === currentSlide ? 28 : 8,
                        height: 8,
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => goToSlide(currentSlide + 1)}
                activeOpacity={0.8}
                className="bg-brand-600 rounded-2xl w-full"
                style={{ paddingVertical: 18 }}
              >
                <Text className="text-center font-bold text-lg text-white tracking-wide">
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --- Render: Setup Wizard ---

  const stepTitles = [
    "What's your current\nbank balance?",
    'Add your main income',
    'Add your first expense',
  ];

  const stepSubtitles = [
    "We'll use this as your starting point.",
    "We'll project this into your cashflow.",
    "We'll track when this is due.",
  ];

  const stepNumbers = ['1 of 3', '2 of 3', '3 of 3'];

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Progress bar */}
        <View className="px-6 pt-4 pb-2">
          <View className="flex-row justify-between items-center mb-3">
            <Text
              className={`text-sm font-semibold ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Step {stepNumbers[setupStep]}
            </Text>
            <TouchableOpacity
              onPress={
                setupStep === 0
                  ? skipOnboarding
                  : () => animateStepTransition(setupStep + 1 < 3 ? setupStep + 1 : setupStep)
              }
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text className="text-brand-600 dark:text-brand-400 font-semibold text-sm">
                {setupStep === 2 ? '' : 'Skip'}
              </Text>
            </TouchableOpacity>
          </View>
          <View
            className={`h-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
          >
            <View
              className="h-1 rounded-full bg-brand-600"
              style={{ width: `${((setupStep + 1) / 3) * 100}%` }}
            />
          </View>
        </View>

        <Animated.View
          className="flex-1 px-6 pt-6"
          style={{ opacity: stepFadeAnim }}
        >
          {/* Step header */}
          <Text
            className={`text-2xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {stepTitles[setupStep]}
          </Text>
          <Text
            className={`text-base mb-8 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {stepSubtitles[setupStep]}
          </Text>

          {/* Step 1: Balance */}
          {setupStep === 0 && (
            <View>
              <View
                className={`flex-row items-center rounded-2xl border-2 ${
                  isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}
                style={{ paddingVertical: 4 }}
              >
                <Text
                  className={`text-3xl font-bold pl-5 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  $
                </Text>
                <TextInput
                  value={balance}
                  onChangeText={setBalance}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  autoFocus
                  className={`flex-1 text-3xl font-bold p-4 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                />
              </View>

              <TouchableOpacity
                onPress={handleBalanceContinue}
                activeOpacity={0.8}
                className="bg-brand-600 rounded-2xl mt-8"
                style={{ paddingVertical: 18 }}
              >
                <Text className="text-center font-bold text-lg text-white tracking-wide">
                  Continue
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => animateStepTransition(1)}
                className="mt-4 py-3"
              >
                <Text
                  className={`text-center font-medium ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Skip for now
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Income */}
          {setupStep === 1 && (
            <View>
              {/* Name */}
              <Text
                className={`text-xs font-bold uppercase mb-2 tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Name
              </Text>
              <TextInput
                value={incomeName}
                onChangeText={setIncomeName}
                placeholder="Paycheck"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                autoFocus
                className={`rounded-xl p-4 text-base font-medium mb-4 border ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              />

              {/* Amount */}
              <Text
                className={`text-xs font-bold uppercase mb-2 tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Amount
              </Text>
              <View
                className={`flex-row items-center rounded-xl border mb-4 ${
                  isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-lg pl-4 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  $
                </Text>
                <TextInput
                  value={incomeAmount}
                  onChangeText={setIncomeAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  className={`flex-1 p-4 text-lg font-bold ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                />
              </View>

              {/* Frequency */}
              <Text
                className={`text-xs font-bold uppercase mb-2 tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Frequency
              </Text>
              <View className="flex-row gap-2 mb-6">
                {frequencyOptions.map((f) => (
                  <TouchableOpacity
                    key={f.value}
                    onPress={() => setIncomeFrequency(f.value)}
                    className={`flex-1 py-3 rounded-xl border ${
                      incomeFrequency === f.value
                        ? 'bg-brand-600 border-brand-600'
                        : isDark
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        incomeFrequency === f.value
                          ? 'text-white'
                          : isDark
                            ? 'text-slate-300'
                            : 'text-slate-600'
                      }`}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleAddIncome}
                activeOpacity={0.8}
                className="bg-brand-600 rounded-2xl"
                style={{ paddingVertical: 18 }}
              >
                <Text className="text-center font-bold text-lg text-white tracking-wide">
                  Add Income
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => animateStepTransition(2)}
                className="mt-4 py-3"
              >
                <Text
                  className={`text-center font-medium ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Skip for now
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Expense */}
          {setupStep === 2 && (
            <View>
              {/* Name */}
              <Text
                className={`text-xs font-bold uppercase mb-2 tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Name
              </Text>
              <TextInput
                value={expenseName}
                onChangeText={setExpenseName}
                placeholder="Rent"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                autoFocus
                className={`rounded-xl p-4 text-base font-medium mb-4 border ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              />

              {/* Amount */}
              <Text
                className={`text-xs font-bold uppercase mb-2 tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Amount
              </Text>
              <View
                className={`flex-row items-center rounded-xl border mb-4 ${
                  isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-lg pl-4 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  $
                </Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  className={`flex-1 p-4 text-lg font-bold ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                />
              </View>

              {/* Frequency */}
              <Text
                className={`text-xs font-bold uppercase mb-2 tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Frequency
              </Text>
              <View className="flex-row gap-2 mb-6">
                {frequencyOptions.map((f) => (
                  <TouchableOpacity
                    key={f.value}
                    onPress={() => setExpenseFrequency(f.value)}
                    className={`flex-1 py-3 rounded-xl border ${
                      expenseFrequency === f.value
                        ? 'bg-brand-600 border-brand-600'
                        : isDark
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        expenseFrequency === f.value
                          ? 'text-white'
                          : isDark
                            ? 'text-slate-300'
                            : 'text-slate-600'
                      }`}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleAddExpense}
                activeOpacity={0.8}
                className="bg-brand-600 rounded-2xl"
                style={{ paddingVertical: 18 }}
              >
                <Text className="text-center font-bold text-lg text-white tracking-wide">
                  Finish Setup
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  // Save balance and income if entered, skip expense
                  try {
                    const parsedBalance = parseFloat(balance);
                    if (!isNaN(parsedBalance) && parsedBalance >= 0) {
                      await updateBalance(parsedBalance);
                    }

                    const parsedIncomeAmount = parseFloat(incomeAmount);
                    if (
                      incomeName.trim() &&
                      !isNaN(parsedIncomeAmount) &&
                      parsedIncomeAmount > 0
                    ) {
                      const today = new Date();
                      const incomeTx: Transaction = {
                        id: generateUUID(),
                        name: incomeName.trim(),
                        amount: parsedIncomeAmount,
                        type: TransactionType.INCOME,
                        frequency: incomeFrequency,
                        date: today.toISOString().split('T')[0],
                        dayOfMonth:
                          incomeFrequency === Frequency.MONTHLY
                            ? today.getDate()
                            : undefined,
                      };
                      await addTransaction(incomeTx);
                    }
                  } catch (error) {
                    console.error('Error saving partial onboarding data:', error);
                  }

                  await setOnboardingComplete();
                  router.replace('/(tabs)');
                }}
                className="mt-4 py-3"
              >
                <Text
                  className={`text-center font-medium ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Skip for now
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

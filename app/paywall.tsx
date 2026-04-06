import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import { useSubscription } from '@/context/SubscriptionContext';
import { track } from '@/lib/analytics';

const TERMS_URL = 'https://cashflowcontrol.app/terms';
const PRIVACY_URL = 'https://cashflowcontrol.app/privacy';

interface ValuePropProps {
  icon: string;
  title: string;
  description: string;
  isDark: boolean;
}

function ValuePropCard({ icon, title, description, isDark }: ValuePropProps) {
  return (
    <View
      className={`flex-row items-start p-4 rounded-2xl mb-3 ${
        isDark ? 'bg-slate-800/80' : 'bg-white'
      }`}
      style={
        isDark
          ? undefined
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 2,
            }
      }
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center mr-4 mt-0.5"
        style={{
          backgroundColor: isDark ? 'rgba(20, 184, 166, 0.15)' : 'rgba(13, 148, 136, 0.08)',
        }}
      >
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-bold mb-1 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {title}
        </Text>
        <Text
          className={`text-sm leading-5 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function PaywallScreen() {
  const { subscribe, restore, currentPackagePrice } = useSubscription();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    track('paywall_shown');
  }, []);

  const displayPrice = currentPackagePrice || '$4.99';

  const handleSubscribe = async () => {
    if (isPurchasing || isRestoring) return;

    setIsPurchasing(true);
    try {
      const success = await subscribe();
      if (!success) {
        // User cancelled — do nothing
      }
    } catch (error: any) {
      Alert.alert(
        'Purchase Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (isPurchasing || isRestoring) return;

    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert('Restored', 'Your subscription has been restored.', [{ text: 'OK' }]);
      } else {
        Alert.alert(
          'No Subscription Found',
          'We could not find an active subscription for your account. If you believe this is an error, please contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Restore Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="flex-1 px-6 pt-16 pb-8">
          {/* Brand Header */}
          <View className="items-center mb-8">
            <View className="bg-brand-600 w-16 h-16 rounded-2xl items-center justify-center mb-4">
              <Text className="text-white text-2xl font-bold">$</Text>
            </View>
            <Text className="text-brand-600 dark:text-brand-400 text-3xl font-bold mb-2">
              Cashflow Control
            </Text>
            <Text
              className={`text-base text-center ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Take control of your financial future
            </Text>
          </View>

          {/* Value Propositions */}
          <View className="mb-6">
            <ValuePropCard
              icon={"\u{1F4C8}"}
              title="Smart Cashflow Projections"
              description="See exactly where your money will be days and weeks ahead"
              isDark={isDark}
            />
            <ValuePropCard
              icon={"\u{1F4B3}"}
              title="Debt Payoff Strategies"
              description="Compare avalanche, snowball, and minimum payments to find the fastest path to debt-free"
              isDark={isDark}
            />
            <ValuePropCard
              icon={"\u{2601}\uFE0F"}
              title="Cloud Sync"
              description="Your data backed up and synced across all your devices"
              isDark={isDark}
            />
          </View>

          {/* Price Card */}
          <View
            className={`rounded-2xl p-6 mb-6 border-2 border-brand-500 ${
              isDark ? 'bg-slate-800' : 'bg-white'
            }`}
            style={
              isDark
                ? undefined
                : {
                    shadowColor: '#14b8a6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 4,
                  }
            }
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className={`text-sm font-bold uppercase tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Monthly
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: isDark ? 'rgba(45, 212, 191, 0.1)' : 'rgba(20, 184, 166, 0.1)' }}
              >
                <Text className="text-brand-600 dark:text-brand-400 text-xs font-bold">
                  Most Popular
                </Text>
              </View>
            </View>
            <View className="flex-row items-baseline mb-2">
              <Text
                className={`text-4xl font-extrabold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {displayPrice}
              </Text>
              <Text
                className={`text-base ml-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                /month
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-brand-500 mr-2" />
              <Text
                className={`text-sm ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                7-day free trial included
              </Text>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={isPurchasing || isRestoring}
            activeOpacity={0.8}
            className={`rounded-2xl mb-4 ${
              isPurchasing ? 'bg-brand-400 dark:bg-brand-800' : 'bg-brand-600'
            }`}
            style={{ paddingVertical: 18 }}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-center font-bold text-lg text-white tracking-wide">
                Start Your Free Trial
              </Text>
            )}
          </TouchableOpacity>

          {/* Restore Purchases */}
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isPurchasing || isRestoring}
            activeOpacity={0.6}
            className="py-3 mb-6"
          >
            {isRestoring ? (
              <ActivityIndicator
                color={isDark ? '#94a3b8' : '#64748b'}
                size="small"
              />
            ) : (
              <Text
                className={`text-center text-sm font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>

          {/* Spacer to push legal to bottom */}
          <View className="flex-1" />

          {/* Legal Links */}
          <View className="items-center pb-4">
            <Text
              className={`text-xs text-center mb-2 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Recurring billing. Cancel anytime.
            </Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => Linking.openURL(TERMS_URL)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  className={`text-xs ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Terms of Service
                </Text>
              </TouchableOpacity>
              <Text
                className={`mx-2 text-xs ${
                  isDark ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                |
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(PRIVACY_URL)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  className={`text-xs ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

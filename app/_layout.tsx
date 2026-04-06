import "@/global.css";
import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { FinanceProvider } from '@/context/FinanceContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import { hasCompletedOnboarding } from '@/utils/onboarding';

/**
 * Handles onboarding gating: redirects to onboarding if user hasn't completed it.
 * Onboarding runs BEFORE auth/subscription gates.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hasCompletedOnboarding().then(setHasOnboarded);
  }, []);

  useEffect(() => {
    if (hasOnboarded === null) return; // Still loading

    const onOnboarding = segments[0] === 'onboarding';

    if (!hasOnboarded && !onOnboarding) {
      router.replace('/onboarding');
    } else if (hasOnboarded && onOnboarding) {
      // Onboarding complete — move to main app (auth will gate from here)
      router.replace('/(tabs)');
    }
  }, [hasOnboarded, segments]);

  return <>{children}</>;
}

/**
 * Handles paywall gating: redirects to paywall when subscription is inactive.
 * Only gates users who are already authenticated (auth gating is separate).
 */
function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { isSubscribed, isTrialing, isLoading: subLoading } = useSubscription();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait for both auth and subscription to finish loading
    if (authLoading || subLoading) return;

    // Only gate authenticated users (let auth flow handle unauthenticated)
    if (!isAuthenticated) return;

    const onPaywall = segments[0] === 'paywall';
    const inAuthGroup = segments[0] === 'auth';
    const onOnboarding = segments[0] === 'onboarding';

    // Don't interfere with auth screens or onboarding
    if (inAuthGroup || onOnboarding) return;

    if (!isSubscribed && !isTrialing && !onPaywall) {
      // User needs to subscribe — redirect to paywall
      router.replace('/paywall');
    } else if ((isSubscribed || isTrialing) && onPaywall) {
      // User became subscribed while on paywall — send to app
      router.replace('/(tabs)');
    }
  }, [isSubscribed, isTrialing, subLoading, authLoading, isAuthenticated, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <FinanceProvider>
          <OnboardingGate>
            <AuthProvider>
              <SubscriptionProvider>
                <SubscriptionGate>
                  <Stack>
                    <Stack.Screen
                      name="onboarding"
                      options={{
                        headerShown: false,
                        gestureEnabled: false,
                      }}
                    />
                    <Stack.Screen name="auth" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="paywall"
                      options={{
                        presentation: 'fullScreenModal',
                        headerShown: false,
                        gestureEnabled: false,
                      }}
                    />
                    <Stack.Screen
                      name="add-transaction"
                      options={{
                        presentation: 'modal',
                        title: 'Add Transaction',
                        headerShown: true,
                      }}
                    />
                    <Stack.Screen
                      name="settings"
                      options={{
                        presentation: 'card',
                        title: 'Settings',
                        headerShown: true,
                      }}
                    />
                  </Stack>
                </SubscriptionGate>
                <StatusBar style="auto" />
                <Toast />
              </SubscriptionProvider>
            </AuthProvider>
          </OnboardingGate>
        </FinanceProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

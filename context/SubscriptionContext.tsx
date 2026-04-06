import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { track } from '@/lib/analytics';

// Conditionally import Purchases to avoid crashes when not configured
let Purchases: typeof import('react-native-purchases').default | null = null;

try {
  const purchasesModule = require('react-native-purchases');
  Purchases = purchasesModule.default;
} catch {
  // RevenueCat not available — dev mode will handle this
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  isLoading: boolean;
  currentPackagePrice: string | null;
  subscribe: () => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
const ENTITLEMENT_ID = 'pro';

// Dev mode: if no API key is set, bypass subscription entirely
const isDevMode = !REVENUECAT_API_KEY;

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(isDevMode);
  const [isTrialing, setIsTrialing] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(!isDevMode);
  const [currentPackagePrice, setCurrentPackagePrice] = useState<string | null>(null);

  // Initialize RevenueCat and check subscription status
  useEffect(() => {
    if (isDevMode || !Purchases) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        // Configure Purchases SDK
        Purchases!.configure({
          apiKey: REVENUECAT_API_KEY,
        });

        // Fetch current offerings to get pricing
        const offerings = await Purchases!.getOfferings();
        if (offerings.current) {
          const monthlyPackage = offerings.current.monthly;
          if (monthlyPackage) {
            setCurrentPackagePrice(monthlyPackage.product.priceString);
          }
        }

        // Check current customer info
        const customerInfo = await Purchases!.getCustomerInfo();
        updateSubscriptionState(customerInfo);
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
        // If RevenueCat fails to initialize, don't block the app
        // but keep isSubscribed as false so paywall shows
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Listen for customer info updates (e.g., subscription renewal, expiration)
    const listener = (customerInfo: any) => {
      updateSubscriptionState(customerInfo);
    };

    Purchases!.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases!.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const updateSubscriptionState = useCallback((customerInfo: any) => {
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement) {
      setIsSubscribed(true);

      // Check if currently in trial period
      // RevenueCat marks trial via the periodType property
      const periodType = entitlement.periodType;
      const isTrial = periodType === 'TRIAL';
      setIsTrialing(isTrial);

      if (isTrial && entitlement.expirationDate) {
        const expirationDate = new Date(entitlement.expirationDate);
        const now = new Date();
        const diffTime = expirationDate.getTime() - now.getTime();
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        setTrialDaysLeft(diffDays);
      } else {
        setTrialDaysLeft(0);
      }
    } else {
      setIsSubscribed(false);
      setIsTrialing(false);
      setTrialDaysLeft(0);
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (isDevMode || !Purchases) return true;

    try {
      const offerings = await Purchases!.getOfferings();
      if (!offerings.current?.monthly) {
        console.error('No monthly package available');
        return false;
      }

      const { customerInfo } = await Purchases!.purchasePackage(
        offerings.current.monthly
      );

      updateSubscriptionState(customerInfo);
      const isActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (isActive) {
        track('subscription_started');
      }
      return isActive;
    } catch (error: any) {
      // User cancelled purchase — not an error
      if (error.userCancelled) {
        return false;
      }
      console.error('Purchase failed:', error);
      throw error;
    }
  }, [updateSubscriptionState]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (isDevMode || !Purchases) return true;

    try {
      const customerInfo = await Purchases!.restorePurchases();
      updateSubscriptionState(customerInfo);
      const isActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (isActive) {
        track('subscription_restored');
      }
      return isActive;
    } catch (error) {
      console.error('Restore purchases failed:', error);
      throw error;
    }
  }, [updateSubscriptionState]);

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isTrialing,
        trialDaysLeft,
        isLoading,
        currentPackagePrice,
        subscribe,
        restore,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

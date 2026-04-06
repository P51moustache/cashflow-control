import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isSupabaseConfigured = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

function useProtectedRoute(isAuthenticated: boolean, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const onOnboarding = segments[0] === 'onboarding';

    // Don't interfere with onboarding flow
    if (onOnboarding) return;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // If Supabase is not configured, skip auth entirely (dev mode)
  const isAuthenticated = !isSupabaseConfigured ? true : !!session;

  useProtectedRoute(isAuthenticated, isLoading);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signInWithApple = async () => {
    if (!isSupabaseConfigured) return;
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign In is only available on iOS');
    }

    try {
      const AppleAuthentication = await import('expo-apple-authentication');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err: any) {
      // User cancelled the Apple Sign In flow
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      throw err;
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (error) {
      throw new Error(error.message);
    }
  };

  const deleteAccount = async () => {
    if (!isSupabaseConfigured) return;

    Alert.alert(
      'Delete Account',
      'To delete your account and all associated data, please contact support at support@cashflowcontrol.app. Your data will be removed within 30 days.',
      [{ text: 'OK' }]
    );

    // Sign the user out after showing the message
    await signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated,
        signInWithEmail,
        signUpWithEmail,
        signInWithApple,
        signOut,
        resetPassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

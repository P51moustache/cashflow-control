import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function SignUpScreen() {
  const { signUpWithEmail, signInWithApple } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const validate = (): boolean => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!password) {
      setError('Please enter a password');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    if (isLoading || isAppleLoading) return;

    setError('');
    setSuccessMessage('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      await signUpWithEmail(email, password);
      setSuccessMessage(
        'Account created! Check your email to verify your account before signing in.'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isLoading || isAppleLoading) return;

    setError('');
    setSuccessMessage('');
    setIsAppleLoading(true);
    try {
      await signInWithApple();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Apple. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const isDark = colorScheme === 'dark';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50 dark:bg-slate-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 py-12">
          {/* Logo / Brand */}
          <View className="items-center mb-10">
            <View className="bg-brand-600 w-16 h-16 rounded-2xl items-center justify-center mb-4">
              <Text className="text-white text-2xl font-bold">$</Text>
            </View>
            <Text className="text-brand-600 dark:text-brand-400 text-3xl font-bold">
              Cashflow Control
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-base mt-2">
              Create your account
            </Text>
          </View>

          {/* Apple Sign In (iOS only) */}
          {Platform.OS === 'ios' && (
            <>
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={isAppleLoading || isLoading}
                activeOpacity={0.8}
                className={`flex-row items-center justify-center py-4 rounded-xl mb-4 ${
                  isDark ? 'bg-white' : 'bg-black'
                }`}
              >
                {isAppleLoading ? (
                  <ActivityIndicator color={isDark ? '#000' : '#fff'} />
                ) : (
                  <>
                    <Text
                      className={`text-lg mr-2 ${
                        isDark ? 'text-black' : 'text-white'
                      }`}
                      style={{ fontFamily: Platform.OS === 'ios' ? 'System' : undefined }}
                    >

                    </Text>
                    <Text
                      className={`text-base font-semibold ${
                        isDark ? 'text-black' : 'text-white'
                      }`}
                    >
                      Sign up with Apple
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View className="flex-row items-center my-4">
                <View className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <Text className="mx-4 text-slate-400 dark:text-slate-500 text-sm font-medium">
                  OR
                </Text>
                <View className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </View>
            </>
          )}

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
                if (successMessage) setSuccessMessage('');
              }}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              editable={!isLoading && !isAppleLoading}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 text-slate-800 dark:text-white font-medium border border-slate-200 dark:border-slate-700"
            />
          </View>

          {/* Password Input */}
          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError('');
                if (successMessage) setSuccessMessage('');
              }}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="next"
              editable={!isLoading && !isAppleLoading}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 text-slate-800 dark:text-white font-medium border border-slate-200 dark:border-slate-700"
            />
          </View>

          {/* Confirm Password Input */}
          <View className="mb-6">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              Confirm Password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (error) setError('');
                if (successMessage) setSuccessMessage('');
              }}
              placeholder="Re-enter your password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              editable={!isLoading && !isAppleLoading}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 text-slate-800 dark:text-white font-medium border border-slate-200 dark:border-slate-700"
            />
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 mb-4">
              <Text className="text-red-600 dark:text-red-400 text-sm text-center">
                {error}
              </Text>
            </View>
          ) : null}

          {/* Success Message */}
          {successMessage ? (
            <View className="bg-green-50 dark:bg-green-900/30 rounded-xl p-3 mb-4">
              <Text className="text-green-600 dark:text-green-400 text-sm text-center">
                {successMessage}
              </Text>
            </View>
          ) : null}

          {/* Create Account Button */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={isLoading || isAppleLoading}
            activeOpacity={0.8}
            className={`py-4 rounded-xl mb-6 ${
              isLoading
                ? 'bg-brand-400 dark:bg-brand-800'
                : 'bg-brand-600'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-center font-bold text-lg text-white">
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View className="flex-row justify-center">
            <Text className="text-slate-500 dark:text-slate-400 text-sm">
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={isLoading || isAppleLoading}
            >
              <Text className="text-brand-600 dark:text-brand-400 text-sm font-semibold">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (isLoading) return;

    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          {/* Header */}
          <View className="items-center mb-10">
            <View className="bg-brand-600 w-16 h-16 rounded-2xl items-center justify-center mb-4">
              <Text className="text-white text-2xl font-bold">$</Text>
            </View>
            <Text className="text-slate-800 dark:text-white text-2xl font-bold">
              Reset Password
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-base mt-2 text-center">
              Enter your email and we'll send you a link to reset your password
            </Text>
          </View>

          {isSuccess ? (
            /* Success State */
            <View>
              <View className="bg-green-50 dark:bg-green-900/30 rounded-xl p-5 mb-6">
                <Text className="text-green-700 dark:text-green-300 text-base font-semibold text-center mb-2">
                  Check your email
                </Text>
                <Text className="text-green-600 dark:text-green-400 text-sm text-center">
                  We've sent a password reset link to{' '}
                  <Text className="font-semibold">{email.trim()}</Text>. It may
                  take a few minutes to arrive. Be sure to check your spam
                  folder.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.8}
                className="py-4 rounded-xl bg-brand-600 mb-4"
              >
                <Text className="text-center font-bold text-lg text-white">
                  Back to Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
                className="py-2"
              >
                <Text className="text-center text-brand-600 dark:text-brand-400 text-sm font-medium">
                  Try a different email
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form State */
            <View>
              {/* Email Input */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError('');
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                  editable={!isLoading}
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

              {/* Send Reset Link Button */}
              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={isLoading}
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
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>

              {/* Back to Sign In */}
              <TouchableOpacity
                onPress={() => router.back()}
                disabled={isLoading}
                className="py-2"
              >
                <Text className="text-center text-brand-600 dark:text-brand-400 text-sm font-medium">
                  Back to Sign In
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

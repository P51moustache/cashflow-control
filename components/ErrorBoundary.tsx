import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { captureException } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send to Sentry with component stack context
    captureException(error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900 px-8">
          <Text className="text-4xl mb-4">!</Text>
          <Text className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">
            Something went wrong
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 text-center mb-6">
            An unexpected error occurred. Please try again.
          </Text>
          <TouchableOpacity
            onPress={this.handleRetry}
            className="bg-brand-600 px-8 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

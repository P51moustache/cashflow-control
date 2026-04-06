import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    debug: __DEV__,
    enabled: !__DEV__, // Only enable in production
  });
}

export function setUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

export function clearUser() {
  Sentry.setUser(null);
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ message, category, data, level: 'info' });
}

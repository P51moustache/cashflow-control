// PostHog is conditionally loaded — it may require native modules not available in Expo Go
let PostHogClass: any = null;

try {
  PostHogClass = require('posthog-react-native').default;
} catch {
  // Native module not available (Expo Go) — all functions become no-ops
}

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let posthog: any = null;

export async function initAnalytics() {
  if (!POSTHOG_API_KEY || !PostHogClass) {
    console.log('PostHog not configured or not available, skipping initialization');
    return;
  }

  posthog = new PostHogClass(POSTHOG_API_KEY, { host: POSTHOG_HOST });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog?.identify(userId, properties);
}

export function resetUser() {
  posthog?.reset();
}

export function track(event: string, properties?: Record<string, unknown>) {
  posthog?.capture(event, properties);
}

export function trackScreen(screenName: string) {
  posthog?.screen(screenName);
}

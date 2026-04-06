import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let posthog: PostHog | null = null;

export async function initAnalytics() {
  if (!POSTHOG_API_KEY) {
    console.log('PostHog API key not configured, skipping initialization');
    return;
  }

  posthog = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST });
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

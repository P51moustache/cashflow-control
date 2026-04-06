import "@/global.css";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { FinanceProvider } from '@/context/FinanceContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <FinanceProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
                presentation: 'modal',
                title: 'Settings',
                headerShown: true,
              }}
            />
          </Stack>
          <StatusBar style="auto" />
          <Toast />
        </FinanceProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

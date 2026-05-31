import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { formatCurrency } from '@/utils/financeUtils';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─── Section Header ──────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 mb-2 mt-6">
      {title}
    </Text>
  );
}

// ─── Settings Row ────────────────────────────────────────────────
function SettingsRow({
  icon,
  iconColor = '#64748b',
  label,
  value,
  onPress,
  destructive = false,
  showChevron = false,
  rightElement,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      className="flex-row items-center bg-white dark:bg-slate-800 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700"
    >
      <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: destructive ? '#fef2f2' : '#f1f5f9' }}>
        <IconSymbol name={icon} size={18} color={destructive ? '#ef4444' : iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            destructive ? 'text-red-500' : 'text-slate-800 dark:text-white'
          }`}
        >
          {label}
        </Text>
        {value ? (
          <Text className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            {value}
          </Text>
        ) : null}
      </View>
      {rightElement}
      {showChevron && (
        <IconSymbol name="chevron.right" size={16} color="#94a3b8" />
      )}
    </Wrapper>
  );
}

// ─── Sync Status Dot ─────────────────────────────────────────────
function SyncStatusDot({ status }: { status: string }) {
  let colorClass = 'bg-green-500'; // synced/idle/success
  if (status === 'syncing') colorClass = 'bg-yellow-500';
  if (status === 'error') colorClass = 'bg-red-500';

  return <View className={`w-2.5 h-2.5 rounded-full ${colorClass} mr-2`} />;
}

// ─── Main Settings Screen ────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const {
    currentBalance,
    updateBalance,
    transactions,
    addTransaction,
    removeTransaction,
    syncStatus,
    lastSynced,
    triggerSync,
  } = useFinance();
  const { user, isAuthenticated, signOut } = useAuth();
  const {
    isSubscribed,
    isTrialing,
    trialDaysLeft,
    currentPackagePrice,
    restore,
  } = useSubscription();

  // ── Balance editing state ──
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceText, setBalanceText] = useState('');
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  // ── Delete account state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ── Sync state ──
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Restore purchases state ──
  const [isRestoring, setIsRestoring] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // ── Balance editing ──
  const startEditingBalance = () => {
    setBalanceText(currentBalance.toString());
    setIsEditingBalance(true);
  };

  const saveBalance = async () => {
    const newBalance = parseFloat(balanceText);
    if (isNaN(newBalance) || newBalance < 0) {
      Toast.show({ type: 'error', text1: 'Invalid Balance', text2: 'Enter a valid positive number' });
      return;
    }
    setIsSavingBalance(true);
    try {
      await updateBalance(newBalance);
      setIsEditingBalance(false);
    } catch {
      // Toast shown by context
    } finally {
      setIsSavingBalance(false);
    }
  };

  // ── Sign out ──
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Sign Out Failed', text2: err.message });
          }
        },
      },
    ]);
  };

  // ── Delete account ──
  const handleDeleteAccount = () => {
    setDeleteConfirmText('');
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = () => {
    if (deleteConfirmText.trim().toUpperCase() === 'DELETE') {
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      Alert.alert(
        'Contact Support',
        'To complete account deletion, please contact support at support@cashflowcontrol.app. Your data will be removed within 30 days.',
        [{ text: 'OK' }]
      );
    } else {
      Toast.show({ type: 'error', text1: 'Confirmation Failed', text2: 'You must type DELETE to confirm' });
    }
  };

  // ── Sync now ──
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await triggerSync();
      Toast.show({ type: 'success', text1: 'Sync Complete' });
    } catch {
      Toast.show({ type: 'error', text1: 'Sync Failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Restore purchases ──
  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const restored = await restore();
      if (restored) {
        Toast.show({ type: 'success', text1: 'Purchases Restored' });
      } else {
        Toast.show({ type: 'info', text1: 'No Purchases Found', text2: 'No previous purchases were found' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Restore Failed', text2: 'Could not restore purchases' });
    } finally {
      setIsRestoring(false);
    }
  };

  // ── Export data ──
  const handleExportData = async () => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        appVersion,
        currentBalance,
        transactions,
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const exportFile = new ExpoFile(Paths.cache, 'cashflow-control-export.json');
      exportFile.write(jsonStr);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(exportFile.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Cashflow Control Data',
          UTI: 'public.json',
        });
      } else {
        Toast.show({ type: 'info', text1: 'Exported', text2: 'File saved to cache' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Export Failed', text2: err.message });
    }
  };

  // ── Import data ──
  const handleImportData = async () => {
    Alert.alert(
      'Import Data',
      'Importing will replace your current transactions. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose File',
          onPress: async () => {
            try {
              const DocumentPicker = await import('expo-document-picker');
              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (result.canceled) return;

              const pickedFile = result.assets[0];
              const importFile = new ExpoFile(pickedFile.uri);
              const content = await importFile.text();

              const data = JSON.parse(content);

              if (!data.transactions || !Array.isArray(data.transactions)) {
                Toast.show({ type: 'error', text1: 'Invalid File', text2: 'File does not contain valid transaction data' });
                return;
              }

              // Update balance if present
              if (typeof data.currentBalance === 'number') {
                await updateBalance(data.currentBalance);
              }

              // Remove existing transactions
              for (const tx of transactions) {
                await removeTransaction(tx.id);
              }

              // Add imported transactions
              for (const tx of data.transactions) {
                await addTransaction(tx);
              }

              Toast.show({ type: 'success', text1: 'Import Complete', text2: `Imported ${data.transactions.length} transactions` });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Import Failed', text2: err.message || 'Could not parse file' });
            }
          },
        },
      ]
    );
  };

  // ── Subscription label ──
  const getSubscriptionLabel = (): string => {
    if (isSubscribed && !isTrialing) {
      return `Monthly${currentPackagePrice ? ` - ${currentPackagePrice}/mo` : ''}`;
    }
    if (isTrialing) {
      return `Trial - ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left`;
    }
    return 'Free';
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* ════════════════════════════════════════════ ACCOUNT ═══ */}
        <SectionHeader title="Account" />
        <View className="bg-white dark:bg-slate-800 rounded-xl mx-4 overflow-hidden border border-slate-100 dark:border-slate-700">
          <SettingsRow
            icon="person.circle"
            iconColor="#6366f1"
            label="Profile"
            value={
              isAuthenticated && user?.email
                ? user.email
                : 'Not signed in'
            }
          />
          {isAuthenticated && (
            <>
              <SettingsRow
                icon="rectangle.portrait.and.arrow.right"
                iconColor="#f59e0b"
                label="Sign Out"
                onPress={handleSignOut}
              />
              <SettingsRow
                icon="trash.circle"
                label="Delete Account"
                onPress={handleDeleteAccount}
                destructive
              />
              {showDeleteConfirm && (
                <View className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-red-50 dark:bg-red-900/10">
                  <Text className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                    Type DELETE to confirm account deletion:
                  </Text>
                  <View className="flex-row items-center">
                    <TextInput
                      value={deleteConfirmText}
                      onChangeText={setDeleteConfirmText}
                      placeholder="Type DELETE"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      className="flex-1 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white font-medium"
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={confirmDeleteAccount}
                      className="ml-2 bg-red-500 rounded-lg px-4 py-2"
                    >
                      <Text className="text-white font-bold">Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      className="ml-2"
                    >
                      <Text className="text-slate-400 font-medium">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* ════════════════════════════════════════ SUBSCRIPTION ═══ */}
        <SectionHeader title="Subscription" />
        <View className="bg-white dark:bg-slate-800 rounded-xl mx-4 overflow-hidden border border-slate-100 dark:border-slate-700">
          <SettingsRow
            icon="crown.fill"
            iconColor="#f59e0b"
            label="Current Plan"
            value={getSubscriptionLabel()}
          />
          <SettingsRow
            icon="arrow.up.right"
            iconColor="#6366f1"
            label="Manage Subscription"
            onPress={() =>
              Linking.openURL('https://apps.apple.com/account/subscriptions')
            }
            showChevron
          />
          <SettingsRow
            icon="arrow.clockwise"
            iconColor="#0d9488"
            label="Restore Purchases"
            onPress={handleRestorePurchases}
            rightElement={
              isRestoring ? (
                <ActivityIndicator size="small" color="#0d9488" style={{ marginRight: 8 }} />
              ) : undefined
            }
          />
        </View>

        {/* ════════════════════════════════════════════════ SYNC ═══ */}
        {isAuthenticated && (
          <>
            <SectionHeader title="Sync" />
            <View className="bg-white dark:bg-slate-800 rounded-xl mx-4 overflow-hidden border border-slate-100 dark:border-slate-700">
              <SettingsRow
                icon="arrow.triangle.2.circlepath"
                iconColor="#0d9488"
                label="Sync Status"
                value={lastSynced === 'Never' ? 'Never synced' : `Last synced ${lastSynced}`}
                rightElement={<SyncStatusDot status={syncStatus} />}
              />
              <SettingsRow
                icon="arrow.clockwise"
                iconColor="#3b82f6"
                label="Sync Now"
                onPress={handleSyncNow}
                rightElement={
                  isSyncing ? (
                    <ActivityIndicator size="small" color="#3b82f6" style={{ marginRight: 8 }} />
                  ) : undefined
                }
              />
            </View>
          </>
        )}

        {/* ════════════════════════════════════════════════ DATA ═══ */}
        <SectionHeader title="Data" />
        <View className="bg-white dark:bg-slate-800 rounded-xl mx-4 overflow-hidden border border-slate-100 dark:border-slate-700">
          {/* Current Balance - inline editing */}
          {isEditingBalance ? (
            <View className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Current Balance
              </Text>
              <View className="flex-row items-center">
                <Text className="text-slate-400 text-lg mr-1">$</Text>
                <TextInput
                  value={balanceText}
                  onChangeText={setBalanceText}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 text-slate-800 dark:text-white text-lg font-bold bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2"
                  autoFocus
                />
                <TouchableOpacity
                  onPress={saveBalance}
                  disabled={isSavingBalance}
                  className="ml-2 bg-brand-600 rounded-lg px-4 py-2"
                >
                  {isSavingBalance ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold">Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsEditingBalance(false)}
                  className="ml-2"
                >
                  <Text className="text-slate-400 font-medium">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <SettingsRow
              icon="dollarsign.circle"
              iconColor="#0d9488"
              label="Current Balance"
              value={formatCurrency(currentBalance)}
              onPress={startEditingBalance}
              rightElement={
                <TouchableOpacity onPress={startEditingBalance} className="mr-2">
                  <IconSymbol name="pencil" size={16} color="#0d9488" />
                </TouchableOpacity>
              }
            />
          )}

          <SettingsRow
            icon="square.and.arrow.up"
            iconColor="#6366f1"
            label="Export Data"
            value="Export as JSON"
            onPress={handleExportData}
            showChevron
          />
          <SettingsRow
            icon="square.and.arrow.down"
            iconColor="#f59e0b"
            label="Import Data"
            value="Import from JSON"
            onPress={handleImportData}
            showChevron
          />
        </View>

        {/* ════════════════════════════════════════════════ ABOUT ═══ */}
        <SectionHeader title="About" />
        <View className="bg-white dark:bg-slate-800 rounded-xl mx-4 overflow-hidden border border-slate-100 dark:border-slate-700">
          <SettingsRow
            icon="info.circle"
            iconColor="#6366f1"
            label="App Version"
            value={`v${appVersion}`}
          />
          <SettingsRow
            icon="hand.raised.fill"
            iconColor="#3b82f6"
            label="Privacy Policy"
            onPress={() =>
              Linking.openURL('https://cashflowcontrol.app/privacy')
            }
            showChevron
          />
          <SettingsRow
            icon="doc.text"
            iconColor="#3b82f6"
            label="Terms of Service"
            onPress={() =>
              Linking.openURL('https://cashflowcontrol.app/terms')
            }
            showChevron
          />
          <SettingsRow
            icon="envelope.fill"
            iconColor="#0d9488"
            label="Support"
            value="support@cashflowcontrol.app"
            onPress={() =>
              Linking.openURL('mailto:support@cashflowcontrol.app')
            }
            showChevron
          />
        </View>

        {/* Bottom spacer */}
        <View className="h-12" />
      </ScrollView>
    </SafeAreaView>
  );
}

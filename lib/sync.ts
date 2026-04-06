import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { Transaction } from '@/types';
import {
  getUnsyncedItems,
  markSynced,
  clearSyncedItems,
  getLastSyncTime,
  setLastSyncTime,
  getSyncQueueCount,
} from '@/db/database';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

type SyncStatusListener = (status: SyncStatus) => void;

/**
 * Converts a camelCase Transaction object into a snake_case payload
 * suitable for upserting to the Supabase `transactions` table.
 */
export function transactionToSyncPayload(t: Transaction): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    amount: t.amount,
    type: t.type,
    frequency: t.frequency,
    date: t.date,
    day_of_month: t.dayOfMonth ?? null,
    is_debt: t.debtType != null,
    debt_type: t.debtType ?? null,
    apr: t.apr ?? null,
    current_balance: t.currentBalance ?? null,
    credit_limit: t.creditLimit ?? null,
    minimum_payment: t.minimumPayment ?? null,
    extra_payment: t.extraPayment ?? null,
    projected_monthly_spend: t.projectedMonthlySpend ?? null,
    spending_percentage: t.spendingPercentage ?? null,
    loan_term_months: t.loanTermMonths ?? null,
    is_flexible: t.isFlexible ?? false,
    exclude_from_spending: false,
    created_at: t.createdAt ?? new Date().toISOString(),
    updated_at: t.updatedAt ?? new Date().toISOString(),
  };
}

class SyncEngine {
  private isSyncing = false;
  private listeners: SyncStatusListener[] = [];
  private networkUnsubscribe: (() => void) | null = null;
  private pendingUserId: string | null = null;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentStatus: SyncStatus = 'idle';

  /**
   * Subscribe to sync status changes. Returns an unsubscribe function.
   */
  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.push(listener);
    // Immediately notify the new listener of current status
    listener(this.currentStatus);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(status: SyncStatus): void {
    this.currentStatus = status;
    this.listeners.forEach(l => l(status));
  }

  /**
   * Check current network connectivity.
   */
  async isOnline(): Promise<boolean> {
    try {
      const state: NetInfoState = await NetInfo.fetch();
      return state.isConnected === true;
    } catch {
      return false;
    }
  }

  /**
   * Start listening for network changes so we can auto-sync
   * when connectivity is restored.
   */
  startNetworkListener(userId: string): void {
    this.pendingUserId = userId;
    if (this.networkUnsubscribe) return; // Already listening

    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && this.pendingUserId) {
        // Network came back -- attempt to push pending changes
        this.performSync(this.pendingUserId).catch(() => {
          // Silently handle -- will retry on next connectivity change
        });
      } else if (!state.isConnected) {
        this.notify('offline');
      }
    });
  }

  /**
   * Stop the network listener (e.g. on sign-out).
   */
  stopNetworkListener(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.pendingUserId = null;
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  /**
   * Main sync entry point. Pushes local changes to Supabase,
   * pulls remote changes, and cleans up.
   * Returns true on success, false otherwise.
   */
  async performSync(userId: string): Promise<boolean> {
    if (this.isSyncing) return false;

    const online = await this.isOnline();
    if (!online) {
      this.notify('offline');
      return false;
    }

    this.isSyncing = true;
    this.notify('syncing');

    try {
      // Push local changes to Supabase
      await this.pushChanges(userId);

      // Pull remote changes from Supabase
      await this.pullChanges(userId);

      // Clean up already-synced items from the queue
      await clearSyncedItems();

      // Record the sync time
      const now = new Date().toISOString();
      await setLastSyncTime(now);

      this.notify('success');

      // After a short delay, return status to idle
      if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = setTimeout(() => {
        if (this.currentStatus === 'success') {
          this.notify('idle');
        }
      }, 3000);

      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      this.notify('error');

      // Schedule a retry after 30 seconds
      if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = setTimeout(() => {
        if (this.pendingUserId) {
          this.performSync(this.pendingUserId).catch(() => {});
        }
      }, 30000);

      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push all unsynced local changes to Supabase.
   * Each item in the sync queue is processed independently so that
   * a single failure doesn't block the rest.
   */
  private async pushChanges(userId: string): Promise<void> {
    const items = await getUnsyncedItems();
    if (items.length === 0) return;

    const syncedIds: number[] = [];

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload);

        switch (item.operation) {
          case 'INSERT':
          case 'UPDATE': {
            const { error } = await supabase
              .from(item.table_name)
              .upsert(
                { ...payload, user_id: userId },
                { onConflict: 'id' }
              );
            if (error) throw error;
            break;
          }
          case 'DELETE': {
            if (item.table_name === 'transactions') {
              // Soft delete -- set deleted_at timestamp
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase.from('transactions') as any)
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', item.record_id)
                .eq('user_id', userId);
              if (error) throw error;
            } else {
              // Hard delete for other tables
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (supabase.from(item.table_name) as any)
                .delete()
                .eq('id', item.record_id)
                .eq('user_id', userId);
              if (error) throw error;
            }
            break;
          }
        }

        syncedIds.push(item.id);
      } catch (error) {
        console.error(`Failed to sync queue item ${item.id} (${item.table_name}/${item.operation}):`, error);
        // Continue with next item so one failure doesn't block the rest
      }
    }

    if (syncedIds.length > 0) {
      await markSynced(syncedIds);
    }
  }

  /**
   * Pull remote changes from Supabase that were updated after our
   * last sync timestamp.
   *
   * NOTE: For the initial implementation, pulled data is logged.
   * Full bidirectional merge (applying remote rows into local SQLite)
   * requires conflict resolution and will be handled in a follow-up
   * when multi-device support ships. For now, the local database is
   * the source of truth, and this method ensures the server has the
   * latest data via pushChanges.
   */
  private async pullChanges(userId: string): Promise<void> {
    const lastSync = await getLastSyncTime();

    // Pull transactions updated after last sync
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (lastSync) {
      query = query.gt('updated_at', lastSync);
    }

    const { data: remoteTransactions, error } = await query;
    if (error) {
      console.error('Failed to pull transactions:', error);
      return;
    }

    if (remoteTransactions && remoteTransactions.length > 0) {
      console.log(`Pulled ${remoteTransactions.length} remote transaction(s) since last sync`);
      // TODO: Merge remote transactions into local SQLite when multi-device ships
    }

    // Pull user settings
    const { error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Failed to pull user settings:', settingsError);
    }

    // Pull debt settings
    const { error: debtError } = await supabase
      .from('debt_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (debtError && debtError.code !== 'PGRST116') {
      console.error('Failed to pull debt settings:', debtError);
    }
  }

  /**
   * Perform an initial sync when a user first signs in.
   * Pushes all local data to Supabase.
   */
  async initialSync(userId: string): Promise<void> {
    console.log('Performing initial sync for user:', userId);
    await this.performSync(userId);
  }

  /**
   * Get a human-readable string describing when the last sync occurred.
   */
  async getLastSyncTimeFormatted(): Promise<string> {
    const lastSync = await getLastSyncTime();
    if (!lastSync) return 'Never';

    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return syncDate.toLocaleDateString();
  }

  /**
   * Returns the number of items waiting to be synced.
   */
  async getPendingCount(): Promise<number> {
    return getSyncQueueCount();
  }

  /**
   * Whether the engine is currently in the middle of a sync.
   */
  get syncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Current status of the sync engine.
   */
  get status(): SyncStatus {
    return this.currentStatus;
  }
}

export const syncEngine = new SyncEngine();

# Cashflow Control — Production-Ready Design

**Date:** 2026-04-05
**Status:** Approved
**Goal:** Transform the local-only cashflow app into a production iOS app with monthly subscription revenue.

## Decisions

- **Platform:** iOS first
- **Subscription:** Monthly via RevenueCat + StoreKit, 7-day free trial, then hard paywall
- **Auth:** Supabase Auth (Apple Sign In + email/password + anonymous)
- **Cloud sync:** Supabase Postgres, offline-first with local SQLite as source of truth
- **Analytics:** PostHog or Mixpanel for conversion funnel
- **Crash reporting:** Sentry

---

## Part 1: Bug Fixes (12 items)

Every item below must be fixed. No exceptions.

### Critical

1. **Build missing debt screen components** — `debt.tsx` imports `DebtStrategySelector`, `PaymentBudgetCard`, `MonthlyBudgetCard`, `StrategyComparisonModal` which don't exist. Build all four components with full functionality:
   - `DebtStrategySelector`: picker/segmented control for LOWEST_PAYMENT / FASTEST_PAYOFF / SNOWBALL with descriptions of each strategy
   - `PaymentBudgetCard`: input for total monthly payment budget with validation, shows allocation breakdown across cards
   - `MonthlyBudgetCard`: input for total monthly spending budget with validation, shows allocation breakdown across cards
   - `StrategyComparisonModal`: full-screen modal comparing all 3 strategies side-by-side showing payoff months, total interest paid, monthly payment amounts, and a recommendation

2. **Add error handling to ALL database operations** — Every function in `db/database.ts` must have try-catch. Every call site in `FinanceContext.tsx` must handle failure:
   - `createTransaction()` — try-catch, throw on failure
   - `updateTransaction()` — try-catch, throw on failure
   - `deleteTransaction()` — try-catch, throw on failure
   - `updateBalance()` — try-catch, throw on failure
   - `getDebtSettings()` / `updateDebtSettings()` — try-catch, throw on failure
   - `getAllTransactions()` — try-catch, return empty array + log error
   - In FinanceContext: wrap each DB call in try-catch, show error toast on failure, do NOT update local state if DB write fails

3. **Comprehensive form validation in add-transaction.tsx:**
   - Amount: must be > 0, must be a valid number, max 999,999.99
   - Name: required, min 1 char, max 100 chars, trimmed
   - APR: 0-100% range, required for debt types
   - Current balance: must be >= 0, required for debt types
   - Credit limit: must be >= current balance, required for credit cards
   - Minimum payment: must be > 0, must be <= current balance, required for credit cards
   - Extra payment: must be >= 0
   - Projected monthly spend: must be >= 0, must be <= credit limit
   - Spending percentage: 0-100%
   - Loan term months: 1-600 range, required for loans
   - Day of month: 1-31 for monthly transactions
   - Show inline error messages below each field with red text
   - Disable submit button until all validation passes
   - Show field-level errors on blur, not just on submit

### High Priority

4. **Fix weekly/bi-weekly recurrence calculation** in `financeUtils.ts`:
   - Replace `Math.ceil()` with `Math.floor()` in diffDays calculation
   - Add unit tests for weekly recurrence on exact days, off days, and boundary days
   - Add unit tests for bi-weekly recurrence similarly
   - Test that first occurrence fires on start date

5. **Fix monthly day-of-month for short months** in `financeUtils.ts`:
   - If transaction is set for day 31 and month has 30 days, fire on day 30
   - If transaction is set for day 29/30/31 and month is February, fire on last day of Feb
   - Use `Math.min(dayOfMonth, daysInMonth)` approach
   - Add unit tests for day 31 in Feb, Apr, Jun, Sep, Nov
   - Add unit test for day 29 in non-leap year February

6. **Fix TransactionCard "undefined% APR"** in `TransactionCard.tsx`:
   - Only show APR line if `transaction.apr !== undefined && transaction.apr !== null`
   - Only show debt-specific fields when transaction is a debt type

7. **Fix race condition in FinanceContext** — Do NOT update local state if DB write fails:
   - `addTransaction`: only call `setTransactions` after `createTransaction` succeeds
   - `updateTransaction`: only update state after DB confirms
   - `removeTransaction`: only remove from state after DB confirms
   - `updateBalance`: only update after DB confirms
   - Show error toast with message on failure

8. **Fix SummaryCard hiding negative balance:**
   - Remove `Math.max(0, lowestBalance)` — show actual negative balance
   - Style negative balances in red with minus sign
   - Show warning banner when projected balance goes negative

### Medium Priority

9. **Add loading/disabled state to all submit buttons:**
   - add-transaction.tsx: disable button + show spinner during save
   - settings.tsx: disable button + show spinner during save
   - Prevent double-tap creating duplicate transactions
   - All async buttons throughout the app

10. **Validate balance in settings** — prevent negative values, show error message, add confirmation dialog if changing balance by more than $1000

11. **Fix debt state loss when switching tabs** in add-transaction.tsx:
    - Preserve debt fields when switching between Income/Expense tabs
    - Only clear debt fields explicitly via the debt toggle, not on tab switch
    - If user had debt enabled on Expense, switching to Income then back should restore debt state

12. **Add confirmation dialog for destructive import** in settings.tsx:
    - When "clear existing data" is selected during import, show explicit warning
    - "This will permanently delete all your current transactions and settings. This cannot be undone."
    - Require typing "DELETE" or double-confirm

---

## Part 2: Authentication & Cloud Sync

### Supabase Auth

13. **Install and configure Supabase client:**
    - Install `@supabase/supabase-js`
    - Create `lib/supabase.ts` with client initialization
    - Environment variables for SUPABASE_URL and SUPABASE_ANON_KEY via app.config.js
    - Configure deep linking for auth callbacks

14. **Implement auth flows:**
    - **Anonymous auth:** Auto-create anonymous session on first launch
    - **Apple Sign In:** `expo-apple-authentication` + Supabase Apple provider
    - **Email/password:** Sign up, sign in, password reset
    - **Link anonymous to permanent:** When anonymous user creates account, link their data
    - **Session persistence:** Store tokens securely with `expo-secure-store`
    - **Auto token refresh:** Supabase handles this, configure in client
    - **Sign out:** Clear local session, keep local data, stop sync

15. **Auth UI screens:**
    - **Sign In screen:** Apple Sign In button (prominent), email/password form, "Create Account" link
    - **Sign Up screen:** Apple Sign In button, email/password form with confirm password, "Already have account" link
    - **Forgot Password screen:** Email input, send reset link
    - **Account screen (in settings):** Show email, sign out button, delete account button

16. **Auth context:**
    - `AuthContext` provider wrapping the app
    - `useAuth()` hook exposing: user, session, signIn, signUp, signOut, loading, error
    - Auth state machine: loading → authenticated | unauthenticated | anonymous
    - Navigation guard: redirect to auth screen if unauthenticated and trial expired

### Supabase Database

17. **Create Supabase tables:**
    ```sql
    profiles (
      id uuid PRIMARY KEY references auth.users,
      email text,
      display_name text,
      subscription_status text DEFAULT 'trial',
      trial_end timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )

    transactions (
      id text PRIMARY KEY,
      user_id uuid REFERENCES profiles(id) NOT NULL,
      name text NOT NULL,
      amount numeric NOT NULL,
      type text NOT NULL,
      frequency text NOT NULL,
      date timestamptz,
      day_of_month integer,
      is_debt boolean DEFAULT false,
      debt_type text,
      apr numeric,
      current_balance numeric,
      credit_limit numeric,
      minimum_payment numeric,
      extra_payment numeric DEFAULT 0,
      projected_monthly_spend numeric DEFAULT 0,
      spending_percentage numeric DEFAULT 0,
      loan_term_months integer,
      is_flexible boolean DEFAULT false,
      exclude_from_spending boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    )

    user_settings (
      id integer PRIMARY KEY DEFAULT 1,
      user_id uuid REFERENCES profiles(id) NOT NULL,
      current_balance numeric DEFAULT 0,
      updated_at timestamptz DEFAULT now()
    )

    debt_settings (
      id integer PRIMARY KEY DEFAULT 1,
      user_id uuid REFERENCES profiles(id) NOT NULL,
      total_monthly_budget numeric DEFAULT 0,
      total_monthly_payment_budget numeric DEFAULT 0,
      payoff_strategy text DEFAULT 'SNOWBALL',
      updated_at timestamptz DEFAULT now()
    )

    excluded_occurrences (
      id text PRIMARY KEY,
      user_id uuid REFERENCES profiles(id) NOT NULL,
      transaction_id text NOT NULL,
      occurrence_date text NOT NULL,
      created_at timestamptz DEFAULT now()
    )
    ```

18. **Row Level Security policies** on every table:
    - SELECT: `auth.uid() = user_id`
    - INSERT: `auth.uid() = user_id`
    - UPDATE: `auth.uid() = user_id`
    - DELETE: `auth.uid() = user_id`
    - Enable RLS on all tables

19. **Create Supabase triggers:**
    - `on auth.users INSERT` → create `profiles` row with trial_end = now() + 7 days
    - `updated_at` auto-update trigger on all tables

### Sync Engine

20. **Build offline-first sync system:**
    - **Sync queue table in SQLite:**
      ```sql
      sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
        payload TEXT NOT NULL, -- JSON of the changed record
        created_at TEXT NOT NULL,
        synced_at TEXT
      )
      ```
    - **On every local write:** insert into sync_queue
    - **Sync process:**
      1. On app foreground + on network reconnect + every 5 minutes
      2. Read unsynced items from sync_queue ordered by created_at
      3. Batch upsert to Supabase (INSERT → upsert, UPDATE → upsert, DELETE → soft delete)
      4. Mark items as synced
      5. Pull remote changes newer than last sync timestamp
      6. Apply remote changes to local SQLite
    - **Conflict resolution:** last-write-wins using `updated_at` timestamps
    - **Initial sync on account creation:** push all local data to Supabase
    - **Sync status indicator:** show in settings (last synced time, sync in progress, sync failed)
    - **Force sync button** in settings
    - **Network awareness:** detect online/offline with `@react-native-community/netinfo`

---

## Part 3: Subscription & Paywall

### RevenueCat Integration

21. **Install and configure RevenueCat:**
    - Install `react-native-purchases`
    - Configure with API key in app initialization
    - Set up RevenueCat dashboard: one product, one entitlement ("pro"), one offering
    - Connect to App Store Connect subscription product

22. **Subscription context:**
    - `SubscriptionContext` provider
    - `useSubscription()` hook exposing: isSubscribed, isTrialing, trialDaysLeft, subscribe, restore, loading
    - Check `CustomerInfo` on app launch and on foreground
    - Listen for subscription status changes
    - Sync subscription status to Supabase `profiles.subscription_status`

23. **Paywall screen:**
    - Full-screen modal that cannot be dismissed (covers all tabs)
    - App logo + name at top
    - 3 value proposition rows with icons:
      - "Track every dollar in and out"
      - "Smart debt payoff strategies"
      - "Cloud sync across all your devices"
    - Monthly price card: "$X.XX/month after 7-day free trial"
    - Large CTA button: "Start Free Trial"
    - "Restore Purchases" text button below
    - "Terms of Service" and "Privacy Policy" links at bottom
    - Loading state during purchase flow
    - Error handling: show alert if purchase fails, handle user cancellation gracefully

24. **Entitlement gating logic:**
    - On app launch: check RevenueCat `CustomerInfo`
    - If entitlement "pro" is active → allow access
    - If in trial period → allow access, show "X days left" badge in settings
    - If trial expired AND no subscription → show paywall, block all navigation
    - 3-day grace period after subscription expiry (App Store handles retry)
    - Deep link to App Store subscription management from settings

25. **App Store subscription product setup:**
    - Product ID: `cashflow_monthly`
    - Price: configurable (suggest $4.99-$6.99/mo)
    - Free trial: 7 days
    - Subscription group: "Cashflow Control"
    - Localized descriptions for App Store

---

## Part 4: Onboarding & UX

### Onboarding Flow

26. **Build 3-screen swipeable onboarding:**
    - Screen 1: Illustration + "Track Your Cashflow" + "See exactly where your money goes and what's coming up"
    - Screen 2: Illustration + "Crush Your Debt" + "Compare strategies and find the fastest path to debt-free"
    - Screen 3: Illustration + "See Your Future Balance" + "Project your balance days and weeks ahead so you're never surprised"
    - Pagination dots
    - "Get Started" button on last screen
    - "Skip" button on all screens
    - Only show once (track in AsyncStorage `hasOnboarded`)

27. **Initial setup wizard (after onboarding):**
    - Step 1: "What's your current balance?" — number input with keypad
    - Step 2: "Add your main income" — name, amount, frequency (pre-filled as monthly)
    - Step 3: "Add your first expense" — name, amount, frequency
    - "Skip" option on steps 2 and 3
    - Animated transition between steps

28. **Dashboard feature tooltips (first-time):**
    - Tooltip pointing to chart: "This shows your projected balance"
    - Tooltip pointing to add button: "Tap here to add transactions"
    - Tooltip pointing to debt tab: "Track and pay off debt here"
    - Show once per feature, track in AsyncStorage
    - Dismissible by tapping anywhere

### Empty States

29. **Build empty states for every screen:**
    - **Dashboard (no transactions):** Illustration + "Add your first transaction to see your cashflow projection" + "Add Transaction" CTA button
    - **Dashboard chart (no data):** "Your cashflow chart will appear here once you add income or expenses"
    - **Dashboard upcoming (no upcoming):** "No transactions in the next 7 days" (already exists, verify it's styled well)
    - **Transactions list (empty):** Illustration + "No transactions yet" + "Start by adding your income and recurring expenses" + "Add Transaction" CTA
    - **Transactions list (filtered, no results):** "No [income/expenses] found" + "Try a different filter or add a new transaction"
    - **Debt screen (no debts):** Illustration + "No debts tracked yet" + "Add a credit card or loan to start planning your payoff" + "Add Debt" CTA
    - **Debt screen (no strategy set):** Prompt to set a payoff strategy
    - **Settings sync (not signed in):** "Sign in to sync your data across devices" + "Sign In" CTA

### Toast Notifications

30. **Implement toast notification system:**
    - Install `react-native-toast-message` or build custom
    - Success toasts (green): "Transaction saved", "Balance updated", "Settings saved", "Data exported", "Data imported"
    - Error toasts (red): "Failed to save transaction", "Sync failed", "Import failed"
    - Info toasts (blue): "Syncing...", "Trial expires in X days"
    - Undo toasts: "Transaction deleted" with "Undo" button (5 second timeout)
    - Position: top of screen, below status bar
    - Auto-dismiss after 3 seconds (except undo toasts: 5 seconds)

### Transaction Improvements

31. **Swipe-to-delete on transaction cards:**
    - Swipe left reveals red "Delete" button
    - Confirmation alert before delete
    - Animated removal from list
    - Undo toast after deletion

32. **Search and filter on transactions:**
    - Search bar at top of transactions screen
    - Search by transaction name (fuzzy match)
    - Filter chips: All, Income, Expense, Debt
    - Sort by: Date (default), Amount, Name
    - Clear search/filter button

33. **Pull-to-refresh:**
    - Dashboard: refresh projections and sync
    - Transactions: refresh list and sync
    - Debt: refresh projections and sync
    - Show refresh indicator while loading

### Settings Improvements

34. **Rebuild settings screen with sections:**
    - **Account section:**
      - Profile: email, display name
      - Sign Out button
      - Delete Account button (with "type DELETE to confirm" dialog)
    - **Subscription section:**
      - Current plan: "Monthly — $X.XX/mo" or "Trial — X days left"
      - "Manage Subscription" → opens App Store subscription management
      - "Restore Purchases" button
    - **Sync section:**
      - Last synced: "2 minutes ago" / "Never"
      - Sync status indicator (green dot = synced, yellow = syncing, red = failed)
      - "Sync Now" button
    - **Data section:**
      - Current balance (with edit)
      - Export data (JSON)
      - Import data (JSON)
    - **About section:**
      - App version
      - Privacy Policy link
      - Terms of Service link
      - Support email link
      - Rate on App Store link

### Dashboard Improvements

35. **Net worth summary card:**
    - Total assets (current balance)
    - Total debt (sum of all debt current balances)
    - Net worth = assets - debt
    - Color: green if positive, red if negative

36. **Monthly trend indicator:**
    - Compare this month's net cashflow vs last month
    - Show arrow up/down with percentage change
    - "Your cashflow improved 12% vs last month" or "Your cashflow decreased 8%"

---

## Part 5: Production Infrastructure

### Error Tracking

37. **Sentry integration:**
    - Install `@sentry/react-native`
    - Configure in app root with DSN
    - Error boundaries wrapping each tab screen — show "Something went wrong" + "Try Again" button instead of crash
    - Breadcrumbs: track screen navigation, button taps, API calls
    - Capture all unhandled promise rejections
    - Attach user ID to error reports (after auth)
    - Source maps upload in EAS build

### Analytics

38. **Analytics integration:**
    - Install PostHog React Native SDK (or Mixpanel)
    - Track these events (every single one):
      - `app_opened`
      - `onboarding_started`, `onboarding_completed`, `onboarding_skipped`
      - `setup_balance_set`, `setup_income_added`, `setup_expense_added`
      - `transaction_added` (with type, frequency properties)
      - `transaction_edited`
      - `transaction_deleted`
      - `debt_added` (with debt_type property)
      - `debt_strategy_changed` (with strategy property)
      - `projection_viewed` (with days property)
      - `paywall_shown`
      - `paywall_dismissed`
      - `trial_started`
      - `subscription_started`
      - `subscription_cancelled`
      - `subscription_restored`
      - `auth_signed_up` (with method: apple/email)
      - `auth_signed_in`
      - `auth_signed_out`
      - `sync_completed`
      - `sync_failed`
      - `data_exported`
      - `data_imported`
      - `screen_viewed` (with screen_name)
    - Identify user with Supabase user ID after auth
    - Respect iOS App Tracking Transparency (ATT) — only track if allowed, analytics still work without IDFA

### Testing

39. **Comprehensive test suite:**
    - **Unit tests (utils):**
      - `financeUtils.test.ts`: generateProjection for all frequencies, edge cases (day 31, leap year, empty transactions, negative balance), getMonthlyAmount for all frequencies, formatCurrency edge cases
      - `debtProjectionUtils.test.ts`: expand existing tests, add tests for all three strategies, spending allocation edge cases, zero balance, zero APR, 100% APR
    - **Database tests:**
      - `database.test.ts`: CRUD operations, error handling, migration, concurrent writes
    - **Component tests:**
      - `BalanceCard.test.tsx`: renders balance, handles negative, handles zero
      - `TransactionCard.test.tsx`: renders all types, shows/hides debt fields correctly
      - `SummaryCard.test.tsx`: renders stats, handles negative lowest balance
      - `CashFlowChart.test.tsx`: renders with data, empty state, handles zero projection
    - **Integration tests:**
      - Add transaction flow: fill form → save → appears in list → appears in projection
      - Debt flow: add debt → set strategy → see payoff timeline
      - Sync flow: add transaction offline → come online → syncs to Supabase
    - **Paywall tests:**
      - Trial active → no paywall
      - Trial expired → paywall shown
      - Subscribed → no paywall
      - Restore purchases works

### Performance

40. **Performance optimizations:**
    - Memoize chart data with `useMemo` in `CashFlowChart.tsx`
    - Memoize projection calculations in `FinanceContext.tsx`
    - Use `FlatList` with `getItemLayout` for transaction lists (fixed height items)
    - Use `React.memo()` on `TransactionCard`, `DebtCard`, `EnhancedDebtCard`
    - Lazy load debt projection calculations (don't compute on dashboard)
    - Debounce search input on transactions screen (300ms)
    - Batch SQLite writes during sync

### App Store Readiness

41. **App icon:**
    - Design app icon in all required sizes (1024x1024 master)
    - Include in app.json for both iOS and Android

42. **App Store listing:**
    - App name: "Cashflow Control" (or final name)
    - Subtitle: "Track spending & crush debt"
    - Description: compelling copy about features
    - Keywords: cashflow, budget, debt payoff, finance tracker, money management
    - Category: Finance
    - Screenshots: 6.7" and 6.1" for iPhone (at minimum)
    - Privacy nutrition labels: data collected (email, financial data), data linked to user, data used for analytics

43. **Legal documents:**
    - Privacy Policy: hosted web page covering data collection, Supabase storage, RevenueCat, analytics, user rights, CCPA/GDPR basics
    - Terms of Service: hosted web page covering subscription terms, refund policy, liability limitations, account termination
    - Both linked from paywall, settings, and App Store listing

44. **App Review preparation:**
    - Review notes explaining subscription model and trial
    - Demo account credentials if needed
    - Ensure all subscription UI follows App Store guidelines (no external purchase links, price displayed clearly, cancel/manage subscription accessible)

---

## Implementation Order

1. Bug fixes (items 1-12) — foundation must be solid
2. Database refactor + Supabase schema (items 17-19)
3. Auth system (items 13-16)
4. Sync engine (item 20)
5. RevenueCat + paywall (items 21-25)
6. Onboarding (items 26-28)
7. UX improvements (items 29-36)
8. Infrastructure (items 37-40)
9. App Store prep (items 41-44)
10. Testing throughout (item 39 — tests written alongside each phase)

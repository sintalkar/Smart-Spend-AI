# Codebase Audit Report: Smart Spend AI

This audit report maps out the existing structure, components, routes, database schemas, and security issues of the **Smart Spend AI** application.

---

## 📂 Codebase Structure & Component Tree

The React 19 application is built using Vite, TypeScript, and Tailwind CSS. It is structured into features under `src/features` and core utilities under `src/core`.

### Component & Page Mapping
- **App.tsx (Root)**: Initializes state, handles onboarding gating (`has_seen_onboarding` in localStorage), manages idle-time notification reminders, and handles routing.
  - **LandingPage (`/landing`)**: A static product description page showcasing capabilities.
  - **Layout (`/` base)**: Contains the central shell, FAB (Floating Action Button) options, global bottom drawer/sheets (`VoiceEntryBottomSheet` and `ReceiptScannerScreen`), and bottom navigation.
    - **DashboardScreen (`/`)**: Shows total balance, income/expense breakdown, Recharts area/donut charts, and teaser cards for score, streaks, and goals.
    - **TransactionsScreen (`/transactions`)**: Standard listing of logged transactions with search, category filtering, and date groupings.
    - **AddExpenseScreen (`/add`)**: Form for entering transaction amount, type, category, merchant name, date/time, notes, recurring and split options.
    - **SmsDetectorScreen (`/sms`)**: Lists detected local SMS, parsed transaction details, and allows manual confirmation.
    - **InsightsScreen (`/insights`)**: Displays AI-generated savings/investment suggestions, categories overspending breakdown, and spending charts.
    - **MoneyScoreScreen (`/score`)**: Displays the circular gauge for financial score, factor breakdown, and AI improvement tips.
    - **SetBudgetScreen (`/budget`)**: Overview of the monthly spending budget and a tool to set custom category budget limits.
    - **InstallGuideScreen (`/install-guide`)**: Teaches iOS and Android users how to save the application to their home screens as a PWA.

---

## 🔐 Security & Client Leak Audit

### 1. Gemini / AI API Client Exposures
- **Vite Config Define**: `vite.config.ts` bundles environment variables:
  ```typescript
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  }
  ```
  This is a critical security vulnerability: it forces Vite to replace references to `process.env.GEMINI_API_KEY` in the compiled client-side JavaScript, exposing the raw API key directly in production bundle files.
- **Direct Client Fetch calls**: The frontend services make `fetch()` requests directly to `/api/ai/...` endpoints on the local dev/production Node server, but they fall back to using dummy data or showing errors if a local API key is missing. The key is managed server-side in `server.ts` but the configuration exposes it via defining it client-side. We must entirely remove `process.env.GEMINI_API_KEY` definition from the client bundle.

### 2. Admin Panel Security
- **AdminRoute Check**: Currently, the `/v90369-secure-access-portal` route loads the `AdminRoute` component. The verification is entirely client-side:
  ```typescript
  useEffect(() => {
    if (!loading && (!user || user.email !== 'v90369@gmail.com')) {
      navigate('/');
    }
  }, [user, loading, navigate]);
  ```
  An attacker can bypass the router routing gates in their local JS context and render the admin UI. Since there is no server-side authentication checking or custom claims gate configured, the admin panel must be completely removed from the client build to prevent bundle inspections leaking internal metrics, diagnostic features, or resetting operations.

### 3. Firestore Security Rules (`firestore.rules`)
- The rules in `firestore.rules` allow any user matching `userId` to read/write all subcollections under `/users/{userId}`. They also allow `list` on `/users` and read/write on `/users/{userId}` if `isAdmin()` is true, where `isAdmin()` verifies the email is `v90369@gmail.com` on the auth token.
- We must replace it with a simple, secure rule that only allows users to read/write their own subcollections and forbids all administrative rules that could be hijacked.

---

## 💾 Local Storage & Database Schema

### 1. localStorage Keys
The application tracks state and caches AI responses using the following keys:
- `has_seen_onboarding`: Gating flag to show welcome slides.
- `LAST_ACTIVITY`: Millisecond timestamp to monitor user idle state.
- `LAST_NOTIFIED`: Millisecond timestamp preventing notification spam.
- `initial_balance`: Double value storing the user's manually entered initial starting balance.
- `ai_greeting_cache`: Muted greeting string and generation timestamp.
- `ai_score_tips_{score}`: JSON array containing AI score recommendations and duration timestamp.
- `admin_system_toggles_v12`, `admin_system_pin_v12`, `admin_system_session_v12`: Admin control settings.

### 2. IndexedDB Schema (`SmartSpendDB`)
Using Dexie, the local-first database has version `3` initialized with these object stores and indexes:
- **`transactions`**: `id`, `dateTime`, `categoryId`, `type`, `isRecurring`, `isDeleted`
- **`categories`**: `id`, `parentId`, `type`, `isCustom`, `sortOrder`
- **`budgets`**: `id`, `categoryId`, `isActive`
- **`smsPatterns`**: `id`, `bankName`
- **`insightsCache`**: `id`, `period`
- **`moneyScoreHistory`**: `id`, `calculatedAt`, `period`
- **`adminEvents`**: `id`, `eventType`, `createdAt`
- **`budgetHistory`**: `id`, `categoryId`, `changedAt`

---

## 📈 Summary of Work Items

1. **Section 2 — Security & Bugs**:
   - Strip `GEMINI_API_KEY` define out of `vite.config.ts`.
   - Remove the admin routes and panel code entirely from the client.
   - Refactor `firestore.rules` to strictly allow own-user read/writes only.
   - Resolve the "Unknown Merchant" parse fallback by clean mapping sender IDs.
   - Implement IndexedDB `merchantMap` to auto-categorize and memorize merchants.
   - Implement `useSubscription()` hook and gate PRO tier features using Razorpay APIs.
   - Fix Render cold-start by adding Cloudflare / Vercel redirects, code-splitting routes, and skeletons.
   - Add the Privacy Policy static page.

2. **Section 3 — New Features**:
   - Rule-based SMS parser for Indian banks with regexes and confidence rating.
   - Bill and EMI reminders.
   - Savings Goals with confetti animations.
   - Recurring transactions.
   - Bank statement PDF parsed via AI.
   - Spending anomaly alert.
   - Projected month-end burn rate line.
   - Weekly push notification digest.
   - Streaks & achievements.
   - Assets/Liabilities Net Worth calculator.
   - Split Expense personal ledger.
   - Circular Financial Score gauge with 8-factor formula.
   - Monthly shareable Canvas Report Card.

3. **Section 4 — UI/UX Redesign**:
   - Apply the "Deep Finance Dark" design token system.
   - Build custom GlassCard, AmountDisplay, CategoryChip, TransactionCard, BottomNav, and Bottom Sheets from scratch with `framer-motion`.
   - Update Dashboard, History, Add Expense sheet, Budget, Insights, Score, and More screens.

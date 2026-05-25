<div align="center">

<img src="./pwa-512x512.png" alt="Smart Spend AI" width="96" height="96" />

# Smart Spend AI

**An offline-first, AI-powered personal finance tracker built for India**

Track expenses · Scan receipts · Detect recurring bills · Set savings goals  
Get real-time AI insights — all from your phone, even without internet

<br/>

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black&style=flat-square)](https://firebase.google.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white&style=flat-square)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-Apache_2.0-4CAF50?style=flat-square)](LICENSE)

<br/>

[Live Demo](https://smart-spend-ai.onrender.com) &nbsp;·&nbsp; [Report a Bug](https://github.com/sintalkar/Smart-Spend-AI/issues) &nbsp;·&nbsp; [Request a Feature](https://github.com/sintalkar/Smart-Spend-AI/issues)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Admin Panel](#admin-panel)
- [Firestore Setup](#firestore-setup)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

Smart Spend AI is a production-grade PWA built for Indian users. It works fully **offline** using IndexedDB (Dexie), syncs to Firestore when online, and uses Google Gemini + Anthropic Claude to parse transactions from natural language, scan receipts, and generate personalised financial insights — all in an INR-native, dark-mode interface.

**Core design principles:**

- **Offline-first** — every action works without internet; sync happens silently in the background
- **AI-native** — dual AI providers (Gemini 2.5 Flash + Claude) with automatic fallback and per-feature rate limiting
- **Real-time admin control** — feature flags and broadcasts propagate to all users via Firestore `onSnapshot` in under one second, with no page reload required

---

## Features

### User-Facing

| Feature | Description |
|---|---|
| **Dashboard** | Balance overview, spending summary, AI greeting, financial health score card |
| **Manual Entry** | Add expense or income with category, merchant, tags, and notes |
| **Voice Entry** | Speak a transaction naturally — AI extracts amount, merchant, and category |
| **Receipt Scanner** | Photograph a receipt — Gemini Vision OCR auto-fills the form |
| **SMS Detection** | Paste or auto-read a bank SMS; regex + AI extract full transaction details |
| **Transaction History** | Full-text search, type / period / category filter chips, paginated list |
| **Monthly PDF Report** | One-tap export — cover page, summary cards, category breakdown, merchant table, full log |
| **AI Insights** | Monthly spending analysis: habits, score out of 100, personalised suggestions |
| **Budget Tracker** | Per-category monthly budgets with configurable alert thresholds |
| **Recurring Detection** | Auto-identifies weekly / monthly charges via pattern analysis; confirm or dismiss |
| **Savings Goals** | Create goals (e.g. "Goa Trip ₹15,000"), track progress with animated bars, get AI cut suggestions and ETA |
| **Money Score** | 0–100 financial health score with 6-month history chart and improvement tips |
| **AI Assistant** | In-app chat with a Chartered Accountant AI persona for financial Q&A |

### Platform

- Installable PWA — works on Android and iOS home screen
- Firebase Auth — email/password and Google sign-in
- Firestore cloud sync — bidirectional, conflict-free
- Admin broadcast banners and maintenance mode — live for all users

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.8 |
| Build tool | Vite 6 |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 + clsx |
| Animation | Framer Motion (`motion/react`) |
| Local database | Dexie.js v4 (IndexedDB) |
| Cloud database | Firestore (Firebase 12) |
| Auth | Firebase Auth |
| AI providers | Google Gemini 2.5 Flash · Anthropic Claude |
| PDF generation | jsPDF + jspdf-autotable |
| Icons | Lucide React |
| Charts | Recharts |
| PWA | vite-plugin-pwa |
| Notifications | react-hot-toast |

### Backend (Express API)

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express 4 |
| Database | MongoDB + Mongoose |
| Auth | JWT (7-day expiry) + bcryptjs |
| AI proxy | Gemini + Claude with PacedQueue rate limiter (2.5 s between calls) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Browser / PWA                       │
│                                                          │
│   React 19 UI  ──────────────────────────────────────    │
│        │                                                 │
│   Dexie (IndexedDB)  ◄──── offline-first writes ──────   │
│        │                                                 │
│   FirebaseSyncService  ◄──── onSnapshot / push ────────  │
│        │                            │                    │
│        ▼                            ▼                    │
│   Firebase Auth              Firestore                   │
│                    ┌───────────────────────────┐         │
│                    │  /users/{uid}/             │         │
│                    │    transactions            │         │
│                    │    categories              │         │
│                    │    budgets                 │         │
│                    │                            │         │
│                    │  /config/features  ◄───────────── Admin panel writes
│                    │  /config/announcement      │         │
│                    │  /appEvents                │         │
│                    └───────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
              │
              ▼  (AI features via API proxy)
   ┌──────────────────────────┐
   │   Express Backend (API)  │
   │   POST /api/ai/*         │
   │   Gemini → Claude        │
   │   PacedQueue (2.5 s)     │
   └──────────────────────────┘
```

### Real-time Admin Sync Flow

```
Admin writes toggle/announcement to Firestore
              ↓
   Firestore emits onSnapshot to every connected client
              ↓
   AdminService.ts updates in-memory state
              ↓
   React subscribers in Layout.tsx re-render
              ↓
   Feature hides/shows · Banner appears · Maintenance screen activates
   ── all without a page reload, typically in < 1 second ──
```

---

## Project Structure

```
Smart-Spend-AI/
│
├── src/                              # Frontend — React + TypeScript
│   │
│   ├── App.tsx                       # Root router, lazy screen loading, onboarding gate
│   ├── firebase.ts                   # Firebase app initialisation (Auth + Firestore)
│   ├── main.tsx                      # React entry point
│   ├── index.css                     # Global styles + Tailwind directives
│   │
│   ├── core/                         # Shared infrastructure
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx      # Firebase Auth context + Firestore user-profile sync
│   │   │   ├── ProGate.tsx           # Protected route wrapper
│   │   │   └── useSubscription.ts
│   │   │
│   │   └── ui/
│   │       ├── Layout.tsx            # App shell — bottom nav, FAB, balance modal
│   │       ├── AnnouncementBanner.tsx  # Live admin broadcast banner (Firestore-driven)
│   │       ├── MaintenanceScreen.tsx   # Full-screen block when admin enables maintenance
│   │       ├── EmptyState.tsx
│   │       └── Skeleton.tsx
│   │
│   ├── db/                           # Offline-first data layer (Dexie / IndexedDB)
│   │   ├── database.ts               # SmartSpendDatabase — schema v4 + migrations
│   │   ├── models.ts                 # All entity interfaces (TypeScript)
│   │   └── repositories/
│   │       ├── TransactionRepository.ts
│   │       ├── BudgetRepository.ts
│   │       ├── CategoryRepository.ts
│   │       ├── InsightsCacheRepository.ts
│   │       └── MoneyScoreHistoryRepository.ts
│   │
│   ├── services/
│   │   └── FirebaseSyncService.ts    # Dexie ↔ Firestore two-way sync with conflict guard
│   │
│   ├── features/                     # Feature modules (screen + logic colocated)
│   │   │
│   │   ├── admin/
│   │   │   ├── AdminService.ts       # Firestore onSnapshot listeners + admin write APIs
│   │   │   ├── AdminRoute.tsx        # SHA-256 PIN auth gate
│   │   │   └── AdminDashboard.tsx    # 5-tab admin panel (Overview, Features, Broadcast, Users, Events)
│   │   │
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.tsx   # Balance card, AI greeting, quick stats, health score
│   │   │
│   │   ├── transactions/
│   │   │   ├── TransactionsScreen.tsx     # Search, filter chips, pagination, PDF download
│   │   │   ├── MonthlyReportGenerator.ts  # jsPDF export — cover, charts, tables
│   │   │   ├── TransactionEditModal.tsx
│   │   │   └── CategoryEditModal.tsx
│   │   │
│   │   ├── add_expense/
│   │   │   ├── AddExpenseScreen.tsx
│   │   │   ├── VoiceEntryBottomSheet.tsx  # Speech → transaction via AI
│   │   │   ├── VoiceExpenseParser.ts
│   │   │   ├── ReceiptScanner.tsx
│   │   │   └── useSpeechRecognition.ts
│   │   │
│   │   ├── goals/
│   │   │   ├── GoalsScreen.tsx        # Goals list with animated progress bars
│   │   │   ├── GoalDetailScreen.tsx   # Detail view, contribution history, AI cut suggestions
│   │   │   └── CreateGoalModal.tsx    # Create / edit modal with emoji + colour picker
│   │   │
│   │   ├── recurring/
│   │   │   ├── RecurringDetectionService.ts  # Pattern analysis — weekly / monthly cadence
│   │   │   └── RecurringScreen.tsx           # Confirm / dismiss recurring groups
│   │   │
│   │   ├── insights/
│   │   │   ├── InsightsScreen.tsx
│   │   │   └── GeminiInsightsService.ts      # Monthly AI analysis with caching
│   │   │
│   │   ├── budget/
│   │   │   └── SetBudgetScreen.tsx
│   │   │
│   │   ├── money_score/
│   │   │   ├── MoneyScoreScreen.tsx
│   │   │   ├── MoneyScoreCalculator.ts
│   │   │   └── GeminiScoreService.ts
│   │   │
│   │   ├── sms_detector/
│   │   │   ├── SmsDetectorScreen.tsx
│   │   │   ├── SmsProcessor.ts
│   │   │   ├── RegexParserEngine.ts          # Bank SMS regex with confidence scoring
│   │   │   ├── GeminiTransactionParser.ts
│   │   │   └── DataSanitizer.ts
│   │   │
│   │   ├── receipt_scanner/
│   │   │   ├── ReceiptScannerScreen.tsx
│   │   │   ├── ReceiptResultsScreen.tsx
│   │   │   └── GeminiReceiptScanner.ts
│   │   │
│   │   ├── auth/
│   │   │   └── AuthScreen.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingScreen.tsx
│   │   ├── landing/
│   │   │   └── LandingPage.tsx
│   │   ├── ai_assistant/
│   │   │   └── AiAssistant.tsx              # In-app Chartered Accountant AI chat
│   │   └── pwa/
│   │       ├── PwaInstallPrompt.tsx
│   │       └── InstallGuideScreen.tsx
│   │
│   ├── lib/                           # Standalone utility modules
│   │   ├── smsParser.ts               # Bank SMS regex library (30+ Indian banks)
│   │   ├── goalsManager.ts            # Goals CRUD + savings transfer logic
│   │   ├── recurringManager.ts        # Recurring transaction helpers
│   │   ├── anomalyDetector.ts         # Spending anomaly detection
│   │   ├── burnRatePredictor.ts       # Monthly burn rate forecast
│   │   ├── merchantMemory.ts          # Auto-categorise by merchant history
│   │   ├── firestoreUtils.ts          # Error handling + offline detection
│   │   └── ...
│   │
│   └── pages/
│       └── PrivacyPolicy.tsx
│
├── backend/                          # Express API server
│   ├── server.js                     # Entry point — Express + MongoDB connect
│   ├── config/db.js                  # Mongoose connection
│   ├── models/
│   │   ├── User.js                   # email, password (bcrypt), currency
│   │   ├── Expense.js                # amount, category, date, userId
│   │   ├── Budget.js                 # totalBudget, month, alertTriggered
│   │   └── Insight.js                # Cached AI analysis per month
│   ├── controllers/
│   │   ├── authController.js         # register, login, me, logout
│   │   ├── expenseController.js      # CRUD + summary
│   │   ├── budgetController.js       # set, current, history
│   │   └── aiController.js           # analyze, categorize, goal-tips, receipt scan
│   ├── routes/
│   │   ├── authRoutes.js             # POST /api/auth/register|login
│   │   ├── expenseRoutes.js          # /api/expenses — CRUD + summary
│   │   ├── budgetRoutes.js           # /api/budget
│   │   └── aiRoutes.js               # /api/ai/analyze|categorize|scan-receipt|goal-tips
│   ├── services/
│   │   └── aiService.js              # Gemini + Claude with PacedQueue (2.5 s between calls)
│   └── middleware/
│       ├── authMiddleware.js         # JWT Bearer token verification
│       └── errorMiddleware.js        # Global error handler
│
├── firebase-applet-config.json       # Firebase project config (no secrets — safe to commit)
├── firestore.rules                   # Firestore security rules
├── vercel.json                       # Vercel deployment — API rewrites + asset cache headers
├── vite.config.ts                    # Vite + PWA plugin + Tailwind
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- A [Firebase project](https://console.firebase.google.com) with **Authentication** and **Firestore** enabled
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key for Gemini
- *(Optional)* An [Anthropic Console](https://console.anthropic.com) key for Claude fallback

---

### 1 · Clone the repository

```bash
git clone https://github.com/sintalkar/Smart-Spend-AI.git
cd Smart-Spend-AI
```

---

### 2 · Configure Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → create a project
2. Enable **Authentication** → add Email/Password and Google providers
3. Enable **Cloud Firestore** → start in production mode
4. Copy your web app config into `firebase-applet-config.json`:

```json
{
  "projectId": "your-project-id",
  "appId": "1:xxx:web:xxx",
  "apiKey": "AIza...",
  "authDomain": "your-project.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789"
}
```

---

### 3 · Frontend setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Open and fill in your API keys
# (see Environment Variables section below)

# Start the development server
npm run dev
```

App runs at `http://localhost:5173`

---

### 4 · Backend setup *(optional — needed only for AI proxy endpoints)*

```bash
cd backend
npm install

cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, ANTHROPIC_API_KEY

node server.js
```

API runs at `http://localhost:5000`

---

## Environment Variables

### Frontend — `.env.local`

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Main Gemini key — AI insights, voice parsing |
| `Smart_Spend` | ✅ | Gemini key for the Insights tab |
| `ss_key` | ✅ | Gemini key for Money Score AI |
| `pdf_key` | ✅ | Gemini key for PDF report narration |
| `KEY_AI` | ✅ | Gemini key for the AI Assistant chat |
| `ca_key` | ✅ | Gemini key for the CA-mode chat persona |
| `image_key` | ✅ | Gemini key for receipt image scanning |
| `APP_URL` | ☑️ | Your deployed app URL (used for PWA links) |

> All `*_key` variables accept the same Gemini API key. The separation exists so that each feature has its own rate-limit quota bucket.

---

### Backend — `backend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | ✅ | Express server port (default `5000`) |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret for signing auth tokens — use a long random string |
| `ANTHROPIC_API_KEY` | ☑️ | Claude key — used as AI fallback when Gemini fails |

---

## Admin Panel

The admin panel is protected behind a secret URL and a SHA-256 hashed PIN.

### Access URL

```
https://your-domain.com/v90369-secure-access-portal
```

### First-time setup

1. Navigate to the admin URL in your browser
2. You will be prompted to **create a PIN** (minimum 6 characters)
3. The PIN is SHA-256 hashed and stored in Firestore at `/config/adminSettings`
4. All future visits require the correct PIN

---

### Admin Tabs

| Tab | What it does |
|---|---|
| **Overview** | Stats cards — total users, 7-day active users, events today, active feature count. Feature status list. Maintenance mode warning |
| **Feature Flags** | Toggle switches for Voice Entry, Receipt Scanner, AI Parsing, SMS Detection, Analytics. Changes reach all users **instantly** via Firestore |
| **Maintenance Mode** | Enable to replace the entire app with a custom message screen. Disable to restore access — both take effect in real time |
| **Broadcast** | Compose an announcement banner (Info / Warning / Success / Urgent) with an optional expiry time. Appears at the top of every user's screen within seconds |
| **Users** | Table of all registered users pulled from Firestore — email, display name, UID, last login, initial balance set |
| **Events** | Live event log — APP\_OPEN, MANUAL\_ENTRY, VOICE\_ENTRY\_USED, RECEIPT\_SCANNED. Filterable by event type |

---

### How real-time sync works

```
1. Admin changes a toggle or posts a broadcast
         ↓
2. AdminDashboard writes to Firestore /config/features or /config/announcement
         ↓
3. Firestore triggers onSnapshot on every connected client
         ↓
4. AdminService.ts (singleton, runs in every user session) updates in-memory state
         ↓
5. React subscribers in Layout.tsx re-render

Result:  Feature hides / shows  ·  Banner appears  ·  Maintenance screen activates
         ── typically in under 1 second, with no page reload ──
```

---

## Firestore Setup

### Security Rules

Deploy the included `firestore.rules` to restrict users to their own data:

```bash
firebase deploy --only firestore:rules
```

**Default rules** (each user reads/writes only their own data):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only access their own subtree
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Everything else is locked
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> **For admin auto-sync**, add a rule that lets authenticated users read `/config`:
>
> ```javascript
> match /config/{document} {
>   allow read: if request.auth != null;
> }
> ```

---

### Firestore Collections

| Path | Purpose |
|---|---|
| `/users/{uid}` | User profile — email, displayName, lastLogin, initialBalance |
| `/users/{uid}/transactions` | All transactions for the user |
| `/users/{uid}/categories` | Custom categories |
| `/users/{uid}/budgets` | Monthly category budgets |
| `/config/features` | Admin-controlled feature flags (live-synced to all users) |
| `/config/announcement` | Admin broadcast banner (live-synced to all users) |
| `/config/adminSettings` | Hashed admin PIN |
| `/appEvents` | Global event log — anonymous usage signals |

---

## Deployment

### Vercel (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from the project root
vercel --prod
```

Add all frontend environment variables in the **Vercel dashboard → Settings → Environment Variables**.

The included `vercel.json` handles:
- `/api/*` → Express server (serverless)
- `/*` → `index.html` (SPA client-side routing)
- Long-term cache headers for hashed assets

---

### Self-hosted

```bash
# Build frontend + bundle Express
npm run build

# Start the production server (serves both API and static files)
npm start
```

---

## Contributing

1. **Fork** the repository and clone your fork
2. **Create** a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Write** your code following the patterns in the codebase
4. **Commit** with a conventional prefix:

   | Prefix | When to use |
   |---|---|
   | `feat:` | New feature or screen |
   | `fix:` | Bug fix |
   | `chore:` | Dependencies, tooling, config |
   | `docs:` | Documentation only |

5. **Push** and open a **Pull Request** against `main`

### Code conventions

- All new frontend code in **TypeScript** — avoid `any`
- Feature code lives in `src/features/<feature>/` — screen + logic together
- Shared UI components go in `src/core/ui/`
- Pure utility functions go in `src/lib/`
- Use Dexie `useLiveQuery` for reactive data — avoid manual polling with `useEffect`
- Every merged change should have a clean, descriptive commit for an auditable history

---

<div align="center">

Built with ❤️ for Indian users &nbsp;·&nbsp; Powered by Google Gemini & Anthropic Claude

</div>

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VetCari Akıllı Defter — a veterinary clinic financial management app (customer/debt tracking) built for Turkish-speaking users. All UI text is in Turkish.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Production build
npm run lint       # ESLint (flat config, eslint 9+)
npm run preview    # Preview production build locally
npm run test       # Run all tests once (Vitest)
npm run test:watch # Run tests in watch mode
```

## Architecture

**Stack:** React 19 + Vite 8 + Firebase (Auth + Firestore) + Tailwind CSS 3 + Lucide icons. Deployed on Vercel.

**Routing:** State-based tab navigation in `App.jsx` via `activeTab` state (not a router library). Tabs: `dashboard`, `customers`, `customerDetail`, `drugs`. Unauthenticated users see `Login`.

**State management:** `App.jsx` holds navigation state. No Redux. Two Context providers:
- `ToastContext` — UI-layer toast/confirm system (app-wide, wraps entire app). `toast` object and context value are memoized (`useMemo`) for stable references
- `CustomerContext` — selected customer data + action handlers (scoped to `customerDetail` tab only)

Custom hooks:
- `useAuth()` — wraps `onAuthStateChanged`, returns `currentUser` and `loading`
- `useFirestore(currentUser)` — real-time `onSnapshot` listeners on 5 Firestore collections with error callbacks (connection drop sets `dataLoading=false` instead of infinite spinner), returns `customers`, `drugs`, `serviceDebts`, `drugDebts`, `transactions`, `dataLoading`
- `useToast()` — returns `{ toast, confirm }` from `ToastContext`
- `useCustomer()` — returns `{ customer, drugs, serviceDebts, drugDebts, transactions, onToggleLock, onReturnDrug, onToggleBatchLock, onReturnBatch, onDeleteServiceDebt, onApplyPayment, onAddDebtTransaction }` from `CustomerContext`

**Data layer:** All Firestore CRUD lives in `src/services/firestoreOperations.js`. Uses `writeBatch()` for multi-document operations. Creates transaction audit logs on writes. Firebase config is initialized in `src/services/firebase.js` with IndexedDB persistence enabled.

**Firestore collections:** `customers`, `drugs`, `serviceDebts`, `drugDebts`, `transactions`.

### Key business rules

- Customer deletion blocked if active debts exist; drug deletion blocked if customer debts reference it
- Debts below 10₺ are auto-swept (micro-transaction cleanup)
- Drug debts support price locking (`isFixed`) to prevent inflation adjustments on existing debts
- Customer `balance` field tracks advance payments that offset new debts
- Payment distribution spreads a payment across multiple debts. Both service and drug debt payments write `Tahsilat` transaction logs. Rounding uses `Math.round(x * 100) / 100` (0.01 TL precision) consistently across modal and backend
- Past-dated debts can be entered with custom pricing, partial payment deduction, and optional inflation application
- Transaction logs use `dateOverride` for past dates while `timestamp` tracks actual creation time
- "Today" is always produced by `todayLocal()` from `utils/dates.js` (local `YYYY-MM-DD`). Never use `new Date().toISOString().split('T')[0]` — it returns UTC, which shifts dates back a day between 00:00–03:00 local time (Turkey is UTC+3)
- Service and drug debts entered in one visit are written by a single `addDebtTransactionOperations` call — one atomic `writeBatch`, one shared `batchId` (+ `createdAt`) across both collections. They render as one transaction card in CustomerDetail, HistoryModal and PaymentModal. Records without `batchId` fall back to `` `${type}:${doc.id}` `` as a single-item group — no migration needed. Grouping logic lives in `utils/debtGrouping.js` (`groupDebtsByBatch`); each item carries `type: 'service' | 'drug'`
- Group-level lock/return (`toggleBatchLockOperations`, `returnBatchOperations`) apply to drug items only; service debts are cancelled via `deleteServiceDebtOperations`, not returned
- PaymentModal grouping is render-only: the distribution waterfall pays all service debts first and carries rounding remainder in array order, so `distribution`, `extreDDebts` order and `manualOverrides` keys must never be reordered or re-keyed

## Component layout

```
src/
├── components/
│   ├── auth/Login.jsx           # Firebase email/password auth
│   ├── layout/Header.jsx        # Nav header with tab switching
│   ├── dashboard/DashboardView  # Summary stats & top debtors
│   ├── customers/               # CustomersView (list+CRUD), CustomerDetail (detail+transactions)
│   ├── drugs/DrugsView          # Drug inventory & price management
│   ├── modals/                  # DebtModal (today+past unified), PaymentModal, HistoryModal
│   └── ui/                      # Toast, ToastContainer, ConfirmModal
├── contexts/
│   ├── ToastContext.jsx         # Toast + async confirm (Promise-based)
│   └── CustomerContext.jsx      # Selected customer data + handlers (scoped)
├── hooks/                       # useAuth, useFirestore, useToast, useCustomer
├── services/                    # firebase.js (init), firestoreOperations.js (all DB ops)
├── test/                        # Vitest helpers: setup.js, firebaseMock.js
└── utils/formatters.js          # Turkish number/currency formatting
```

## Styling conventions

Tailwind utility classes throughout. Color scheme: indigo (primary), rose (debt/negative), emerald (credit/positive), slate (neutral). Card-based layouts with `rounded-xl`, `shadow-sm`. Responsive via `sm:`/`md:`/`lg:` breakpoints.

## Environment variables

Six `VITE_FIREBASE_*` env vars required in `.env` (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID). Firebase project ID is `vetcari`.

## Deployment

Vercel with SPA rewrite (`vercel.json` routes all paths to `/index.html`).

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
- A price change is previewed before it is written: `computePriceImpact` (`utils/priceImpact.js`) shows which customers/debts are affected, and decreases show that they will **not** propagate. `updateDrugPrice` and the preview both pick debts via `selectAffectedDebts`, so the preview can never drift from what is actually written. Price logs carry `batchId`, per-debt `maxPriceBefore/After` and `drugPriceBefore/After`, which `revertDrugPriceOperations` uses to undo the **last** hike — guarded by `canRevertPriceUpdate` (fail-closed). Revert logs deliberately omit `maxPriceBefore` so an undo cannot itself be undone. Hikes made before this existed carry no such data and cannot be reverted
- Customer `balance` field tracks advance payments that offset new debts
- Payment distribution spreads a payment across multiple debts. Both service and drug debt payments write `Tahsilat` transaction logs. Rounding uses `Math.round(x * 100) / 100` (0.01 TL precision) consistently across modal and backend
- Payments are reversible: each `Tahsilat` log carries `batchId`, `deduct`, `removed` and `before` (the debt's full pre-payment snapshot), plus the batch-wide `balanceDelta`. `revertPaymentOperations` restores every debt with `set(ref, before)` — a swept/deleted debt comes back under **the same document id**, so its old logs stay attached — and applies the inverse balance delta. Guarded by `canRevertPayment` (`utils/paymentRevert.js`, fail-closed, last payment only); revert logs omit `balanceDelta` so an undo cannot itself be undone. Money that isn't distributed to debts now writes an `Avans Girişi` log — advance movements used to be invisible in the ledger
- Past-dated debts can be entered with custom pricing, partial payment deduction, and optional inflation application
- Transaction logs use `dateOverride` for past dates while `timestamp` tracks actual creation time. A log's `date` is **the date of the event it describes**: opening → transaction date, embedded `Geçmiş Tahsilat` → payment date, entry-path `Süpürücü` → the payment date that triggered it. `Enflasyon Güncellemesi` and the return/payment-path sweepers stay on **today** — those events really do happen today
- "Today" is always produced by `todayLocal()` from `utils/dates.js` (local `YYYY-MM-DD`). Never use `new Date().toISOString().split('T')[0]` — it returns UTC, which shifts dates back a day between 00:00–03:00 local time (Turkey is UTC+3)
- Service and drug debts entered in one visit are written by a single `addDebtTransactionOperations` call — one atomic `writeBatch`, one shared `batchId` (+ `createdAt`) across both collections. They render as one transaction card in CustomerDetail, HistoryModal and PaymentModal. Legacy records without `batchId` are grouped by their `date` instead (`` `legacy:${date}` ``), so same-day legacy debts render as one transaction card; records with neither field fall back to `` `${type}:${doc.id}` `` as a single-item group — no migration needed. Grouping logic lives in `utils/debtGrouping.js` (`groupDebtsByBatch`); each item carries `type: 'service' | 'drug'`
- Group-level lock/return (`toggleBatchLockOperations`, `returnBatchOperations`) apply to drug items only; service debts are cancelled via `cancelDebtItemOperations`, not returned
- A single line can be cancelled with `cancelDebtItemOperations` (both types, reason required). Unlike transaction-level cancel this has **no guard** — it is the successor of the old "delete the remainder" on service debts and stays meaningful on a partly-paid line (collected money is not refunded; the modal says so). Its cancel log deliberately carries **no `batchId`** so sibling items in the same transaction are unaffected; cancelled state comes from `cancelledDebtIds` (`debtId`) alongside `cancelledBatchIds`
- Revert logs (payment and price) carry `revertOf` — the batch they neutralised. `canCancelBatch` ignores both the neutralised batch's logs and the revert logs, so a fully reverted payment/hike re-opens the entry's cancel
- Transaction logs carry `kind` (`entry` | `payment` | `return` | `price` | `lock` | `cancel`) and, on the entry path, the transaction's `batchId`. A whole mis-entered transaction is undone by `cancelDebtTransactionOperations` — debt docs are deleted, logs are **kept** and shown struck-through (cancelled state is derived client-side from the `kind: 'cancel'` log, never written back to old logs). The guard lives in `utils/batchCancel.js` and reads `kind`, never log titles; it is **fail-closed** (an unrecognized log blocks cancellation). Logs sharing the transaction's `batchId` are part of the entry — including the partial payment embedded in a past-dated debt — so they never block cancellation; a later payment/return/price change does
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
│   ├── modals/                  # DebtModal (today+past unified), PaymentModal, HistoryModal, BatchReturnModal
│   └── ui/                      # Toast, ToastContainer, ConfirmModal
├── contexts/
│   ├── ToastContext.jsx         # Toast + async confirm (Promise-based)
│   └── CustomerContext.jsx      # Selected customer data + handlers (scoped)
├── hooks/                       # useAuth, useFirestore, useToast, useCustomer
├── services/                    # firebase.js (init), firestoreOperations.js (all DB ops)
├── test/                        # Vitest helpers: setup.js, firebaseMock.js, renderWithCustomer.jsx
└── utils/                       # formatters.js (tr-TR number/currency), dates.js (todayLocal),
                                 # debtGrouping.js (groupDebtsByBatch)
```

## Styling conventions

Tailwind utility classes throughout. Color scheme: indigo (primary), rose (debt/negative), emerald (credit/positive), slate (neutral). Card-based layouts with `rounded-xl`, `shadow-sm`. Responsive via `sm:`/`md:`/`lg:` breakpoints.

## Environment variables

Six `VITE_FIREBASE_*` env vars required in `.env` (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID). Firebase project ID is `vetcari`.

## Deployment

Vercel with SPA rewrite (`vercel.json` routes all paths to `/index.html`).

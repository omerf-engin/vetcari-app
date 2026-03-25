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

**State management:** No Redux/Context. `App.jsx` holds navigation state. Two custom hooks provide all data:
- `useAuth()` — wraps `onAuthStateChanged`, returns `currentUser` and `loading`
- `useFirestore(currentUser)` — real-time `onSnapshot` listeners on 5 Firestore collections, returns `customers`, `drugs`, `serviceDebts`, `drugDebts`, `transactions`, `dataLoading`

**Data layer:** All Firestore CRUD lives in `src/services/firestoreOperations.js`. Uses `writeBatch()` for multi-document operations. Creates transaction audit logs on writes. Firebase config is initialized in `src/services/firebase.js` with IndexedDB persistence enabled.

**Firestore collections:** `customers`, `drugs`, `serviceDebts`, `drugDebts`, `transactions`.

### Key business rules

- Customer deletion blocked if active debts exist; drug deletion blocked if customer debts reference it
- Debts below 10₺ are auto-swept (micro-transaction cleanup)
- Drug debts support price locking (`isFixed`) to prevent inflation adjustments on existing debts
- Customer `balance` field tracks advance payments that offset new debts
- Payment distribution spreads a payment across multiple debts

## Component layout

```
src/
├── components/
│   ├── auth/Login.jsx           # Firebase email/password auth
│   ├── layout/Header.jsx        # Nav header with tab switching
│   ├── dashboard/DashboardView  # Summary stats & top debtors
│   ├── customers/               # CustomersView (list+CRUD), CustomerDetail (detail+transactions)
│   ├── drugs/DrugsView          # Drug inventory & price management
│   └── modals/                  # PaymentModal, HistoryModal
├── hooks/                       # useAuth, useFirestore
├── services/                    # firebase.js (init), firestoreOperations.js (all DB ops)
└── utils/formatters.js          # Turkish number/currency formatting
```

## Styling conventions

Tailwind utility classes throughout. Color scheme: indigo (primary), rose (debt/negative), emerald (credit/positive), slate (neutral). Card-based layouts with `rounded-xl`, `shadow-sm`. Responsive via `sm:`/`md:`/`lg:` breakpoints.

## Environment variables

Six `VITE_FIREBASE_*` env vars required in `.env` (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID). Firebase project ID is `vetcari`.

## Deployment

Vercel with SPA rewrite (`vercel.json` routes all paths to `/index.html`).

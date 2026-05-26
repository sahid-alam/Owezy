# Owezy 💸

> **UPI-native friend debt tracker.** Splitwise reimagined for India: direct UPI deep links, customizable WhatsApp reminders, AI-powered receipt scanning, and a feature-rich Trip Mode.

Owezy is an installable Progressive Web Application (PWA) designed to eliminate the friction of tracking and settling shared expenses. By leveraging highly optimized client-side processing, localized UPI intent schemes, and serverless vision/NLP AI models, Owezy offers a fast, premium, and private way to stay squared up with college classmates, roommates, trip groups, and friends.

---

## ✨ Features

### 🇮🇳 UPI-Native Settlements (Zero Friction)
*   **Direct App Launching:** Generates dynamic, application-specific UPI deep links (`upi://pay?pa=...&am=...`) prefilled with the exact settlement amount and payee details.
*   **Chooser Integration:** Directly supports GPay, PhonePe, and Paytm, automatically routing the user into their preferred UPI platform.
*   **Four Confirmation Layers:**
    1.  **UPI Deep Link:** Initiate direct transfer in external app.
    2.  **Payer Mark-as-Paid:** Payer manually records the transaction on Owezy.
    3.  **Recipient Confirmation:** Recipient receives a real-time push notification to verify receipt, finalising and clearing the debt.
    4.  **UPI SMS Auto-Match:** (Phase 2 native Android) Transparent, visible confirmation banner.

### 🤖 AI-Powered receipt scanning (Vision & NLP)
*   **Vision OCR:** Powered by Deno Edge Functions calling **Mistral Vision (pixtral-12b-2409)**. Scan printed bills, handwritten chits, Swiggy/Zomato receipts, or mobile screenshots.
*   **Review & Refine:** High-fidelity interactive UI allows users to correct OCR mistakes, delete unwanted line items, and auto-merge tax/service charge rows into base prices.
*   **Natural Language Descriptions:** Speak or type details (e.g., *"Yasir had the lime soda and one third of the patiala chicken, Ayan didn't take any beverages"*) to perform fractional, item-specific splits.
*   **Voice Quick-Add:** Record a quick voice note (e.g., *"Chai for 4, 80 rupees, I paid"*) on the main expense sheet. The system auto-fills the entire manual form in seconds.

### ✈️ Flagship Trip Mode (Direction B)
*   **Time-Bounded Contexts:** Completely isolated from daily tracking. Perfect for weekend treks, beach trips, or group holidays.
*   **Smart Budgets:** Track overall and per-person estimates. Monitor real-time spending compared to daily thresholds.
*   **Per-Day Expenses:** Visual timelines grouped neatly by date using localized calendar formats to avoid UTC off-by-one errors.
*   **Viral Recap Loop:** Generates a one-tap, highly aesthetic shareable SVG recap card showing trip stats, top categories, and member initials for easy distribution on WhatsApp or Instagram.

### 📶 Premium PWA & Offline-First Experience
*   **Installable:** Prompts to install natively on iOS (Safari Add-to-Home screen) and Android (Native Install prompt) gated by session count (`≥ 3` sessions).
*   **Offline Access:** Read cached balances, expense histories, and groups completely offline via Workbox.
*   **Mutation Guards:** Blocks mutations while offline with a cohesive global toast message (`📵 You're offline — try again when connected`) to prevent cache state divergence.

### 🔒 Security-First RLS Isolation
*   **Isolated Data:** Row Level Security (RLS) is strictly enforced on all 13 database tables. No profile can ever read transaction records or friend networks they aren't directly linked to.
*   **Security Definer RPCs:** Safely bypasses RLS bootstrap deadlocks (e.g. creating groups/trips) through tightly designed and parameterized security functions.

---

## 🛠️ Tech Stack

| Layer | Choice |
| :--- | :--- |
| **Frontend** | React 19 (StrictMode), Vite 6, Tailwind CSS v4, React Router v7 |
| **Database & Auth** | Supabase (PostgreSQL with RLS, Realtime Subscriptions, Database Triggers) |
| **Server Logic** | Supabase Edge Functions (Deno Runtime) |
| **State Management** | Zustand (local UI & wizard state), React Query (server cache) |
| **Forms & Schemas** | React Hook Form, Zod Validation |
| **Caching & PWA** | `vite-plugin-pwa`, Workbox caching (NetworkFirst for REST, CacheFirst for Storage) |
| **AI Models** | Mistral Vision API (pixtral-12b-2409) for OCR, Mistral Small for quick-add/split logic |

---

## 📂 Repository Layout

```text
/
├── src/
│   ├── components/        # Shared UI components (flat structure)
│   ├── pages/             # Route pages grouped by feature domain
│   │   ├── expenses/      # Expense detail, manual add/edit, AI scan
│   │   ├── friends/       # Friends listing and detail
│   │   ├── groups/        # Group creation, details, and member management
│   │   ├── onboarding/    # Multi-step signup onboarding wizard
│   │   ├── settlements/   # UPI SettleUp flow and confirmation screen
│   │   └── trips/         # Trip dashboard, budget planner, and recap card
│   ├── hooks/             # Feature-specific state and API React Query hooks (13 total)
│   ├── store/             # Zustand stores (onboarding.js)
│   ├── lib/               # FRAMEWORK-AGNOSTIC CORE - Moves to packages/core in Phase 2
│   └── lib-web/           # Browser-only adapters (image compression, speech APIs)
├── supabase/
│   ├── migrations/        # 28 SQL migrations (Applied & Locked)
│   └── functions/         # 5 Deno Edge Functions (ai-ocr, ai-split, ai-quick-add, etc.)
├── public/
│   ├── manifest.json      # Owezy PWA Configuration
│   └── icons/             # App icons (Maskable safe-zone compliant)
└── GUIDE.md               # Quick-start manual for friends and users
```

> [!NOTE]
> All code residing in `src/lib/` is completely **framework-agnostic** (no React, no JSX, no hooks, no DOM-specific APIs like `window` or `document`). This critical rule ensures the code can be migrated to React Native Expo (Phase 2) mechanically without a rewrite.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Docker (required to run local Supabase Stack)
*   Supabase CLI

### Local Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/sahid-alam/Owezy.git
    cd Owezy
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Start Local Supabase Stack:**
    Make sure Docker is running, then initialize Supabase:
    ```bash
    npx supabase start
    ```
    *This starts local Postgres, Studio, Auth, Storage, and Edge Functions containers.*

4.  **Environment Variables:**
    Copy `.env.example` to `.env.local` and populate it with your local Supabase credentials:
    ```env
    VITE_SUPABASE_URL=http://localhost:54321
    VITE_SUPABASE_ANON_KEY=your_local_anon_key
    ```

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

---

## 💾 Data Model

Owezy runs on 13 RLS-hardened tables applied via SQL migrations:

1.  `profiles`: Authenticated user profiles (Google metadata, phone skip, upi skip, onboarding completed status).
2.  `guest_profiles`: Orphaned phone numbers added by friends before they sign up.
3.  `friendships`: Bidirectional friendships using a composite unique index (`least(user_id, friend_id), greatest(user_id, friend_id)`).
4.  `groups`: Metadata for shared expense spaces.
5.  `group_members`: Junction table managing member permissions and admin states.
6.  `trips`: Metadata for time-bound travel configurations (destination, budget estimates, daily targets).
7.  `trip_members`: Junction table for trip roles.
8.  `expenses`: Base expense records (amount in paise, paid-by relation, optional receipt path, category).
9.  `expense_splits`: Itemized attribution mapping back to consumer profiles (supports equal, fixed, and item splits).
10. `settlements`: Ledger records documenting payers, payees, marking status, and confirmations.
11. `notifications`: Persistent inbox feed.
12. `notification_prefs`: Granular per-user toggles for Owezy's 10 notification triggers.
13. `ai_usage`: Daily tracker logging AI API hits to enforce caps.

### 📐 Key Database Design Decisions
*   **paise Math:** All currency values are stored as integers representing `paise` (1 INR = 100 paise) internally to eliminate IEEE 754 floating-point rounding errors during multi-party splits.
*   **Soft Deletes:** Deletion uses a `deleted_at timestamptz` flag. Rows are never physically dropped to guarantee audit log and balance integrity.
*   **FIFO Settlements:** Settlement entries reduce the oldest outstanding debt first. If a settlement exceeds the total due, the excess propagates forward and reverses the debt direction automatically.

---

## ⚡ Free-Tier Survival & Optimizations

To keep the platform performant and hostable on free-tier instances:
*   **Database Retention:** A scheduled daily job `cleanup-receipts` deletes receipt photo uploads older than 30 days.
*   **Auto-Pause Mitigation:** cron-job.org pings the Supabase database REST endpoint every 3 days to keep the project active.
*   **AI Rate Limits:** Enforced via a server-side `ai_usage` check. Users are capped at 20 AI OCR/split requests per day. OCR retries are logged under a `'retry'` tag to ensure correct cap evaluations.
*   **Image Compression:** Images are compressed client-side (JPEG, quality 0.7, max 1MB) before being pushed to Supabase storage to save bandwidth and storage.

---

## 🚧 Phase 2 Future Scope

While Phase 1 MVP is fully complete, Owezy's schema and structure have been explicitly designed to scale into:
1.  **React Native Expo App:** Re-building the web shell while consuming the `src/lib` package in a monorepo.
2.  **SMS Auto-Match (Android):** Read incoming UPI SMS confirmation notifications to auto-settle debts transparently.
3.  **OTP Verification:** Phone number checks using Twilio or Supabase Auth, unlocking automated guest profile reclaims.
4.  **Multi-app Deep Links:** Pre-routing to direct vendor gateways (GPay, PhonePe, Paytm intents) to skip chooser steps.

# CLAUDE.md

Single source of truth for Claude Code on this project. Read top-to-bottom before any task. Update this file when decisions change.

---

## Project

**UPI-native friend debt tracker.** Splitwise reimagined for India: UPI deep links, WhatsApp reminders, Claude-powered bill splitting from receipt photos + natural-language description.

**Status:** Auth (Pass 1), onboarding wizard (Pass 2), friends graph (Pass 3), groups (Pass 4), expenses — manual add/edit/delete (Pass 5), balance view + settlements (Pass 6), notifications + reminders (Pass 7), Trip Mode (Pass 8) complete. Next: AI receipt scan + voice splits (Pass 9).

**Settlement FIFO rule (locked):** Confirmed settlements reduce the debtor's oldest expense obligations first. Overpayment flips balance direction — no artificial clamping.

**Target users:** college students, flatmates, trip groups, office friends. INR only.

---

## Tech Stack (locked)

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind CSS (PWA: manifest + service worker) |
| Backend | Supabase — Postgres, Auth, Realtime, Edge Functions (Deno), Storage |
| Hosting | Vercel (frontend) + Supabase (backend) |
| AI | Anthropic Claude API — receipt OCR (vision), voice/text split parsing |
| Notifications | PWA push (web-push) + WhatsApp `wa.me` deep links |
| Scheduler | cron-job.org → Supabase Edge Function (also keeps free-tier project alive) |

**Do not introduce new dependencies without asking.** No Next.js, no Firebase, no Express, no separate Node backend. Supabase Edge Functions handle all server logic.

---

## Platform Roadmap (locked)

**Phase 1 (now):** React + Vite PWA. Installable on both Android and iOS via "Add to Home Screen". No Next.js, no Capacitor, no native wrappers yet.

**Phase 2 (later):** React Native via **Expo** + Expo Router. Monorepo with shared core. Triggered when UPI SMS auto-match becomes priority (Android-only feature anyway).

**Not on the table:** Next.js (no SSR/SEO surface to justify it), native Swift/Kotlin (single codebase via Expo wins for this product).

**Implication for now:** structure the codebase so the eventual RN migration is mechanical, not a rewrite. See "Framework-Agnostic Core" below.

---

## Repo Layout (target)

```
/
├── src/
│   ├── components/        # React-only UI primitives (web)
│   ├── features/          # auth, friends, groups, trips, expenses, settlements, ai
│   ├── hooks/             # React hooks (web)
│   ├── pages/
│   ├── lib/               # FRAMEWORK-AGNOSTIC — see rules below
│   ├── lib-web/           # browser-only helpers (canvas, URL, DOM) — not components, not lib/. Becomes lib-native/ in RN migration
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   ├── migrations/        # SQL migrations
│   └── functions/         # edge functions (deno)
├── public/                # manifest.json, icons, service-worker
├── .env.local             # never commit
└── CLAUDE.md
```

Keep features colocated. Each feature folder owns its components, hooks, and queries. No `utils/index.js` dumping ground.

---

## Framework-Agnostic Core (`src/lib/`)

Everything in `src/lib/` must be portable to React Native without modification. This is non-negotiable — it's the entire point of staying on Vite now instead of Next.js.

**Rules for `src/lib/`:**
- No `import React from 'react'`. No JSX. No hooks
- No `window`, `document`, `localStorage`, `navigator` — use injected adapters if needed
- No DOM-specific libraries (no `dompurify`, no `react-router`, no `html2canvas`)
- Pure functions, plain classes, or framework-agnostic clients only
- Each file should run unchanged in Node, Deno, Bun, RN, and the browser

**What lives in `src/lib/`:**
- `supabase.js` — single Supabase client instance
- `claude.js` — wrapper for calls to our Edge Function (not direct Anthropic SDK)
- `upi.js` — UPI deep link builder (`upi://pay?...`), per-app variants
- `debt-simplify.js` — A→B→C reduction algorithm
- `balance.js` — balance calculation from expenses + settlements
- `money.js` — paise ↔ rupee conversion, formatting, safe math
- `schemas/` — Zod schemas for all entities (expense, split, settlement, etc.)
- `whatsapp.js` — `wa.me` link builder, message template renderer
- `queries/` — typed Supabase query wrappers (RPC + table queries)

**What does NOT live in `src/lib/`:**
- React Query setup → `src/hooks/`
- Form components → `src/components/` or `src/features/<x>/`
- Tailwind class helpers → `src/components/` (Tailwind is web-only)
- Service worker, PWA install prompt → `src/lib-web/` if needed (clearly web-flagged)

When the Expo migration happens, `src/lib/` moves to `packages/core/` in a monorepo. Zero changes. Web app becomes `apps/web/`, RN app becomes `apps/mobile/`. Both consume `packages/core/`.

---

## MVP Scope (locked)

### Platform
PWA. Android installable, iOS installable (push limited to iOS 16.4+). Offline = full read of cached data, writes queue and sync on reconnect.

### Auth
- Primary: Google Sign-in via Supabase
- Fallback: Email + password
- Post-signup profile: name, photo, phone (unverified, optional — addable later in settings), UPI ID (UPI skippable, prompted again at first settlement)
- Language: English only

### Friends
- Add by phone or name search
- Invite non-users via WhatsApp / shareable link → **guest view** (expense saved against phone number; auto-claim deferred — see Guest Invite Reclaim below)
- Friends see only shared expenses, never full history
- Per-friend net balance shown

### Guest Invite Reclaim Flow
MVP gap: guests invited before signup stay as orphan `guest_profiles` rows. They don't break balance views — `expense_splits` with `guest_id` set are excluded from active totals. The `claim_guest_profile()` RPC is in the DB and correctly migrates splits + settlements, but is not called from app code yet.

Reclaim UI (a profile-settings entry "Were you added to expenses before signing up?") is Phase 2 scope. Build when invite volume justifies it.

`handle_new_user` is unchanged: name comes from Google OAuth `full_name`/`name` metadata, or `''` for email signups. Phone from OAuth metadata (if Google ever returns one) will populate `profiles.phone` via the same trigger, unverified.

### Groups
- Any member can create
- Roles: admin (manage members, archive), member. Multiple admins allowed. Last admin must transfer before leaving
- Cannot leave with pending balance. Admin can force-remove only if target's balance is zero
- Lifecycle: active → archived only when all balances are zero. **No hard delete.** Soft archive preserves history

### Trip Mode (flagship — Direction B)
Distinct from groups. Time-bounded, budget-aware, shareable.
- Creation: name, destination, start/end date, total budget, members
- Budget tracker (overall + per-person estimate)
- Per-day expense view (grouped by date)
- Per-expense member selection ("Ayan skipped the trek")
- Post-trip summary screen after end date
- One-tap shareable recap card for WhatsApp/Instagram (viral loop)
- Auto-archive: stays active past end date until balances are zero, then prompts to archive. If unsettled past end date → "trip ended, settle up" notification

### Expense Add — Two Modes

**Manual mode** (default): title, amount, paid-by, split. ~15s, zero AI.

**AI mode** (camera/mic button on same screen):
- Photo scan → review extracted items → describe split (voice OR text OR tap-to-assign) → AI splits → review → confirm
- Voice quick-add for simple expenses: "Chai for 4, 80 rupees, I paid"
- **AI always populates the manual form, never replaces it.** User reviews before save

### Receipt Scan Flow (the wow feature)
1. **Scan** — camera or upload. Handles printed bills, handwritten chits, Swiggy/Zomato screenshots, photo-of-screen
2. **Review items** — user fixes OCR mistakes, merges duplicates, deletes irrelevant lines (GST breakdown rows auto-merge into total)
3. **Describe** — user speaks/types referencing visible item names: *"Yasir had the lime soda and one third of the patiala chicken, Ayan didn't take any beverage..."* OR taps items + people. Voice and tap work side-by-side
4. **AI processes** — Claude takes confirmed items + description, outputs per-person amount with full item attribution. Handles fractional consumption ("one third"), sub-splits ("rest split among three"), zero consumption, GST/charges proportional to subtotal, rounding remainders absorbed by highest share by default
5. **Review + adjust** — editable breakdown. Unattributed items flagged: "Who had the Masala Papad?". User can re-describe without rescanning, or fall back to tap-to-assign for any flagged item
6. **Confirm** — saves as normal expense

### Expense Edit / Delete
- Creator edits title, amount, paid-by, category, date
- Any participant can add more people to split. Cannot remove others or change assigned amounts
- Edit auto-recalculates all balances
- **Soft delete only.** Shows as "Removed expense" with amount preserved for balance integrity

### Split Logic
- Equal (default), custom amounts, item-level (from AI), GST/charges proportional to subtotal (toggle to equal-per-line)
- Flat discounts reduce proportionally; item-specific discounts reduce only relevant consumers
- **Debt simplification:** A→B ₹500, B→C ₹500 ⟹ A→C ₹500. Runs automatically across all balances. ~30 LOC algorithm

### Balance View
- Top level: total per friend ("You owe Sahid ₹1,700") with single Pay Now
- Drill-down: per-source breakdown (Dinner ₹500, Goa Trip ₹1,200, tap to expand trip)
- Partial settlements supported — clears specific sources, total updates live

### Settlement — 4 Confirmation Layers
1. **UPI deep link** — `upi://pay?pa=...&am=...&pn=...&tn=...`. User picks preferred app in profile (GPay / PhonePe / Paytm) to control deep link format
2. **Mark as paid** — manual confirmation by payer
3. **Recipient confirms** — payee gets notification, confirms received
4. **UPI SMS auto-match** — Phase 2 (native Android only). When fires, **both parties get a visible confirmation banner — never silent**. Trust requires transparency

### Reminders
- **Passive default:** one reminder at day 3, one at day 7, then silent. Friendly tone, comes-from-friend voice ("Sahid is waiting for ₹300 from Goa trip — settle now?"), not debt-collector
- **User-controlled override:** person owed can manually nudge anytime, or toggle "remind every N days" on a specific debt
- Channels: PWA push + WhatsApp `wa.me` with UPI link inline
- **WhatsApp template:** user previews and can edit before send. Stays personal, not automated-feeling

### Notification Types (10, all individually toggleable in profile)
1. New expense added (you're in split)
2. Expense edited
3. Reminder (day 3 / day 7 / user-triggered)
4. Settlement initiated
5. Settlement confirmed
6. UPI SMS auto-match fired (Phase 2)
7. Group: added to / removed from
8. Group: admin role granted / revoked
9. Trip ended, settle up
10. Friend request received / accepted

### Account Deletion
- Request → 30-day deactivation window (recovery possible)
- After 30 days: full wipe except anonymised transaction records affecting others (attributed to "Deleted User") so group history stays intact

---

## Data Model (current)

12 tables applied to Supabase (project `kuwctkxsafdyhgykmgdh`). All RLS-enabled. No table has zero policies.

**Tables:**
`profiles`, `guest_profiles`, `friendships`, `groups`, `group_members`, `trips`, `trip_members`, `expenses`, `expense_splits`, `settlements`, `notifications`, `notification_prefs`

**SECURITY DEFINER functions:**
- `set_updated_at()` — utility trigger function used by all tables with updated_at
- `handle_new_user()` — creates profile row when auth.users row is inserted
- `handle_new_profile()` — creates notification_prefs row when profile is inserted
- `is_group_member(gid uuid)` — RLS helper; bypasses group_members RLS to break recursion
- `is_trip_member(tid uuid)` — RLS helper; bypasses trip_members RLS
- `is_expense_participant(eid uuid)` — RLS helper; bypasses expense_splits RLS (added in hotfix 5b to break mutual recursion with expenses)
- `handle_new_group()` — trigger: auto-adds group creator as admin, bypasses bootstrap deadlock
- `handle_new_trip()` — trigger: auto-adds trip creator as admin, bypasses bootstrap deadlock
- `claim_guest_profile()` — RPC called post-signup; migrates guest_profiles splits + settlements to real profile using phone from profiles (never a parameter); uses FOR UPDATE to serialize concurrent claims

**Conventions:**
- All money: `numeric(10,2)`, INR, never floats
- All timestamps: `timestamptz default now()`
- All IDs: `uuid default gen_random_uuid()`
- Soft delete: `deleted_at timestamptz` column, never `DELETE` rows
- **Row Level Security on every table.** No exceptions. Friend data isolation is enforced at DB, not app
- No DELETE policies anywhere — soft delete only
- Client never INSERTs into group_members or trip_members directly; all post-bootstrap additions go through a SECURITY DEFINER RPC

Schema lives in `/supabase/migrations/`. Every change is a new migration file. Never edit a committed migration.

---

## Phase Boundaries

**Phase 1 (MVP — build now):**
Auth, friends, groups, trips, manual expense add, AI receipt scan + voice splits, balance view + drill-down, UPI deep links, manual settlement, WhatsApp reminders, passive + user-controlled reminders, PWA install, offline read.

**Phase 2 (do not build yet — but data model must support):**
UPI SMS auto-match (native Android wrapper), debt simplification UI polish, "freeloader" gamified insights, settlement streaks, Hindi support, premium tier (export, analytics, trip budget forecasting). Phone OTP verification + `claim_guest_profile()` wired back in (gates auto-claim on verified number). Guest Invite Reclaim UI in profile settings.

If a task creeps into Phase 2, stop and confirm with user.

---

## Free-Tier Survival

- **cron-job.org pings Supabase REST endpoint every 3 days** to prevent project auto-pause. Set up before first deploy
- Supabase limits to respect: 500MB DB, 1GB storage, 2GB bandwidth, 500K Edge Function calls/month, 50K MAU
- Receipt photos: compress client-side before upload (max 1MB, JPEG quality 0.7)
- Edge Function reminder cron runs once daily, batches all due reminders in one pass

---

## Conventions

- **TypeScript optional, JSX fine.** Match user's preference when they specify. Default: JSX with JSDoc on shared lib functions
- **Tailwind utility-first.** No CSS modules, no styled-components. Use `clsx` for conditionals
- **Supabase client:** single instance in `src/lib/supabase.js`. Never import `createClient` elsewhere
- **Claude calls:** route through a Supabase Edge Function (`/functions/ai-split`, `/functions/ai-ocr`). Never call Anthropic from the browser — API key must stay server-side
- **State:** React Query for server state, Zustand for local UI state. No Redux
- **Forms:** React Hook Form + Zod schemas
- **Money math:** integer paise internally where possible, format on display. Never `0.1 + 0.2`
- **Storage paths:** avatar uploads go to `${userId}/${timestamp}.jpg` — never prefix with the bucket name. Bucket is implicit in `supabase.storage.from('avatars')`. RLS uses `storage.foldername(name)[1] = auth.uid()::text` which resolves correctly only when the path is `{userId}/...` with no leading segment.
- **Errors:** user-facing toasts must be human ("Couldn't reach Sahid — try again?"), never raw Supabase error strings
- **Empty states:** every empty list is a prompt with one action button. Never a dead end. "Add Rahul to start splitting" not "No friends"
- **Reminder/WhatsApp copy tone:** casual, comes-from-friend, never debt-collector. Treat as product copy, not throwaway strings

---

## Workflow Rules for Claude Code

1. **Plan before coding.** For any task beyond a single-file edit, write the plan first and confirm
2. **One migration per schema change.** Name: `YYYYMMDDHHMMSS_short_description.sql`
3. **No new dependencies without asking.** Check `package.json` first
4. **No commented-out code** in commits. Delete it
5. **Test the happy path manually** before declaring done. List the steps in the response
6. **Never commit `.env*` files.** `.gitignore` must cover `.env`, `.env.local`, `.env.*.local`
7. **RLS first.** When adding a table, write the RLS policies in the same migration. A table without policies is a bug
8. **Match existing patterns.** If the codebase does X one way, do X that way. Don't introduce a second pattern without surfacing it
9. **Soft delete only.** Never write `DELETE FROM` in app code. `update ... set deleted_at = now()` instead
10. **Money is `numeric`, not `float`.** Money on the wire is paise (integer) or string. Never JS `number` for amounts in transit
11. **`src/lib/` stays framework-agnostic.** No React, no DOM, no Tailwind, no `window`. If you're tempted to put a hook or JSX there, it belongs in `src/hooks/` or `src/components/` instead. Phase 2 RN migration depends on this rule holding

---

## Open Risks (acknowledged, mitigations chosen)

| Risk | Mitigation |
|---|---|
| PhonePe / CRED clone split feature | Social-graph lock-in via group adoption speed |
| iOS push limited | WhatsApp primary channel, push secondary |
| UPI SMS auto-match unavailable on PWA | Phase 2 with native Android |
| AI split parsing errors | Review screen before every save; re-describe without rescan |
| Supabase free-tier auto-pause | cron-job.org ping every 3 days |

---

## Commands

```bash
npm run dev          # vite dev server (localhost:5173)
npm run build        # production build → dist/
npm run preview      # preview production build locally
npx supabase start   # local supabase stack (docker required)
npx supabase db push # apply migrations to remote
npx supabase functions deploy <name>  # deploy edge function
```

**Dev-only Supabase settings (Dashboard → Auth → Providers → Email):**
- "Enable email confirmations" → OFF for local dev so email signup auto-logs in
- Re-enable before production deploy

## Database

Migrations applied (Supabase project `kuwctkxsafdyhgykmgdh`):

| File | Description |
|---|---|
| `20260519000001_profiles.sql` | profiles, guest_profiles, notification_prefs; auth trigger chain; set_updated_at utility |
| `20260519000002_friendships.sql` | friendships with bidirectional LEAST/GREATEST unique index |
| `20260519000003_groups.sql` | groups, group_members; is_group_member helper; creator-as-admin trigger |
| `20260519000004_trips.sql` | trips, trip_members; is_trip_member helper; creator-as-admin trigger |
| `20260519000005_expenses.sql` | expenses, expense_splits; RLS on both tables |
| `20260519000005b_expenses_rls_fix.sql` | is_expense_participant helper; fixes infinite RLS recursion between expenses ↔ expense_splits |
| `20260519000006_settlements.sql` | settlements; claim_guest_profile RPC for guest-to-real-profile migration |
| `20260519000007_notifications.sql` | notifications feed; no INSERT policy for authenticated users (service role only) |
| `20260519000008_onboarding_state.sql` | adds onboarding_phone_skipped, onboarding_upi_skipped to profiles; avatars storage bucket + RLS |
| `20260519000009_handle_new_user_no_email_prefix.sql` | handle_new_user uses '' instead of email prefix — email signups start at name step in onboarding |
| `20260519000010_onboarding_completed.sql` | adds onboarding_completed flag; OnboardingInProgressGate checks this instead of isProfileComplete |
| `20260519000011_group_member_rpcs.sql` | add_group_member RPC (admin-gated INSERT); leave_group RPC (any member, last-admin enforced) |
| `20260519000012_create_group_rpc.sql` | create_group RPC (SECURITY DEFINER); fixes INSERT…RETURNING + AFTER trigger + RLS interaction where is_group_member evaluates before handle_new_group fires |
| `20260519000013_fix_groups_update_policy.sql` | fixes groups UPDATE policy: was `group_members.group_id = group_members.id` (always false); corrected to `group_members.group_id = groups.id` |
| `20260519000014_expense_audit_log.sql` | extends `is_expense_participant` to cover payer + creator + group/trip member + split participant; creates `expense_audit_log` table with SELECT-only RLS using helper; SECURITY DEFINER triggers: `on_expense_changed` (AFTER INSERT OR UPDATE on expenses → 'created'/'edited'/'deleted'), `on_expense_split_added` (AFTER INSERT on expense_splits → 'split_added', suppressible via `app.skip_split_audit` GUC) |
| `20260519000015_expense_rpcs.sql` | four SECURITY DEFINER RPCs: `create_expense` (atomic insert + splits, suppresses split audit for initial splits), `update_expense` (creator-only patch + optional split replacement), `add_expense_participants` (equal-split-only upsert, audit fires only for new participants), `soft_delete_expense` (creator-only soft delete) |
| `20260519000016_friend_balances_view.sql` | `friend_balances` VIEW — derived balance per pair (user_a, user_b, net_amount, direction). auth.uid() CTE filter restricts each user to their own pairs. Only confirmed settlements affect balance. SECURITY INVOKER — RLS on underlying tables applies automatically. |
| `20260519000017_settlement_rpcs.sql` | four SECURITY DEFINER RPCs: `initiate_settlement`, `mark_settlement_paid`, `confirm_settlement`, `dispute_settlement`. Error codes: NOT_PAYER, NOT_PAYEE, WRONG_STATUS, SELF_SETTLE, INVALID_AMOUNT. |
| `20260519000018_notification_triggers.sql` | `insert_notification` helper (prefs-gated, no GRANT to authenticated); `get_reminder_candidates` RPC (service-role, no auth.uid() filter); 5 SECURITY DEFINER triggers: `on_expense_audit_notify` (CONSTRAINT DEFERRABLE INITIALLY DEFERRED on expense_audit_log), `on_settlement_notify`, `on_settlement_confirmed_cycle_reset`, `on_group_member_notify`, `on_friendship_notify`; `reminder_count_in_cycle` + `last_reminded_at` columns on friendships. |
| `20260519000019_notifications_realtime.sql` | `ALTER TABLE notifications REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE notifications` — required for Supabase Realtime postgres_changes to deliver INSERT events with row-level filter `recipient_id=eq.{userId}`. |
| `20260519000020_trip_write_rpcs.sql` | `daily_budget` column on trips; SECURITY DEFINER RPCs: `create_trip` (bypass INSERT+AFTER trigger+RLS), `add_trip_member`, `leave_trip`, `set_trip_member_role`. |
| `20260519000021_trip_query_rpcs.sql` | SECURITY DEFINER RPCs: `get_trip_balances` (trip-scoped pair balances, skips membership check under service role), `get_trip_summary` (totals + top categories for recap), `get_trip_personal_insights` (raw per-member stats for badge computation). |
| `20260519000022_trip_notifications.sql` | `notify_on_trip_member_change` trigger — reuses `group_added/removed/admin_granted/revoked` types with `data.context='trip'` to avoid new notification_prefs columns. |
| `20260519000023_fix_trip_insights_settle_secs.sql` | Fixes cartesian join bug in `get_trip_personal_insights`: `avg_settle_secs` now measures settlement initiation→confirmation time (`s.confirmed_at - s.created_at`), not a cross-join with expenses. |
| `20260519000024_fix_trip_balances_plpgsql_shadowing.sql` | Fixes PL/pgSQL variable shadowing: `RETURNS TABLE(user_a, user_b)` OUT params shadowed same-named CTE aliases. CTEs renamed to `ua`/`ub` internally, cast to `user_a`/`user_b` in final SELECT. |

**Known pattern — INSERT + AFTER trigger + RETURNING + RLS:**
Any table that uses an AFTER trigger to bootstrap membership (groups, trips) cannot use `INSERT … RETURNING` from the client, because the SELECT policy evaluates before the trigger fires. Solution: always route these INSERTs through a SECURITY DEFINER RPC that bypasses RLS, returns just the UUID.

---

**Trip Mode decisions (locked):**
- `get_trip_balances` is a SECURITY DEFINER RPC (not a view) — works under both auth and service-role contexts. `friend_balances` view returns empty rows under service role.
- Trip notifications reuse `group_added/removed/admin_granted/revoked` types with `data.context='trip'`. `notification-copy.js` checks this field to render trip vs group copy and route deep links to `/trips/` vs `/groups/`.
- Trip-tag algorithm priority order is locked — do not reorder without product review.
- Recap card SVG never includes full names — initials only by design (avoids Supabase Storage CORS issues with avatar images in SVG).
- Badge computation lives in `src/lib/trips.js` as pure JS function — not SQL — for easy iteration without migrations.
- `TripExpensesByDay` date generation uses `getFullYear/getMonth/getDate` (local time), not `toISOString()` (UTC) — avoids off-by-one day shift in UTC+5:30.
- Recap card blob URL created in `useEffect` (not `useMemo`) so React StrictMode double-invoke doesn't revoke the URL before the image loads.

*Last updated: auth (Pass 1), onboarding (Pass 2), friends graph (Pass 3), groups (Pass 4), expenses manual mode (Pass 5), balance view + settlements (Pass 6), notifications + reminders (Pass 7), Trip Mode (Pass 8) complete. Next: AI receipt scan + voice splits (Pass 9).*
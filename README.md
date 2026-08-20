# Innit

A two-person streak app. One button. It sends the word "innit" to one friend, who gets
a push notification. Every innit is stored with a timestamp, and the streak is mutual:
a day counts only if both of you said it.

Two users, private, no app store launch. TestFlight and a direct APK.

## Where this is up to

| Milestone | Status |
|---|---|
| 1. Design system extracted, gaps and conflicts reported | **Done** — see `docs/design-audit.md` |
| 2. Schema, RLS, backfill, streak maths under test | **Done** — 56 tests passing |
| 3. Expo app: auth, pairing, home screen | Not started |
| 4. Push notifications end to end | Schema and Edge Function written; not wired to a device |
| 5. History heatmap and stats | Blocked on design (see G5, G8) |
| 6. iOS widget, then Android widget | Not started |
| 7. EAS build config, TestFlight, Android internal track | Not started |

**Blocked on you:** the decisions at the end of `docs/design-audit.md`, and the
accounts and identifiers in `docs/setup-checklist.md`.

## Layout

```
src/theme/        Design tokens. The only place colours and dimensions exist.
src/lib/          Date handling and the streak engine. Pure, no I/O, heavily tested.
supabase/         Schema, RLS policies, backfill, push Edge Function.
docs/             The design audit and the setup checklist.
```

## Running the tests

```bash
npm install
npm test          # streak maths, date handling, colour conversion
npm run typecheck
```

## The rules, in one place

These are decided and the code enforces them:

- **Mutual.** A day counts only when both people sent at least one innit that day.
- **Fixed day boundary.** `Europe/Amsterdam`, midnight to midnight. Not per-user
  timezones, not a rolling 24 hours. Stored as UTC `sent_at` plus a `local_date`
  derived server-side.
- **Today incomplete is not broken.** The current streak runs to today if today is
  complete, otherwise to yesterday. An unfinished day shows as *at risk*; the streak
  breaks only once a day has actually ended incomplete.
- **Derived, never stored.** Streaks are recomputed from raw rows at read time. There
  is no counter to drift, and backfilled history corrects itself automatically.
- **Append-only.** `innits` has no UPDATE or DELETE policy. The history is the product.
- **No freezes in v1.** If you lose it, you lose it.

## Stack

Verified current as of August 2026, not assumed:

- **Expo SDK 57** (React Native 0.86) with EAS Build and development builds. Not Expo
  Go — widgets and push need native code.
- **iOS widget:** WidgetKit via `@bacons/apple-targets` (v5). Interactive buttons need
  App Intents, so iOS 17+.
- **Android widget:** Glance / AppWidget. See C1 and C3 in the design audit — the
  send path is likely Kotlin plus WorkManager rather than a JS callback, for
  reliability.
- **Backend:** Supabase — Postgres, auth, Edge Functions. Free tier.
- **Push:** Expo Push Notifications, sent from an Edge Function fired by a trigger on
  insert into `innits`.

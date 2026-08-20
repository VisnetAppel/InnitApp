# What I need from you

Everything that blocks a milestone, in one go. Roughly ordered by when it's needed.

Nothing here is needed for what's already built (theme, streak engine, schema files) —
those run and test locally. Item 1 is needed to *apply* the schema; items 2–6 for the
first build on a real phone; 7–10 for push and widgets.

## Accounts and projects

1. **Supabase project** (free tier is ample — two users, a few thousand rows forever).
   I need:
   - the project URL and the `anon` public key (these go in the app; safe to share)
   - the `service_role` key (used only by the push trigger and the backfill; **send
     this separately from anything public, and never let it near the app bundle**)
   - confirmation of the region — pick EU (Frankfurt or Ireland) for latency and for
     keeping the data in the EU

2. **Expo account** — the org/username for EAS. Free tier covers development builds;
   TestFlight submission may need a paid plan depending on build minutes.

3. **Apple Developer Program membership** — $99/year, and there's no way around it for
   TestFlight or for a home screen widget on a real device. I need:
   - the Team ID
   - an App Store Connect account with access for the Expo credentials flow (either
     an App Store Connect API key, which I'd prefer, or your Apple ID for interactive
     login)

4. **Google Play Developer account** — $25 one-off, only if you want the internal
   testing track. **Skip this if a direct APK is fine** — it is, for two people, and
   it's the faster path. Tell me which.

## Identifiers — decide these now, they're painful to change later

5. **Bundle identifier / package name.** I'd suggest:
   - iOS: `com.yourdomain.innit`
   - iOS widget extension: `com.yourdomain.innit.widget`
   - Android: `com.yourdomain.innit`
   - App Group (shared container between app and widget): `group.com.yourdomain.innit`

   Give me the reverse-domain prefix you want and I'll use it consistently.

6. **App display name** — "Innit", or something else on the home screen?

## Push notifications

7. **Firebase project for FCM v1** (Android). I need the service account JSON key,
   uploaded to EAS. Free.

8. **APNs key** (iOS) — a `.p8` auth key from the Apple Developer portal, plus its Key
   ID and your Team ID. EAS can generate this for you if it has App Store Connect
   access, which is the easier path.

## Content and accounts

9. **The two accounts**: your email and your friend's, for the magic-link sign-in.
   Plus both display names — the design shows "with Jordan", so I need the real ones.

10. **The backfill data.** At minimum: the date you started. Ideally also the list of
    days you actually missed, if any. If you have the WhatsApp export I can parse real
    timestamps out of it, which would make the heatmap and every timing statistic real
    rather than synthetic — see C4 in the design audit. That's a meaningful upgrade to
    the app if the export is available.

## Design decisions

11. The four blocking decisions listed at the end of `docs/design-audit.md`.

12. **A sound file** for the button press, or permission for me to source one (C9).

---

## What I do *not* need

For the avoidance of doubt, and because these are the usual suspects: no analytics
account, no crash-reporting service, no domain name, no privacy policy or App Store
listing (TestFlight internal testing with under 100 testers needs neither), and no
payment processor.

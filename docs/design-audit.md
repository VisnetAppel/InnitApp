# Design audit — gaps and conflicts

Everything below is **flagged, not resolved**. Nothing here has been guessed into the
build. Where I've proposed something, it's a proposal awaiting your yes/no.

Sources: `Innit - Final Reference.dc.html` and its README (the design), and the build
prompt (the behaviour).

---

## Part 1 — Conflicts

These are places where the design, the prompt, and the platforms disagree. They're
ordered by how expensive they get if we discover them late.

### C1. The widget's "sent" tick is a promise the network can't keep

**The conflict.** The design shows a widget tap swapping the button to a green
checkmark and "sent", with no app launch. The prompt separately requires that an
innit is *never silently dropped*, because losing one loses the streak.

Those two can't both mean "the server has it". An iOS App Intent fired from a widget
runs in a short-lived background process with a tight execution budget — a few
seconds — and is not a reliable place to complete a network round-trip. A user on the
Underground taps, sees a green tick, and the request dies.

**What I propose.** Make the tick mean *durably queued*, not *server confirmed*:

1. The App Intent writes the innit to a shared App Group store **synchronously**, with
   a client-generated nonce. This cannot fail for network reasons.
2. The UI flips to "sent" immediately — because at that point the innit genuinely
   cannot be lost.
3. A background task drains the queue, retrying with the nonce until the server
   acknowledges. The nonce makes the retry idempotent (see D1 below).

The visible consequence: on a bad connection your friend's push may arrive minutes
late, though the innit is credited to the correct `sent_at` and therefore the correct
day. **Confirm you're happy with that trade**, because the alternative — waiting for
the server before showing the tick — means a spinner in a widget and occasional
visible failures.

Android is easier: a Glance `actionRunCallback` can hand off to WorkManager, which
gives genuine OS-backed retry with backoff. Same queue-first design, more reliable
drain.

### C2. "The widget updates when your friend sends" is best-effort on iOS

The prompt asks the widget to reflect the friend's sends. That needs a push to wake
the device and reload the widget timeline. iOS explicitly rate-limits background
delivery (`content-available`), and WidgetKit has its own reload budget. Neither is
guaranteed or promptly scheduled.

Realistically: the widget updates immediately on **your own** tap, opportunistically
when a push gets through, and otherwise on WidgetKit's own refresh cadence. It may sit
stale for a while. The design shows no stale or unknown state.

**Proposed:** accept eventual consistency, and never let the widget show something
actively wrong — if its data is older than the current local day, it shows the
neutral "neither sent" prompt rather than a stale "sent" tick. Android's
`updateAppWidget` is not rate-limited the same way and will track more closely.

### C3. The Android widget probably can't render JetBrains Mono

The design sets every numeral and the "innit" wordmark in JetBrains Mono Bold. On iOS
that's fine — a WidgetKit extension can use a bundled font.

Android widgets are `RemoteViews` under the hood, and Glance inherits that constraint:
custom font files are not reliably applied. The realistic options are (a) fall back to
the device's monospace face (Roboto Mono on most Android hardware — similar
proportions, different personality), or (b) render the widget's text into a bitmap so
we control the typeface exactly, at the cost of crispness across densities and a
harder time with Dynamic Type.

**Proposed:** (a), fall back to Roboto Mono on the Android widget only. The app itself
uses real JetBrains Mono on both platforms. **This means the Android widget will not
be pixel-identical to the design.** Flagging rather than quietly shipping it.

*(Licensing is fine either way — JetBrains Mono is SIL OFL 1.1, free to bundle.)*

### C4. Backfilled history will lie to the stats and the heatmap

This is the one I'd most like a decision on, because it shapes the data.

The prompt wants ~a year of WhatsApp history seeded as complete days, **and** it wants
the heatmap shaded by how early each day was completed, **and** stats for earliest
innit ever, average send time, and reply gaps. Those are in direct tension: we don't
have real timestamps for the backfilled year, only the knowledge that the day
happened.

If we invent plausible times, every timing statistic in the app becomes fiction, and
the near-miss 23:50 records — which the prompt calls "the point" — would be invented
too.

**What I've built (reversible):** backfilled rows are stamped at a fixed neutral local
noon and carry `source = 'backfill'`. The streak engine surfaces a `syntheticTiming`
flag per day so that:

- backfilled days **count** towards streaks and appear on the heatmap;
- they are **excluded** from all timing statistics and from heatmap intensity.

**What this needs from you:** a heatmap treatment for "complete, but we don't know
when" — a shade that isn't on the intensity ramp. That's a design decision I haven't
made. See G5.

### C5. The design has an entry point to a screen that doesn't exist

The home screen has a 3-dot overflow control, top-right. There is no settings screen
in the design, and the prompt says to build no UI that isn't in the design. As written,
those two rules make the control un-implementable.

The README suggests "two or three things that genuinely need to exist". My guess at the
irreducible set: **who you're paired with, notification permission state, and sign
out.** But this needs designing — tell me whether to (a) design it and show you, (b)
ship it as a plain system action sheet, or (c) hide the control in v1.

### C6. React Native can't use OKLCH, so we're in sRGB, not P3

The README asks for a proper OKLCH conversion into "Display P3 / sRGB as needed". RN's
style system parses neither `oklch()` nor P3 colours, and doesn't render wide-gamut by
default.

**Resolved in code, no decision needed:** the OKLCH values are the literal tokens in
`src/theme/tokens.ts` and are converted to sRGB at load by a real Oklab implementation
(`src/theme/oklch.ts`), cross-checked against an independent implementation and pinned
by tests. Nothing was eyeball-converted. The dark digit-tile bevel's small lightness
deltas survive — there's a test asserting exactly that.

The one loss: we ship sRGB, not P3. On a P3 display the accent will be very slightly
less saturated than the design file rendered in a wide-gamut browser. Everything is
in-gamut, so nothing is clipped.

### C7. The button's three-layer shadow is built from views, not `box-shadow`

The README is emphatic that the flat bevel + ambient shadow + inset highlight stack is
what makes the button feel like a key, and warns against collapsing it to one shadow.
RN 0.86 does support `boxShadow` including `inset`, so a literal port is *possible* —
but the press animation has to collapse the bevel band, and animating a shadow
property is neither smooth nor reliably supported.

**Proposed technique change, identical visual result:** render the bevel as a real
offset view behind the button, so the press animation can translate the face down and
collapse the band in one gesture on the UI thread. Flagging because it's a deviation
in *how*, not in *what*.

### C8. Three digit tiles is a fixed assumption

The design shows exactly three tiles, for "247". The streak will pass 365, and 1000 is
about two and a half years away. It's also 0 or 1 digit on day one and after a break.

Undecided: does the tile count vary with the number, or is the number zero-padded to
three tiles ("007")? These look very different and the padded version is arguably more
on-brand for a mechanical counter. **Needs a decision** — see G2.

### C9. The prompt wants a sound; the design has no audio

"Make it feel good: haptic feedback, a satisfying press animation, a sound." The design
bundle explicitly ships no assets. I need either a sound file from you or permission to
source one (and a decision on whether it respects the iOS silent switch — I'd say yes).

### D1. One addition to the data model, announced

I added `client_nonce uuid` to `innits`, with a unique index over `(pair_id,
client_nonce)`.

The offline queue must retry, or innits get dropped. Retrying means an insert can be
repeated after a lost response. Without an idempotency key that silently creates
duplicate rows, which inflates "total innits" even though it can't corrupt a streak.
This is the smallest thing that makes "never drop an innit" implementable. Say the word
and I'll take it out, but I don't know how to meet the requirement without it.

Two smaller schema notes, both consequences of the spec rather than additions:
`pairs.user_b` is nullable between generating an invite code and it being redeemed, and
`innits` has no UPDATE or DELETE policy at all, so history is append-only.

### D2. How the widget authenticates is an open architectural decision

Not a design conflict, but it'll bite if we leave it. The widget runs in a separate
process from the app and needs to write innits. Two options:

- **Share the Supabase session** via App Group keychain / shared prefs. Simple, but the
  app and the widget can both try to refresh a rotating token and invalidate each
  other's — an intermittent, miserable class of bug.
- **Give the widget a long-lived device secret** and a dedicated Edge Function endpoint
  that inserts on its behalf. Slightly more to build, no token races, and the widget
  never holds a credential that can read your history.

**I'd recommend the second.** It's maybe half a day more work at milestone 6 and it
removes a whole failure mode from the thing you say you'll use most.

---

## Part 2 — Gaps

Screens, states and components the build needs that the design doesn't cover. The
README already owns some of these under "Not Yet Designed"; this is the full list from
the build's point of view.

### Home screen

| # | Gap | Proposal |
|---|---|---|
| G1 | **Three of the four daily states.** Only "neither sent" exists. Missing: you've sent / waiting on them, they've sent / your turn, and both sent. | Reuse the design's structure, changing only the status line and the button. For "both sent", swap the button to the confirmation green with the checkmark, reusing the widget's existing treatment. **Open question:** once you've sent, is the button disabled, or can you send again? Behaviourally repeat sends are harmless — I'd keep it live and let you spam it. |
| G2 | **Digit tile count** for 1-, 2- and 4-digit streaks, and for zero. | See C8. My preference: always three tiles, zero-padded, growing to four only past 999. Mechanical counters pad. |
| G3 | **At-risk and broken-streak treatments.** | At-risk needs to be *felt* without being a dark pattern — the streak is real and today isn't over. I'd propose the status line carries it and the digits stay calm. Broken (streak 0) needs its own copy. Both need designing. |
| G4 | **The streak-increment animation** — the README calls this the app's emotional peak and specifies no motion. | Needs a motion spec. I've put placeholder timings in `motion` in the theme so there's one place to change them, but I'm not designing this without you. |

### History

| # | Gap | Proposal |
|---|---|---|
| G5 | **The entire heatmap screen.** No cell size, spacing, intensity ramp, month/day labels, or scroll direction. | The intensity ramp has to be derived from the accent hue (250) by varying lightness — that's design work, not implementation. Plus a distinct shade for backfilled days (C4) and one for incomplete days. I'd like to mock 4–5 ramp options and have you pick. |
| G6 | **The tapped-cell detail view** showing both people's exact timestamps. | Sheet, popover, or inline row? Needs designing. |
| G7 | **Empty history** — day one, nothing to show. | Undesigned. |

### Stats

| # | Gap | Proposal |
|---|---|---|
| G8 | **The entire stats screen** — roughly a dozen tiles, grouping, and the type treatment for large numbers vs. labels. | The home screen's digit tiles suggest a visual language to extend. Needs designing before I build it. |
| G9 | **Stats that have no answer yet** (fastest reply with only one day of data, "perfect weeks" before a week has passed). | Needs an empty/placeholder treatment per tile. |

### Onboarding and pairing

| # | Gap | Proposal |
|---|---|---|
| G10 | **The whole flow**: email entry, magic-link-sent state, returning from the link, generating an invite, entering an invite, paired confirmation. | Entirely undesigned and it's the first thing either of you will see. |
| G11 | **Display name entry** — the design shows "with Jordan", so a name is set somewhere. | Undesigned. |

### System states

| # | Gap | Proposal |
|---|---|---|
| G12 | **Loading**, on cold start before innits have been fetched. | Strong opinion: **no spinner on the streak number.** Render the last-known cached value immediately and reconcile silently. A spinner where the hero number goes would gut the whole feeling of the app. |
| G13 | **Error states** — send failed, offline, session expired. The design contains no banner, toast, or alert component at all. | Needs a component designing. Given C1, "offline" should read as *queued*, not *failed* — the innit is safe. |
| G14 | **Notification permission denied.** | Does home surface it? It matters — a denied permission means your friend's innits arrive silently. |
| G15 | **Widget states beyond the two shown.** The design has "neither sent" and "just tapped". Missing: you've sent / waiting, they've sent / your turn, day complete, queued-offline, and signed-out-or-unpaired. | Six states, two designed. This is the biggest single gap. |
| G16 | **App icon, splash screen, notification icon.** | Needed to ship to TestFlight at all. |
| G17 | **Notification lock-screen treatment.** Copy is decided ("Jordan" / "innit"); the appearance isn't. | Currently: sender's name as title, "innit" as body. Confirm. |

---

## What I'd like decided first

Blocking the next milestones, in order:

1. **C4 + G5** — the backfill/timing question, because it shapes the seeded data and
   redoing it later means re-seeding.
2. **D1** — the `client_nonce` addition, since it's already in the schema.
3. **D2** — widget auth, because it changes what gets built at milestone 6.
4. **G1 + G2** — the remaining home states and the digit-tile rule, which is the next
   UI milestone.

Everything else can wait for its milestone.

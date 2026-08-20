/**
 * The streak engine.
 *
 * Streaks are DERIVED from the raw innit rows every time they're read. There is no
 * stored counter anywhere and there must never be one: backfilled history has to
 * change the answer retroactively, and a mutable counter would drift the first time
 * a write raced or a device was offline.
 *
 * The rule is mutual: a day counts only when both people sent at least one innit
 * with that local date. One person innitting alone advances nothing.
 */

import { addDays, daysBetween, toLocalDate, type LocalDate, PAIR_TIMEZONE } from './dates';

export type InnitSource = 'app' | 'widget' | 'backfill';

export type Innit = {
  id: string;
  senderId: string;
  /** Exact moment, ISO 8601 UTC. This is the interesting data. */
  sentAt: string;
  /** Local date in the pair's timezone, derived server-side. */
  localDate: LocalDate;
  source: InnitSource;
};

export type Pair = {
  userA: string;
  userB: string;
  timezone: string;
};

/** What one person did on one day. */
export type SenderDay = {
  /** Their first innit of the day — the one that counts. */
  first: Innit;
  /** How many they sent. Extras are affectionate noise; they never count twice. */
  count: number;
};

export type DayRecord = {
  date: LocalDate;
  /** Both people sent at least once. */
  complete: boolean;
  a?: SenderDay;
  b?: SenderDay;
  /**
   * The instant the day became mutual — the later of the two first-innits.
   * Undefined on incomplete days. Drives heatmap intensity.
   */
  completedAt?: string;
  /**
   * True when either of the day's counting innits came from backfill, so its
   * timestamps are reconstructed rather than real. Timing statistics and heatmap
   * intensity must not treat these as observations.
   */
  syntheticTiming: boolean;
};

export type TodayState =
  /** Neither of you has said it yet. */
  | 'neither'
  /** You've innit, waiting on them. */
  | 'you'
  /** They've innit, your turn. */
  | 'them'
  /** Innit'd. */
  | 'both';

export type StreakSummary = {
  /** Consecutive complete days ending today, or ending yesterday if today isn't complete yet. */
  current: number;
  /** Longest run of complete days ever recorded. */
  longest: number;
  today: LocalDate;
  todayState: TodayState;
  /**
   * The day is not complete and there is a live streak to lose. Not the same as
   * broken — the day hasn't ended yet.
   */
  atRisk: boolean;
  /** Total innits across both people, all time. */
  totalInnits: number;
  /** Distinct local dates with at least one innit from anyone. */
  daysTracked: number;
};

/**
 * Group raw rows into one record per local date.
 *
 * Rows may arrive in any order and may contain duplicates from an offline queue
 * reconciling; `first` is resolved by comparing instants, not arrival order.
 */
export function computeDays(innits: readonly Innit[], pair: Pair): Map<LocalDate, DayRecord> {
  const days = new Map<LocalDate, DayRecord>();

  for (const innit of innits) {
    if (innit.senderId !== pair.userA && innit.senderId !== pair.userB) continue;

    let day = days.get(innit.localDate);
    if (!day) {
      day = { date: innit.localDate, complete: false, syntheticTiming: false };
      days.set(innit.localDate, day);
    }

    const slot = innit.senderId === pair.userA ? 'a' : 'b';
    const existing = day[slot];
    if (!existing) {
      day[slot] = { first: innit, count: 1 };
    } else {
      existing.count += 1;
      if (innit.sentAt < existing.first.sentAt) existing.first = innit;
    }
  }

  for (const day of days.values()) {
    day.complete = Boolean(day.a && day.b);
    if (day.complete) {
      const firstA = day.a!.first;
      const firstB = day.b!.first;
      // The day becomes mutual when the *second* person speaks.
      day.completedAt = firstA.sentAt > firstB.sentAt ? firstA.sentAt : firstB.sentAt;
      day.syntheticTiming = firstA.source === 'backfill' || firstB.source === 'backfill';
    }
  }

  return days;
}

/** Walk backwards from `from`, counting consecutive complete days. */
function countBackFrom(days: Map<LocalDate, DayRecord>, from: LocalDate): number {
  let streak = 0;
  let cursor = from;
  while (days.get(cursor)?.complete) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function longestRun(days: Map<LocalDate, DayRecord>): number {
  const complete = [...days.values()]
    .filter((day) => day.complete)
    .map((day) => day.date)
    .sort();

  let longest = 0;
  let run = 0;
  let previous: LocalDate | undefined;

  for (const date of complete) {
    run = previous !== undefined && daysBetween(previous, date) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = date;
  }

  return longest;
}

function todayState(day: DayRecord | undefined, pair: Pair, viewerId: string): TodayState {
  if (!day) return 'neither';
  const viewerSlot = viewerId === pair.userA ? 'a' : 'b';
  const friendSlot = viewerSlot === 'a' ? 'b' : 'a';
  const viewerSent = Boolean(day[viewerSlot]);
  const friendSent = Boolean(day[friendSlot]);

  if (viewerSent && friendSent) return 'both';
  if (viewerSent) return 'you';
  if (friendSent) return 'them';
  return 'neither';
}

/**
 * The whole scoreboard, derived from raw rows.
 *
 * `now` is injected rather than read from the clock so that the day boundary is
 * testable — and so a screen can render a specific moment without lying about it.
 */
export function computeStreak(
  innits: readonly Innit[],
  pair: Pair,
  viewerId: string,
  now: Date = new Date(),
): StreakSummary {
  const timezone = pair.timezone || PAIR_TIMEZONE;
  const days = computeDays(innits, pair);
  const today = toLocalDate(now, timezone);
  const todayRecord = days.get(today);

  // Today being incomplete does NOT break the streak — the day hasn't ended yet.
  const current = todayRecord?.complete
    ? countBackFrom(days, today)
    : countBackFrom(days, addDays(today, -1));

  const state = todayState(todayRecord, pair, viewerId);

  return {
    current,
    longest: longestRun(days),
    today,
    todayState: state,
    atRisk: state !== 'both' && current > 0,
    totalInnits: innits.length,
    daysTracked: days.size,
  };
}

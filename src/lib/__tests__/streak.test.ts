import { describe, expect, it } from 'vitest';

import { PAIR_TIMEZONE, toLocalDate } from '../dates';
import { computeDays, computeStreak, type Innit, type InnitSource, type Pair } from '../streak';

const ME = 'user-me';
const THEM = 'user-them';

const pair: Pair = { userA: ME, userB: THEM, timezone: PAIR_TIMEZONE };

let sequence = 0;

/**
 * Build an innit at a local wall-clock time on a given local date.
 * Times are given in the pair's timezone, which is how a human would describe them.
 */
function innit(
  senderId: string,
  localDate: string,
  localTime = '12:00:00',
  source: InnitSource = 'app',
): Innit {
  // Resolve the local wall time to a UTC instant by probing both plausible offsets.
  const naive = `${localDate}T${localTime}Z`;
  const guess = new Date(naive);
  let sentAt = guess;
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(guess.getTime() - offsetHours * 3600_000);
    if (toLocalDate(candidate, PAIR_TIMEZONE) === localDate) {
      sentAt = candidate;
      break;
    }
  }

  return {
    id: `innit-${(sequence += 1)}`,
    senderId,
    sentAt: sentAt.toISOString(),
    localDate,
    source,
  };
}

/** Both people innit on each of the given dates. */
function mutualDays(dates: string[]): Innit[] {
  return dates.flatMap((date) => [innit(ME, date, '09:00:00'), innit(THEM, date, '10:00:00')]);
}

/** Late enough on the given day that `now` sits after both innits. */
const endOfDay = (localDate: string) => new Date(`${localDate}T21:00:00Z`);

describe('mutual-day completion', () => {
  it('completes a day only when both people have sent', () => {
    const days = computeDays(
      [innit(ME, '2026-05-01'), innit(THEM, '2026-05-01'), innit(ME, '2026-05-02')],
      pair,
    );

    expect(days.get('2026-05-01')?.complete).toBe(true);
    expect(days.get('2026-05-02')?.complete).toBe(false);
  });

  it('does not advance the streak when one person innits alone', () => {
    const innits = [innit(ME, '2026-05-01'), innit(ME, '2026-05-02'), innit(ME, '2026-05-03')];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.current).toBe(0);
    expect(summary.longest).toBe(0);
  });

  it('marks the day complete at the moment the second person speaks', () => {
    const mine = innit(ME, '2026-05-01', '08:00:00');
    const theirs = innit(THEM, '2026-05-01', '19:45:00');
    const day = computeDays([mine, theirs], pair).get('2026-05-01');

    expect(day?.completedAt).toBe(theirs.sentAt);
  });
});

describe('multiple innits from one person in a day', () => {
  it('counts the day once, however many they send', () => {
    const innits = [
      innit(ME, '2026-05-01', '08:00:00'),
      innit(ME, '2026-05-01', '09:00:00'),
      innit(ME, '2026-05-01', '10:00:00'),
      innit(THEM, '2026-05-01', '11:00:00'),
    ];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-01'));

    expect(summary.current).toBe(1);
    expect(computeDays(innits, pair).get('2026-05-01')?.a?.count).toBe(3);
  });

  it('takes the earliest innit as the one that counts, whatever order rows arrive in', () => {
    const late = innit(ME, '2026-05-01', '22:00:00');
    const early = innit(ME, '2026-05-01', '06:00:00');
    const theirs = innit(THEM, '2026-05-01', '12:00:00');

    // Rows deliberately out of order, as an offline queue would reconcile them.
    const day = computeDays([late, theirs, early], pair).get('2026-05-01');

    expect(day?.a?.first.id).toBe(early.id);
    // The day completed when THEY spoke at noon, after my 06:00.
    expect(day?.completedAt).toBe(theirs.sentAt);
  });
});

describe('today not yet complete', () => {
  it('does not break the streak when nobody has innit yet today', () => {
    const innits = mutualDays(['2026-05-01', '2026-05-02', '2026-05-03']);
    const summary = computeStreak(innits, pair, ME, new Date('2026-05-04T09:00:00Z'));

    expect(summary.current).toBe(3);
    expect(summary.todayState).toBe('neither');
    expect(summary.atRisk).toBe(true);
  });

  it('does not break the streak when only I have innit today', () => {
    const innits = [...mutualDays(['2026-05-01', '2026-05-02']), innit(ME, '2026-05-03')];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.current).toBe(2);
    expect(summary.todayState).toBe('you');
    expect(summary.atRisk).toBe(true);
  });

  it('does not break the streak when only they have innit today', () => {
    const innits = [...mutualDays(['2026-05-01', '2026-05-02']), innit(THEM, '2026-05-03')];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.current).toBe(2);
    expect(summary.todayState).toBe('them');
    expect(summary.atRisk).toBe(true);
  });

  it('counts today the moment it completes, and stops being at risk', () => {
    const innits = mutualDays(['2026-05-01', '2026-05-02', '2026-05-03']);
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.current).toBe(3);
    expect(summary.todayState).toBe('both');
    expect(summary.atRisk).toBe(false);
  });

  it('reports the viewer and their friend from the right side of the pair', () => {
    const innits = [innit(ME, '2026-05-01')];

    expect(computeStreak(innits, pair, ME, endOfDay('2026-05-01')).todayState).toBe('you');
    expect(computeStreak(innits, pair, THEM, endOfDay('2026-05-01')).todayState).toBe('them');
  });
});

describe('breaking the streak', () => {
  it('breaks only once an incomplete day has ended', () => {
    const innits = mutualDays(['2026-05-01', '2026-05-02']);

    // 3 May: nobody sent on the 3rd, but the day is still running. Streak stands.
    expect(computeStreak(innits, pair, ME, endOfDay('2026-05-03')).current).toBe(2);
    // 4 May: the 3rd has ended incomplete. Gone.
    expect(computeStreak(innits, pair, ME, endOfDay('2026-05-04')).current).toBe(0);
  });

  it('is not at risk once the streak is already gone', () => {
    const summary = computeStreak(
      mutualDays(['2026-05-01']),
      pair,
      ME,
      endOfDay('2026-05-10'),
    );

    expect(summary.current).toBe(0);
    expect(summary.atRisk).toBe(false);
  });

  it('breaks when a day had only one person, even with days either side', () => {
    const innits = [
      ...mutualDays(['2026-05-01', '2026-05-02']),
      innit(ME, '2026-05-03'),
      ...mutualDays(['2026-05-04', '2026-05-05']),
    ];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-05'));

    expect(summary.current).toBe(2);
    expect(summary.longest).toBe(2);
  });
});

describe('resuming after a break', () => {
  it('counts only the new run', () => {
    const innits = [
      ...mutualDays(['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05']),
      ...mutualDays(['2026-05-01', '2026-05-02', '2026-05-03']),
    ];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.current).toBe(3);
    expect(summary.longest).toBe(5);
  });

  it('counts a fresh day-one streak the day after a break', () => {
    const innits = [...mutualDays(['2026-05-01']), ...mutualDays(['2026-05-05'])];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-05'));

    expect(summary.current).toBe(1);
  });
});

describe('longest streak', () => {
  it('finds the longest run anywhere in history', () => {
    const innits = [
      ...mutualDays(['2026-01-01', '2026-01-02']),
      ...mutualDays(['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04']),
      ...mutualDays(['2026-03-01']),
    ];

    expect(computeStreak(innits, pair, ME, endOfDay('2026-03-01')).longest).toBe(4);
  });

  it('is at least as large as the current streak', () => {
    const innits = mutualDays(['2026-05-01', '2026-05-02', '2026-05-03']);
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.longest).toBe(3);
    expect(summary.longest).toBeGreaterThanOrEqual(summary.current);
  });

  it('is zero when no day was ever mutual', () => {
    expect(computeStreak([innit(ME, '2026-05-01')], pair, ME, endOfDay('2026-05-01')).longest).toBe(0);
  });

  it('spans a DST transition without a phantom break', () => {
    // 29 March 2026 is 23 hours long; 25 October is 25 hours long.
    const spring = mutualDays(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']);
    expect(computeStreak(spring, pair, ME, endOfDay('2026-03-30')).longest).toBe(4);

    const autumn = mutualDays(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
    expect(computeStreak(autumn, pair, ME, endOfDay('2026-10-26')).longest).toBe(4);
  });
});

describe('timezone edges', () => {
  it('credits a 23:50 scramble to the day it was sent locally', () => {
    // 23:50 CEST on 5 May is 21:50Z — already the 5th in UTC, and the 5th locally.
    const innits = [
      ...mutualDays(['2026-05-04']),
      innit(ME, '2026-05-05', '23:50:00'),
      innit(THEM, '2026-05-05', '23:58:00'),
    ];
    const summary = computeStreak(innits, pair, ME, new Date('2026-05-05T21:59:00Z'));

    expect(summary.current).toBe(2);
    expect(summary.todayState).toBe('both');
  });

  it('credits a 00:05 innit to the new day, not the one just missed', () => {
    const innits = [
      ...mutualDays(['2026-05-04']),
      innit(ME, '2026-05-06', '00:05:00'),
      innit(THEM, '2026-05-06', '00:07:00'),
    ];
    // Now is just after those innits, early on the 6th.
    const summary = computeStreak(innits, pair, ME, new Date('2026-05-05T22:10:00Z'));

    // The 5th ended incomplete, so the streak from the 4th is gone; the 6th is day one.
    expect(summary.today).toBe('2026-05-06');
    expect(summary.current).toBe(1);
  });

  it('rolls the day over at local midnight, not at UTC midnight', () => {
    const innits = mutualDays(['2026-05-05']);
    // 22:30Z on the 5th is 00:30 on the 6th in Amsterdam.
    const summary = computeStreak(innits, pair, ME, new Date('2026-05-05T22:30:00Z'));

    expect(summary.today).toBe('2026-05-06');
    expect(summary.todayState).toBe('neither');
    expect(summary.current).toBe(1);
    expect(summary.atRisk).toBe(true);
  });
});

describe('backfilled history', () => {
  it('counts backfilled days towards the streak', () => {
    const history = ['2026-04-28', '2026-04-29', '2026-04-30'].flatMap((date) => [
      innit(ME, date, '09:00:00', 'backfill'),
      innit(THEM, date, '09:30:00', 'backfill'),
    ]);
    const innits = [...history, ...mutualDays(['2026-05-01'])];

    expect(computeStreak(innits, pair, ME, endOfDay('2026-05-01')).current).toBe(4);
  });

  it('flags backfilled days so timing stats can exclude their invented timestamps', () => {
    const days = computeDays(
      [
        innit(ME, '2026-04-28', '09:00:00', 'backfill'),
        innit(THEM, '2026-04-28', '09:30:00', 'backfill'),
        ...mutualDays(['2026-05-01']),
      ],
      pair,
    );

    expect(days.get('2026-04-28')?.syntheticTiming).toBe(true);
    expect(days.get('2026-05-01')?.syntheticTiming).toBe(false);
  });
});

describe('totals and hygiene', () => {
  it('reports totals across both people', () => {
    const innits = [
      ...mutualDays(['2026-05-01', '2026-05-02']),
      innit(ME, '2026-05-03'),
      innit(ME, '2026-05-03'),
    ];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-03'));

    expect(summary.totalInnits).toBe(6);
    expect(summary.daysTracked).toBe(3);
  });

  it('ignores rows from anyone outside the pair', () => {
    const innits = [
      innit(ME, '2026-05-01'),
      innit('a-stranger', '2026-05-01'),
    ];
    const summary = computeStreak(innits, pair, ME, endOfDay('2026-05-01'));

    expect(summary.current).toBe(0);
    expect(computeDays(innits, pair).get('2026-05-01')?.complete).toBe(false);
  });

  it('handles an empty history without inventing a streak', () => {
    const summary = computeStreak([], pair, ME, endOfDay('2026-05-01'));

    expect(summary).toMatchObject({
      current: 0,
      longest: 0,
      todayState: 'neither',
      atRisk: false,
      totalInnits: 0,
      daysTracked: 0,
    });
  });

  it('survives a year of history', () => {
    const dates: string[] = [];
    for (let cursor = new Date(Date.UTC(2025, 8, 1)); cursor < new Date(Date.UTC(2026, 7, 20)); ) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    const summary = computeStreak(mutualDays(dates), pair, ME, endOfDay('2026-08-19'));

    expect(summary.current).toBe(dates.length);
    expect(summary.longest).toBe(dates.length);
  });
});

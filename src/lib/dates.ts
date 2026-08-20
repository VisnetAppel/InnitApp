/**
 * Civil-date handling for the pair's fixed timezone.
 *
 * Two kinds of value live here and they must not be confused:
 *   - an *instant* (a `Date` / ISO string) — the exact moment an innit was sent
 *   - a *local date* (`YYYY-MM-DD`) — which day that instant belongs to, in the
 *     pair's timezone
 *
 * The day boundary is the pair's timezone, midnight to midnight. Not per-user
 * timezones, not a rolling 24h window. Arithmetic on local dates is pure calendar
 * arithmetic and is deliberately immune to DST: "the day after 2026-03-29" is
 * 2026-03-30 whether or not that day was 23 hours long.
 *
 * The authoritative `local_date` for a stored innit is derived server-side by a
 * Postgres trigger. This module derives the *client's* notion of "what day is it
 * now", and re-derives local dates for rows that arrived without one.
 */

export const PAIR_TIMEZONE = 'Europe/Amsterdam';

/** A calendar date in the pair's timezone, `YYYY-MM-DD`. */
export type LocalDate = string;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function parts(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const found = new Map<string, number>();
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') found.set(part.type, Number(part.value));
  }

  const read = (key: string) => {
    const value = found.get(key);
    if (value === undefined || Number.isNaN(value)) {
      throw new RangeError(
        `Runtime returned no "${key}" for timezone ${timeZone}. ` +
          `The JS engine is missing IANA timezone data — see docs/design-audit.md.`,
      );
    }
    return value;
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Which local date an instant belongs to. */
export function toLocalDate(instant: Date, timeZone: string = PAIR_TIMEZONE): LocalDate {
  const p = parts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * How far into its local day an instant falls, in seconds from local midnight.
 *
 * Used for heatmap intensity (how early the day was completed) and for the
 * average-send-time stats. On a DST spring-forward day this can exceed the
 * elapsed wall-clock time since midnight, which is correct: it is a clock
 * reading, not a duration.
 */
export function secondsIntoLocalDay(instant: Date, timeZone: string = PAIR_TIMEZONE): number {
  const p = parts(instant, timeZone);
  return p.hour * 3600 + p.minute * 60 + p.second;
}

/** Parse `YYYY-MM-DD` into its numeric components. Throws on malformed input. */
function parseLocalDate(date: LocalDate): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Not a local date: ${JSON.stringify(date)}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Calendar arithmetic on local dates, done in UTC so that no DST transition can
 * make a day 23 or 25 hours long and shift the result.
 */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  const msPerDay = 86_400_000;
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / msPerDay,
  );
}

/** Every local date from `from` to `to`, inclusive. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let cursor = from; daysBetween(cursor, to) >= 0; cursor = addDays(cursor, 1)) {
    out.push(cursor);
  }
  return out;
}

import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, eachDay, secondsIntoLocalDay, toLocalDate } from '../dates';

/**
 * Europe/Amsterdam is CET (UTC+1) in winter and CEST (UTC+2) in summer.
 * In 2026 the transitions are 29 March and 25 October, both at 01:00 UTC.
 */
describe('toLocalDate — the day boundary', () => {
  it('puts an instant just before local midnight on the earlier day (winter, UTC+1)', () => {
    expect(toLocalDate(new Date('2026-03-14T22:59:59Z'))).toBe('2026-03-14');
  });

  it('rolls to the next day exactly at local midnight (winter, UTC+1)', () => {
    expect(toLocalDate(new Date('2026-03-14T23:00:00Z'))).toBe('2026-03-15');
  });

  it('puts an instant just before local midnight on the earlier day (summer, UTC+2)', () => {
    expect(toLocalDate(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14');
  });

  it('rolls to the next day exactly at local midnight (summer, UTC+2)', () => {
    expect(toLocalDate(new Date('2026-07-14T22:00:00Z'))).toBe('2026-07-15');
  });

  it('does not use UTC midnight as the boundary', () => {
    // 23:30 local on the 14th is already the 15th in UTC. The pair's day is what counts.
    expect(toLocalDate(new Date('2026-07-14T21:30:00Z'))).toBe('2026-07-14');
  });
});

describe('toLocalDate — DST transitions', () => {
  it('keeps both sides of the spring-forward gap on the same local date', () => {
    // 01:59:59 CET, then the clock jumps straight to 03:00:00 CEST.
    expect(toLocalDate(new Date('2026-03-29T00:59:59Z'))).toBe('2026-03-29');
    expect(toLocalDate(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-29');
  });

  it('spans a 23-hour spring-forward day from local midnight to local midnight', () => {
    expect(toLocalDate(new Date('2026-03-28T23:00:00Z'))).toBe('2026-03-29');
    expect(toLocalDate(new Date('2026-03-29T21:59:59Z'))).toBe('2026-03-29');
    expect(toLocalDate(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
  });

  it('keeps both passes of the repeated autumn hour on the same local date', () => {
    // 02:59:59 CEST, then the clock falls back to 02:00:00 CET — the same hour twice.
    expect(toLocalDate(new Date('2026-10-25T00:59:59Z'))).toBe('2026-10-25');
    expect(toLocalDate(new Date('2026-10-25T01:00:00Z'))).toBe('2026-10-25');
  });

  it('spans a 25-hour fall-back day from local midnight to local midnight', () => {
    expect(toLocalDate(new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25');
    expect(toLocalDate(new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-25');
    expect(toLocalDate(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });
});

describe('secondsIntoLocalDay', () => {
  it('reads the local wall clock, not UTC', () => {
    // 08:30 CEST
    expect(secondsIntoLocalDay(new Date('2026-07-14T06:30:00Z'))).toBe(8 * 3600 + 30 * 60);
  });

  it('is zero at local midnight', () => {
    expect(secondsIntoLocalDay(new Date('2026-07-14T22:00:00Z'))).toBe(0);
  });

  it('reports the clock reading after a spring-forward jump, not elapsed time', () => {
    // Only two hours of real time have passed since local midnight, but the clock says 03:00.
    expect(secondsIntoLocalDay(new Date('2026-03-29T01:00:00Z'))).toBe(3 * 3600);
  });
});

describe('local date arithmetic', () => {
  it('adds a calendar day across the spring-forward transition', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('adds a calendar day across the fall-back transition', () => {
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('rolls over months and years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('counts whole days between dates regardless of DST', () => {
    // This span contains a 23-hour day; it is still 3 calendar days.
    expect(daysBetween('2026-03-28', '2026-03-31')).toBe(3);
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
    expect(daysBetween('2026-05-05', '2026-05-05')).toBe(0);
    expect(daysBetween('2026-05-06', '2026-05-05')).toBe(-1);
  });

  it('enumerates an inclusive range', () => {
    expect(eachDay('2026-03-28', '2026-03-31')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ]);
    expect(eachDay('2026-05-05', '2026-05-05')).toEqual(['2026-05-05']);
  });

  it('rejects malformed dates rather than guessing', () => {
    expect(() => addDays('not-a-date', 1)).toThrow(RangeError);
    expect(() => addDays('2026-3-1', 1)).toThrow(RangeError);
  });
});

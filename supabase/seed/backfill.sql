-- Backfill: seeding the history that happened over WhatsApp.
--
-- Run with the service role (the SQL editor in the Supabase dashboard does this),
-- because `source = 'backfill'` is deliberately not insertable through the API.
--
-- Backfilled innits are stamped at a fixed neutral local time rather than at
-- invented "plausible" times. The timestamps are not observations and pretending
-- otherwise would poison the very statistics that make the app interesting —
-- earliest ever, average send time, reply gaps. The client reads `source` and
-- excludes these days from timing stats and from heatmap intensity, while still
-- counting them towards the streak.

create or replace function public.backfill_pair(
  target_pair   uuid,
  from_date     date,
  to_date       date,
  except_dates  date[] default '{}'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pair_row     public.pairs;
  day          date;
  inserted     integer := 0;
  neutral_time constant time := '12:00';
begin
  select * into strict pair_row from public.pairs where id = target_pair;

  if pair_row.user_b is null then
    raise exception 'Pair % has no second member yet — nothing to backfill against', target_pair;
  end if;

  for day in select generate_series(from_date, to_date, interval '1 day')::date loop
    continue when day = any (except_dates);

    -- One innit per person per day: enough to make the day mutual, which is all
    -- the streak needs. `sent_at` is built in the pair's timezone so the derived
    -- local_date lands on the intended day even across DST.
    insert into public.innits (pair_id, sender_id, sent_at, local_date, source)
    select target_pair,
           member,
           ((day + neutral_time) at time zone pair_row.timezone),
           day,                    -- overwritten by the trigger; kept for clarity
           'backfill'
    from unnest(array[pair_row.user_a, pair_row.user_b]) as member;

    inserted := inserted + 2;
  end loop;

  return inserted;
end;
$$;

revoke all on function public.backfill_pair(uuid, date, date, date[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Usage
--
--   select public.backfill_pair(
--     '<pair-id>',
--     '2025-09-01',            -- the day it started
--     '2026-08-19',            -- the day before the app took over
--     array['2025-12-25']::date[]   -- days you actually missed, if any
--   );
--
-- Re-running is NOT idempotent: it inserts a second set of rows. That does not
-- change any streak (a day is complete whether one or five innits landed on it),
-- but it does inflate the "total innits" stat. To redo a backfill, clear the old
-- rows first:
--
--   delete from public.innits where pair_id = '<pair-id>' and source = 'backfill';
-- ---------------------------------------------------------------------------

-- Innit: core schema.
--
-- Two users, one pair, a few thousand rows forever. Nothing here is built for
-- scale; it is built so that the streak can always be recomputed from the raw
-- rows and never drifts.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
--
-- A profile row per auth user. Auth itself lives in auth.users; this holds the
-- two things the app needs to show and to push.
-- ---------------------------------------------------------------------------
create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  push_token   text,
  created_at   timestamptz not null default now()
);

comment on column public.users.push_token is
  'Expo push token. Null until the device registers or if notifications are denied.';

-- ---------------------------------------------------------------------------
-- pairs
--
-- Exactly one row in practice. user_a and user_b are symmetric; nothing should
-- depend on which is which beyond stable ordering.
-- ---------------------------------------------------------------------------
create table public.pairs (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid        not null references public.users (id) on delete restrict,
  -- Null between generating the invite code and the friend redeeming it. Once
  -- set, it is never cleared: the bond is permanent.
  user_b      uuid                 references public.users (id) on delete restrict,
  timezone    text        not null default 'Europe/Amsterdam',
  invite_code text        unique,
  created_at  timestamptz not null default now(),

  constraint pairs_distinct_members check (user_a <> user_b),
  -- A pair is either awaiting a friend (code, no user_b) or bonded (user_b, no
  -- code). It is never both, and never neither.
  constraint pairs_pending_or_bonded check (
    (user_b is null and invite_code is not null)
    or (user_b is not null and invite_code is null)
  )
);

-- A user belongs to at most one pair, from either side. There is one friend.
create unique index pairs_user_a_unique on public.pairs (user_a);
create unique index pairs_user_b_unique on public.pairs (user_b);

comment on column public.pairs.invite_code is
  'Short one-time pairing code. Set to null once the pair is bonded so it cannot be reused.';
comment on column public.pairs.timezone is
  'The pair''s shared day boundary. Not per-user, not a rolling window.';

-- ---------------------------------------------------------------------------
-- innits
--
-- Append-only. There is no update or delete policy anywhere: the history is the
-- product, and a mutable row would let a bad client rewrite the streak.
-- ---------------------------------------------------------------------------
create type public.innit_source as enum ('app', 'widget', 'backfill');

create table public.innits (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid                not null references public.pairs (id) on delete cascade,
  sender_id  uuid                not null references public.users (id) on delete restrict,
  sent_at    timestamptz         not null default now(),
  local_date date                not null,
  source     public.innit_source not null default 'app',

  -- Idempotency key for the offline queue. A queued send retries until the
  -- server acknowledges it; without this, a retry after a lost response would
  -- insert a second row. Losing an innit is unforgivable, so the queue must
  -- retry — which means the insert must be safe to repeat.
  client_nonce uuid
);

create unique index innits_client_nonce_unique
  on public.innits (pair_id, client_nonce)
  where client_nonce is not null;

-- The only two access patterns: everything for a pair, and one pair-day.
create index innits_pair_local_date on public.innits (pair_id, local_date);
create index innits_pair_sender_date on public.innits (pair_id, sender_id, local_date);

comment on column public.innits.sent_at is
  'The exact moment. This is the interesting data — earliest ever, reply gaps, all of it.';
comment on column public.innits.local_date is
  'Derived server-side from sent_at in the pair''s timezone. Never trusted from the client.';

-- ---------------------------------------------------------------------------
-- local_date is derived, not supplied
--
-- A generated column can't do this because the timezone lives on another table,
-- so it's a trigger. It overwrites whatever the client sent: a client that could
-- choose its own local_date could manufacture a streak.
-- ---------------------------------------------------------------------------
create or replace function public.set_innit_local_date()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pair_timezone text;
begin
  select timezone into strict pair_timezone
  from public.pairs
  where id = new.pair_id;

  new.local_date := (new.sent_at at time zone pair_timezone)::date;
  return new;
end;
$$;

create trigger innits_set_local_date
  before insert or update of sent_at, pair_id on public.innits
  for each row execute function public.set_innit_local_date();

-- ---------------------------------------------------------------------------
-- Membership helper
--
-- Used by every policy below. SECURITY DEFINER so that checking "am I in this
-- pair" doesn't itself have to pass the pairs policy and recurse.
-- ---------------------------------------------------------------------------
create or replace function public.is_pair_member(target_pair uuid, candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.pairs p
    where p.id = target_pair
      and (p.user_a = candidate or p.user_b = candidate)
  );
$$;

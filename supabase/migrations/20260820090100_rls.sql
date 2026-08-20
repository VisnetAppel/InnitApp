-- Row Level Security.
--
-- Two users, but the data should not be readable by anything that isn't one of
-- them. Everything is denied by default and opened one policy at a time.
--
-- Note the absence of any UPDATE or DELETE policy on innits. That is deliberate:
-- with RLS enabled and no policy, those operations are refused. History is
-- append-only.

alter table public.users  enable row level security;
alter table public.pairs  enable row level security;
alter table public.innits enable row level security;

-- Belt and braces: revoke the blanket grants Supabase hands to the API roles, so
-- a future policy mistake can't expose more than intended.
revoke all on public.users, public.pairs, public.innits from anon;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- You can see yourself, and the one person you're paired with.
create policy users_select_self_or_partner
  on public.users for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.pairs p
      where (p.user_a = (select auth.uid()) and p.user_b = public.users.id)
         or (p.user_b = (select auth.uid()) and p.user_a = public.users.id)
    )
  );

-- Your profile row is created once, by you, with your own auth id.
create policy users_insert_self
  on public.users for insert
  to authenticated
  with check (id = (select auth.uid()));

-- You can change your own display name and push token. Nobody else's.
create policy users_update_self
  on public.users for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- pairs
-- ---------------------------------------------------------------------------

create policy pairs_select_member
  on public.pairs for select
  to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

-- You can create a pair you are a member of. Redeeming an invite code is handled
-- by a SECURITY DEFINER function rather than a raw update, so that the code can
-- be checked and burned atomically.
create policy pairs_insert_member
  on public.pairs for insert
  to authenticated
  with check (user_a = (select auth.uid()) or user_b = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- innits
-- ---------------------------------------------------------------------------

create policy innits_select_pair_member
  on public.innits for select
  to authenticated
  using (public.is_pair_member(pair_id, (select auth.uid())));

-- You can only send as yourself, and only into your own pair. 'backfill' is not
-- writable through the API — seeding runs with the service role.
create policy innits_insert_own
  on public.innits for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_pair_member(pair_id, (select auth.uid()))
    and source in ('app', 'widget')
  );

-- ---------------------------------------------------------------------------
-- Pairing
--
-- Redeeming an invite bonds the two accounts permanently and burns the code.
-- Done in one function so there's no window where a code works twice.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_pair public.pairs;
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into target_pair
  from public.pairs
  where invite_code = code
  for update;

  if not found then
    raise exception 'Invalid or already-used invite code';
  end if;

  if target_pair.user_a = me then
    raise exception 'That is your own invite code';
  end if;

  if target_pair.user_b is not null then
    -- The check constraint means a code and a user_b can't coexist, so this is
    -- belt and braces rather than a reachable path.
    raise exception 'This pair is already complete';
  end if;

  update public.pairs
     set user_b = me,
         invite_code = null   -- burn it
   where id = target_pair.id;

  return target_pair.id;
end;
$$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

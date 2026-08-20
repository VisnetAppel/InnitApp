-- Push fan-out.
--
-- Inserting an innit notifies the other person. The HTTP call is made
-- asynchronously by pg_net so that a slow or unreachable push service can never
-- make the insert itself fail — the row landing is what matters; the
-- notification is best-effort on top of it.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Where to send, and with what credentials.
--
-- Kept in a private table rather than a GUC so it survives a project restart.
-- Populate it once; see docs/setup-checklist.md.
-- ---------------------------------------------------------------------------
create schema if not exists private;

create table private.push_config (
  id                  boolean primary key default true constraint push_config_singleton check (id),
  edge_function_url   text not null,
  service_role_key    text not null
);

revoke all on private.push_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fire the Edge Function on insert.
--
-- Backfilled rows are excluded: seeding a year of history should not send a
-- year of notifications.
-- ---------------------------------------------------------------------------
create or replace function public.notify_partner_of_innit()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  config private.push_config;
begin
  if new.source = 'backfill' then
    return new;
  end if;

  select * into config from private.push_config where id;
  if not found then
    -- Not configured yet. The innit is still stored; only the push is skipped.
    raise warning 'push_config is empty — innit % stored without notifying', new.id;
    return new;
  end if;

  perform extensions.net.http_post(
    url     := config.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || config.service_role_key
    ),
    body    := jsonb_build_object(
      'innit_id',  new.id,
      'pair_id',   new.pair_id,
      'sender_id', new.sender_id,
      'sent_at',   new.sent_at
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

create trigger innits_notify_partner
  after insert on public.innits
  for each row execute function public.notify_partner_of_innit();

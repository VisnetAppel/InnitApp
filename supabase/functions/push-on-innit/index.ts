/**
 * Notify the other half of the pair that an innit landed.
 *
 * Invoked by the `innits_notify_partner` trigger, asynchronously via pg_net, so
 * this function failing never blocks or rolls back the insert. The row is the
 * truth; the notification is a courtesy on top of it.
 *
 * Deployed as a Supabase Edge Function (Deno).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type TriggerPayload = {
  innit_id: string;
  pair_id: string;
  sender_id: string;
  sent_at: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Only the database trigger may call this. Edge Functions verify that the bearer
 * token is a valid project JWT, but that includes every signed-in user's token,
 * so the role claim is checked explicitly.
 */
function isServiceRole(request: Request): boolean {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(request)) return json({ error: 'Forbidden' }, 403);

  const payload = (await request.json()) as TriggerPayload;

  // Service role: this runs on behalf of the system, not a user, and needs to
  // read the recipient's push token — which RLS correctly hides from the sender.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pair, error: pairError } = await supabase
    .from('pairs')
    .select('user_a, user_b')
    .eq('id', payload.pair_id)
    .single();

  if (pairError || !pair) return json({ error: 'Pair not found' }, 404);

  const recipientId = pair.user_a === payload.sender_id ? pair.user_b : pair.user_a;
  if (!recipientId) return json({ skipped: 'pair not yet bonded' });

  const { data: people, error: peopleError } = await supabase
    .from('users')
    .select('id, display_name, push_token')
    .in('id', [payload.sender_id, recipientId]);

  if (peopleError || !people) return json({ error: 'Users not found' }, 404);

  const sender = people.find((person) => person.id === payload.sender_id);
  const recipient = people.find((person) => person.id === recipientId);

  if (!recipient?.push_token) {
    // Not an error: notifications may simply be denied on that device.
    return json({ skipped: 'recipient has no push token' });
  }

  const expoResponse = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([
      {
        to: recipient.push_token,
        title: sender?.display_name ?? 'Someone',
        body: 'innit',
        sound: 'default',
        priority: 'high',
        // Wakes the app so it can refresh the widget timeline. Best-effort on
        // iOS, which rate-limits background delivery — see docs/design-audit.md.
        contentAvailable: true,
        data: { type: 'innit', innitId: payload.innit_id, sentAt: payload.sent_at },
      },
    ]),
  });

  const result = await expoResponse.json();
  const ticket = result?.data?.[0];

  // A token stops working when the app is uninstalled or reinstalled. Clearing it
  // stops us retrying a dead token on every innit forever.
  if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
    await supabase.from('users').update({ push_token: null }).eq('id', recipientId);
    return json({ cleared: 'stale push token' });
  }

  if (!expoResponse.ok || ticket?.status === 'error') {
    console.error('Expo push failed', result);
    return json({ error: 'Push rejected', detail: result }, 502);
  }

  return json({ sent: true });
});

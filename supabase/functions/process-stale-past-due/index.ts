// Daily worker invoked by pg_cron. Cancels members whose past_due window
// has exceeded 7 days, sends them a cancellation email, and resets entries.
// Replaces the pure-SQL `cancel_stale_past_due_members` cron so we can
// dispatch transactional emails as part of the same step.
import { createClient } from 'npm:@supabase/supabase-js@2'
// Dynamic import avoids pulling @react-email/components into the module graph at type-check time.
async function sendBillingEmail(opts: { userId: string; template: any }): Promise<unknown> {
  const mod = await import('../_shared/billing-emails.ts' as string)
  return mod.sendBillingEmail(opts)
}
async function brevoMarkCancelled(email: string): Promise<void> {
  const mod = await import('../_shared/billing-emails.ts' as string)
  return mod.brevoMarkCancelled(email)
}


function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch { return null }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const claims = parseJwtClaims(authHeader.slice('Bearer '.length).trim())
  if (claims?.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Find all past_due members whose grace period has expired.
  const { data: stale, error: readErr } = await supabase
    .from('members')
    .select('user_id, stripe_customer_id')
    .eq('status', 'past_due')
    .lte('past_due_since', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  if (readErr) {
    console.error('process-stale-past-due read failed', readErr)
    return new Response(JSON.stringify({ error: readErr.message }), { status: 500 })
  }

  let cancelled = 0
  for (const row of stale ?? []) {
    const userId = (row as { user_id: string }).user_id
    // 2. Flip status to cancelled, reset entries (matches webhook cancel path).
    const { error: updErr } = await supabase
      .from('members')
      .update({
        status: 'cancelled',
        entries: 0,
        past_due_since: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'past_due') // guard against race with webhook reactivation
    if (updErr) {
      console.error('cancel update failed', { userId, error: updErr })
      continue
    }

    // 2b. Keep subscriptions row in sync so has_active_subscription() RLS
    // does not still grant access until current_period_end passes.
    const { error: subErr } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'past_due')
    if (subErr) {
      console.error('subscriptions sync failed', { userId, error: subErr })
    }

    // 3. Notify the member and update Brevo. Both are best-effort.
    await sendBillingEmail({
      userId,
      template: { kind: 'cancelled', reason: 'stale_past_due' },
    })

    // Brevo sync needs the email.
    const { data: userResp } = await supabase.auth.admin.getUserById(userId)
    const email = userResp?.user?.email
    if (email) await brevoMarkCancelled(email)

    cancelled++
  }

  return new Response(JSON.stringify({ ok: true, cancelled }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

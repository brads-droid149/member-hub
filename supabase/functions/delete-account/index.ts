// Self-service account deletion. Cancels the user's Stripe subscription
// (immediate), sends a final confirmation email, then deletes the auth
// user (cascade removes profiles + members + subscriptions rows).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createStripeClient } from '../_shared/stripe.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
// Dynamic import avoids pulling @react-email/components into the module graph at type-check time.
async function sendBillingEmail(opts: { userId: string; template: any }): Promise<unknown> {
  const mod = await import('../_shared/billing-emails.ts')
  return mod.sendBillingEmail(opts)
}
async function brevoMarkCancelled(email: string): Promise<void> {
  const mod = await import('../_shared/billing-emails.ts')
  return mod.brevoMarkCancelled(email)
}

import { deleteAccountSchema, parseJsonBody } from '../_shared/validation.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = await parseJsonBody(req, deleteAccountSchema, corsHeaders)
    if (parsed.response) return parsed.response
    const { environment } = parsed.data

    // Capture email before deletion for final notification.
    const email = user.email

    // 1. Cancel Stripe subscription immediately (if any). The webhook will
    //    update the local rows, but they'll be cascade-deleted anyway.
    //    We gather every subscription reference we know about (the members
    //    row + all subscription rows for this env) AND sweep the Stripe
    //    customer for any remaining active subs, so a deleted account can
    //    never leave live billing running (previously possible when the
    //    subscriptions row was missing or out of sync).
    const subIds = new Set<string>()
    let customerId: string | undefined

    const { data: member } = await supabase
      .from('members')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const m = member as { stripe_subscription_id?: string; stripe_customer_id?: string } | null
    if (m?.stripe_subscription_id) subIds.add(m.stripe_subscription_id)
    if (m?.stripe_customer_id) customerId = m.stripe_customer_id

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .eq('environment', environment)
    for (const s of (subs ?? []) as Array<{ stripe_subscription_id?: string; stripe_customer_id?: string }>) {
      if (s.stripe_subscription_id) subIds.add(s.stripe_subscription_id)
      if (!customerId && s.stripe_customer_id) customerId = s.stripe_customer_id
    }

    try {
      const stripe = createStripeClient(environment)

      // Sweep the customer for anything not tracked locally.
      if (customerId) {
        try {
          const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
          for (const s of list.data) {
            if (s.status !== 'canceled' && s.status !== 'incomplete_expired') subIds.add(s.id)
          }
        } catch (e) {
          console.error('stripe subscription sweep failed', e)
        }
      }

      for (const id of subIds) {
        try {
          await stripe.subscriptions.cancel(id)
        } catch (e) {
          console.error('stripe cancel during delete-account failed', id, e)
          // Continue — don't trap the user in their account.
        }
      }
    } catch (e) {
      console.error('stripe client unavailable during delete-account', e)
    }


    // 2. Send the final email BEFORE deletion (profile lookup needs the row).
    await sendBillingEmail({
      userId: user.id,
      template: { kind: 'cancelled', reason: 'deleted' },
    })
    if (email) await brevoMarkCancelled(email)

    // 3. Delete the auth user. profiles/members/subscriptions cascade on FK.
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
    if (delError) {
      console.error('auth.admin.deleteUser failed', delError)
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('delete-account error', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

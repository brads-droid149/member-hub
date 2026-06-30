// Self-service account deletion. Cancels the user's Stripe subscription
// (immediate), sends a final confirmation email, then deletes the auth
// user (cascade removes profiles + members + subscriptions rows).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createStripeClient } from '../_shared/stripe.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sendBillingEmail, brevoMarkCancelled } from '../_shared/billing-emails.ts'
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
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .eq('environment', environment)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const stripeSubId = (sub as { stripe_subscription_id?: string } | null)?.stripe_subscription_id
    if (stripeSubId) {
      try {
        const stripe = createStripeClient(environment)
        await stripe.subscriptions.cancel(stripeSubId)
      } catch (e) {
        console.error('stripe cancel during delete-account failed', e)
        // Continue — don't trap the user in their account.
      }
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
      return new Response(JSON.stringify({ error: delError.message }), {
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

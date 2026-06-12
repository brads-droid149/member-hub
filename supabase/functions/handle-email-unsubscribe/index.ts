// Validates an unsubscribe token, marks it used, and inserts the address
// into suppressed_emails. Called by the /unsubscribe page in the SPA.
//
// GET  /handle-email-unsubscribe?token=...  -> { valid, email, alreadyUsed }
// POST /handle-email-unsubscribe { token }  -> confirms the unsubscribe
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = getSupabase()

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: 'missing_token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data } = await supabase
      .from('email_unsubscribe_tokens')
      .select('email, used_at')
      .eq('token', token)
      .maybeSingle()
    if (!data) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({
      valid: true,
      email: (data as { email: string }).email,
      alreadyUsed: !!(data as { used_at?: string }).used_at,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { token } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'missing_token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data } = await supabase
      .from('email_unsubscribe_tokens')
      .select('email, used_at')
      .eq('token', token)
      .maybeSingle()
    if (!data) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const email = (data as { email: string }).email.toLowerCase()

    // Idempotent: insert suppression (unique on email) + mark token used.
    await supabase.from('suppressed_emails').upsert({
      email,
      reason: 'unsubscribe',
    }, { onConflict: 'email' })
    await supabase
      .from('email_unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('handle-email-unsubscribe error', e)
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

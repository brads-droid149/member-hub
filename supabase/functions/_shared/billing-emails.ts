// Shared helper used by all server-side senders of "billing" emails
// (payments-webhook, admin-cancel-member, process-stale-past-due,
// delete-account). It renders a React Email template, looks up the
// recipient's first name + suppression status, then enqueues onto the
// `transactional_emails` PGMQ queue. process-email-queue then drains it.
//
// We deliberately render here (not in process-email-queue) so the queue
// stays a generic dispatcher — adding a new billing template means a new
// .tsx file, not changes to the worker.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { BillingDunningEmail } from './email-templates/billing-dunning.tsx'
import { BillingCancelledEmail } from './email-templates/billing-cancelled.tsx'
import { BillingReceiptEmail } from './email-templates/billing-receipt.tsx'

const SITE_NAME = 'Junkyard Surf Club'
const ROOT_DOMAIN = 'junkyardsurf.com.au'
const SENDER_DOMAIN = 'notify.junkyardsurf.com.au'
const FROM_DOMAIN = 'notify.junkyardsurf.com.au'
const SITE_URL = `https://members.${ROOT_DOMAIN}`

export type BillingTemplate =
  | { kind: 'dunning'; portalUrl?: string }
  | { kind: 'cancelled'; reason: 'admin' | 'portal' | 'stale_past_due' | 'deleted' }
  | { kind: 'receipt'; amountFormatted: string; invoiceDate: string; invoiceNumber?: string; invoiceUrl?: string; nextBillingDate?: string }

const SUBJECTS: Record<string, string> = {
  dunning: `Action needed: your ${SITE_NAME} payment failed`,
  cancelled: `Your ${SITE_NAME} membership has been cancelled`,
  cancelled_deleted: `Your ${SITE_NAME} account has been deleted`,
  receipt: `Your ${SITE_NAME} renewal receipt`,
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function getFirstName(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle()
  const full = (data as { full_name?: string } | null)?.full_name?.trim()
  if (!full) return undefined
  return full.split(/\s+/)[0]
}

async function isSuppressed(supabase: ReturnType<typeof createClient>, email: string): Promise<boolean> {
  const { data } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return !!data
}

async function getOrCreateUnsubscribeToken(supabase: ReturnType<typeof createClient>, email: string): Promise<string> {
  const lower = email.toLowerCase()
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', lower)
    .maybeSingle()
  if (existing?.token) return existing.token as string
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  await supabase.from('email_unsubscribe_tokens').insert({ email: lower, token })
  return token
}

/**
 * Render + enqueue a billing email for a known user.
 * Silently no-ops (with a log) if the user has no email, is suppressed,
 * or rendering/queueing fails — never throws into the caller.
 */
export async function sendBillingEmail(opts: {
  userId: string
  template: BillingTemplate
}): Promise<{ enqueued: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseAdmin()
    const { data: userResp } = await supabase.auth.admin.getUserById(opts.userId)
    const email = userResp?.user?.email
    if (!email) return { enqueued: false, reason: 'no_email' }
    if (await isSuppressed(supabase, email)) return { enqueued: false, reason: 'suppressed' }

    const firstName = await getFirstName(supabase, opts.userId)
    let component: React.ReactElement
    let subject: string
    let label: string

    switch (opts.template.kind) {
      case 'dunning':
        component = React.createElement(BillingDunningEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL, firstName, portalUrl: opts.template.portalUrl,
        })
        subject = SUBJECTS.dunning
        label = 'billing-dunning'
        break
      case 'cancelled':
        component = React.createElement(BillingCancelledEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL, firstName,
          reason: opts.template.reason, rejoinUrl: `${SITE_URL}/subscribe`,
        })
        subject = opts.template.reason === 'deleted' ? SUBJECTS.cancelled_deleted : SUBJECTS.cancelled
        label = `billing-cancelled-${opts.template.reason}`
        break
      case 'receipt':
        component = React.createElement(BillingReceiptEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL, firstName,
          amountFormatted: opts.template.amountFormatted,
          invoiceDate: opts.template.invoiceDate,
          invoiceNumber: opts.template.invoiceNumber,
          invoiceUrl: opts.template.invoiceUrl,
          nextBillingDate: opts.template.nextBillingDate,
        })
        subject = SUBJECTS.receipt
        label = 'billing-receipt'
        break
    }

    const html = await renderAsync(component)
    const text = await renderAsync(component, { plainText: true })
    const messageId = crypto.randomUUID()
    const unsubscribe_token = await getOrCreateUnsubscribeToken(supabase, email)

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: label,
      recipient_email: email,
      status: 'pending',
    })

    const { error } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label,
        unsubscribe_token,
        queued_at: new Date().toISOString(),
      },
    })

    if (error) {
      console.error('sendBillingEmail enqueue failed', { error, userId: opts.userId, label })
      return { enqueued: false, reason: 'enqueue_failed' }
    }
    return { enqueued: true }
  } catch (e) {
    console.error('sendBillingEmail failed', e)
    return { enqueued: false, reason: 'exception' }
  }
}

/**
 * Best-effort Brevo sync that flips MARKETING_OPT_IN to false and stamps
 * a status attribute. Used when a member cancels — keeps marketing lists
 * fresh without requiring the user's JWT. Never throws.
 */
export async function brevoMarkCancelled(email: string): Promise<void> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
    if (!LOVABLE_API_KEY || !BREVO_API_KEY) return
    const res = await fetch('https://connector-gateway.lovable.dev/brevo/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        updateEnabled: true,
        attributes: {
          MARKETING_OPT_IN: false,
          MEMBERSHIP_STATUS: 'cancelled',
        },
      }),
    })
    if (!res.ok) console.error('brevoMarkCancelled non-ok', res.status, await res.text().catch(() => ''))
  } catch (e) {
    console.error('brevoMarkCancelled failed', e)
  }
}

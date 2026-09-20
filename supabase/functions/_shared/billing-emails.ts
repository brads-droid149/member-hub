// Shared helper used by all server-side senders of "billing" emails
// (payments-webhook, admin-cancel-member, process-stale-past-due,
// delete-account). It sends through Lovable's managed email API using the
// registered transactional templates. Suppression, retries, rate limits and
// unsubscribe handling are enforced by Lovable server-side.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from './transactional-email-templates/send-email.ts'
import {
  getSubjectAndLabel,
  pickFirstName,
  SITE_NAME,
  SITE_URL,
  type BillingTemplate,
} from './billing-emails-helpers.ts'

export type { BillingTemplate }

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function getFirstName(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle()
  return pickFirstName((data as { full_name?: string } | null)?.full_name)
}

async function logSend(
  supabase: ReturnType<typeof createClient>,
  row: {
    template_name: string
    recipient_email: string
    status: 'sent' | 'suppressed' | 'failed'
    error_message?: string
  },
) {
  const { error } = await supabase.from('email_send_log').insert(row)
  if (error) console.error('email_send_log insert failed', { error, status: row.status })
}

/**
 * Render + send a billing email for a known user.
 * Silently no-ops (with a log) if the user has no email or the send fails —
 * never throws into the caller.
 */
export async function sendBillingEmail(opts: {
  userId: string
  template: BillingTemplate
}): Promise<{ enqueued: boolean; reason?: string }> {
  const supabase = getSupabaseAdmin()
  let email: string | undefined
  const { label } = getSubjectAndLabel(opts.template)

  try {
    const { data: userResp } = await supabase.auth.admin.getUserById(opts.userId)
    email = userResp?.user?.email
    if (!email) return { enqueued: false, reason: 'no_email' }

    const firstName = await getFirstName(supabase, opts.userId)

    let templateName: string
    let templateData: Record<string, unknown>

    switch (opts.template.kind) {
      case 'dunning':
        templateName = 'billing-dunning'
        templateData = {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          firstName,
          portalUrl: opts.template.portalUrl,
        }
        break
      case 'cancelled':
        templateName = 'billing-cancelled'
        templateData = {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          firstName,
          reason: opts.template.reason,
          rejoinUrl: `${SITE_URL}/subscribe`,
        }
        break
      case 'receipt':
        templateName = 'billing-receipt'
        templateData = {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          firstName,
          amountFormatted: opts.template.amountFormatted,
          invoiceDate: opts.template.invoiceDate,
          invoiceNumber: opts.template.invoiceNumber,
          invoiceUrl: opts.template.invoiceUrl,
          nextBillingDate: opts.template.nextBillingDate,
        }
        break
    }

    const result = await sendTemplateEmail(templateName, email, {
      templateData,
      idempotencyKey: `${label}-${opts.userId}-${crypto.randomUUID()}`,
    })

    if (!result.sent) {
      await logSend(supabase, {
        template_name: label,
        recipient_email: email,
        status: 'suppressed',
        error_message: 'Recipient suppressed',
      })
      return { enqueued: false, reason: 'suppressed' }
    }

    await logSend(supabase, {
      template_name: label,
      recipient_email: email,
      status: 'sent',
    })
    return { enqueued: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('sendBillingEmail failed', { label, message })
    if (email) {
      await logSend(supabase, {
        template_name: label,
        recipient_email: email,
        status: 'failed',
        error_message: message.slice(0, 1000),
      })
    }
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

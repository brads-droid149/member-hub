import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Notification-only bookkeeping: Lovable enforces suppression at send time.
// These rows keep the project's own audit trail (email_send_log) and the
// historical suppressed_emails list in sync with delivery outcomes.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function recordOutcome(
  recipient: string,
  logStatus: 'bounced' | 'complained' | 'suppressed',
  suppressionReason: 'bounce' | 'complaint' | 'unsubscribe',
  description: string,
  eventId: string,
) {
  const email = recipient.toLowerCase()

  const { error: logError } = await supabase.from('email_send_log').insert({
    template_name: 'system',
    recipient_email: recipient,
    status: logStatus,
    error_message: description,
  })
  if (logError) {
    console.error('email_send_log insert failed', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('email_send_log insert failed')
  }

  const { error: suppressionError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason: suppressionReason }, { onConflict: 'email' })
  if (suppressionError) {
    console.error('suppressed_emails upsert failed', {
      event_id: eventId,
      code: suppressionError.code,
      message: suppressionError.message,
    })
    throw new Error('suppressed_emails upsert failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordOutcome(
        event.data.recipient,
        'bounced',
        'bounce',
        'Email bounced',
        event.event_id,
      )
    },
    'email.complaint': async (event) => {
      await recordOutcome(
        event.data.recipient,
        'complained',
        'complaint',
        'Spam complaint received',
        event.event_id,
      )
    },
    'email.unsubscribed': async (event) => {
      await recordOutcome(
        event.data.recipient,
        'suppressed',
        'unsubscribe',
        'Recipient unsubscribed',
        event.event_id,
      )
    },
  },
})

Deno.serve((req) => handler(req))

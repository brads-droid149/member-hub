// Launch-monitoring worker.
//
// Runs the `system_health_snapshot()` database routine, reconciles the result
// against `public.system_alerts` (open / still-open / resolved), and emails
// every admin when something new breaks or an existing problem clears.
//
// Invoked two ways:
//   1. pg_cron every 15 minutes with the service-role key (sends emails).
//   2. Manually from the Admin panel by an admin JWT (`{"notify": false}` by
//      default, so a manual refresh never spams the team).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SITE_NAME = 'Junkyard Surf Club'
const SITE_URL = 'https://members.junkyardsurf.com.au'
const SENDER_DOMAIN = 'notify.junkyardsurf.com.au'
const FROM_DOMAIN = 'notify.junkyardsurf.com.au'
// Don't re-send a reminder about the same still-open issue more often than this.
const RENOTIFY_HOURS = 12

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface Issue {
  key: string
  severity: string
  title: string
  detail?: Record<string, unknown>
}

interface AlertRow {
  check_key: string
  severity: string
  title: string
  detail: Record<string, unknown>
  status: string
  notified_at: string | null
}

async function getAdminEmails(): Promise<string[]> {
  const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
  const emails: string[] = []
  for (const r of (roles ?? []) as { user_id: string }[]) {
    const { data } = await supabase.auth.admin.getUserById(r.user_id)
    const email = data?.user?.email
    if (email) emails.push(email)
  }
  return [...new Set(emails)]
}

async function sendAlertEmail(payload: {
  newIssues: Issue[]
  ongoingIssues: Issue[]
  resolvedIssues: Issue[]
  generatedAt: string
}): Promise<number> {
  const recipients = await getAdminEmails()
  if (recipients.length === 0) {
    console.error('system-health-check: no admin recipients found')
    return 0
  }

  // Dynamic import keeps @react-email out of the module graph unless we send.
  const { sendTemplateEmail } = await import(
    '../_shared/transactional-email-templates/send-email.ts'
  )

  const templateData = {
    siteName: SITE_NAME,
    adminUrl: `${SITE_URL}/admin`,
    ...payload,
  }

  let sent = 0
  for (const to of recipients) {
    try {
      const result = await sendTemplateEmail('admin-system-alert', to, {
        templateData,
        idempotencyKey: `admin-system-alert-${payload.generatedAt}-${to}`,
      })
      if (!result.sent) {
        const { error } = await supabase.from('email_send_log').insert({
          template_name: 'admin-system-alert',
          recipient_email: to,
          status: 'suppressed',
          error_message: 'Recipient suppressed',
        })
        if (error) console.error('email_send_log insert failed', { error })
        continue
      }
      const { error } = await supabase.from('email_send_log').insert({
        template_name: 'admin-system-alert',
        recipient_email: to,
        status: 'sent',
      })
      if (error) console.error('email_send_log insert failed', { error })
      sent++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('system-health-check send failed', { message })
      const { error } = await supabase.from('email_send_log').insert({
        template_name: 'admin-system-alert',
        recipient_email: to,
        status: 'failed',
        error_message: message.slice(0, 1000),
      })
      if (error) console.error('email_send_log insert failed', { error })
    }
  }
  return sent
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Unauthorized' }, 401)

    // Never trust unverified JWT payload claims: the only way to be treated as
    // the internal cron caller is presenting the actual service-role secret.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const isServiceRole = serviceKey.length > 0 && token === serviceKey

    let notify = isServiceRole
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return json({ error: 'Unauthorized' }, 401)
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      if (!isAdmin) return json({ error: 'Forbidden' }, 403)
      const body = await req.json().catch(() => ({}))
      notify = body?.notify === true
    }

    const { data: snapshot, error: snapErr } = await supabase.rpc('system_health_snapshot')
    if (snapErr) {
      console.error('system-health-check snapshot failed', snapErr)
      return json({ error: 'Health check failed' }, 500)
    }

    const generatedAt = (snapshot as { generated_at: string }).generated_at
    const issues = ((snapshot as { issues: Issue[] }).issues ?? [])
    const issueKeys = issues.map((i) => i.key)

    const { data: existingRaw } = await supabase
      .from('system_alerts')
      .select('check_key, severity, title, detail, status, notified_at')
    const existing = (existingRaw ?? []) as AlertRow[]
    const byKey = new Map(existing.map((r) => [r.check_key, r]))

    const nowIso = new Date().toISOString()
    const newIssues: Issue[] = []
    const ongoingIssues: Issue[] = []

    for (const issue of issues) {
      const prev = byKey.get(issue.key)
      const isNew = !prev || prev.status !== 'open'
      const staleNotification = prev?.notified_at
        ? Date.now() - new Date(prev.notified_at).getTime() > RENOTIFY_HOURS * 3600_000
        : true
      if (isNew) newIssues.push(issue)
      else if (staleNotification) ongoingIssues.push(issue)

      await supabase.from('system_alerts').upsert({
        check_key: issue.key,
        severity: issue.severity,
        title: issue.title,
        detail: issue.detail ?? {},
        status: 'open',
        first_seen_at: prev && prev.status === 'open' ? undefined : nowIso,
        last_seen_at: nowIso,
        resolved_at: null,
      }, { onConflict: 'check_key' })
    }

    const resolvedIssues: Issue[] = existing
      .filter((r) => r.status === 'open' && !issueKeys.includes(r.check_key))
      .map((r) => ({ key: r.check_key, severity: r.severity, title: r.title }))

    if (resolvedIssues.length > 0) {
      await supabase
        .from('system_alerts')
        .update({ status: 'resolved', resolved_at: nowIso })
        .in('check_key', resolvedIssues.map((r) => r.key))
    }

    let emailsSent = 0
    const shouldEmail = notify && (newIssues.length > 0 || ongoingIssues.length > 0 || resolvedIssues.length > 0)
    if (shouldEmail) {
      emailsSent = await sendAlertEmail({ newIssues, ongoingIssues, resolvedIssues, generatedAt })
      const notifiedKeys = [...newIssues, ...ongoingIssues].map((i) => i.key)
      if (emailsSent > 0 && notifiedKeys.length > 0) {
        await supabase.from('system_alerts').update({ notified_at: nowIso }).in('check_key', notifiedKeys)
      }
    }

    return json({
      ok: true,
      generated_at: generatedAt,
      open: issues.length,
      new: newIssues.length,
      resolved: resolvedIssues.length,
      emails_sent: emailsSent,
      issues,
    })
  } catch (e) {
    console.error('system-health-check error', e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})

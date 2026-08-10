// Renders the admin system-alert email. Kept in its own module so the
// health-check worker can dynamically import it (keeps React + @react-email
// out of the worker's module graph unless an email actually needs sending).
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { AdminAlertEmail, type AlertItem } from './email-templates/admin-alert.tsx'

export async function renderAdminAlert(payload: {
  siteName: string
  adminUrl: string
  newIssues: AlertItem[]
  ongoingIssues: AlertItem[]
  resolvedIssues: AlertItem[]
  generatedAt: string
}): Promise<{ html: string; text: string }> {
  const component = React.createElement(AdminAlertEmail, payload)
  return {
    html: await renderAsync(component),
    text: await renderAsync(component, { plainText: true }),
  }
}

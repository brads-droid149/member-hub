import { AdminAlertEmail } from '../email-templates/admin-alert.tsx'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Junkyard Surf Club'
const SITE_URL = 'https://members.junkyardsurf.com.au'

export const template = {
  component: AdminAlertEmail,
  subject: (data: Record<string, any>) => {
    const newIssues = (data?.newIssues ?? []) as { severity?: string }[]
    const resolvedIssues = (data?.resolvedIssues ?? []) as unknown[]
    const criticalCount = newIssues.filter((i) => i.severity === 'critical').length
    return newIssues.length > 0
      ? `${criticalCount > 0 ? '🚨' : '⚠️'} ${SITE_NAME}: ${newIssues.length} issue(s) detected`
      : `✅ ${SITE_NAME}: ${resolvedIssues.length} issue(s) resolved`
  },
  displayName: 'Admin — system alert digest',
  previewData: {
    siteName: SITE_NAME,
    adminUrl: `${SITE_URL}/admin`,
    newIssues: [
      { key: 'email_failures', severity: 'warning', title: 'Email failures detected' },
    ],
    ongoingIssues: [],
    resolvedIssues: [],
    generatedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

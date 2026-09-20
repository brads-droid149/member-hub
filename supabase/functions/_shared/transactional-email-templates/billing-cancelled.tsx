import { BillingCancelledEmail } from '../email-templates/billing-cancelled.tsx'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Junkyard Surf Club'
const SITE_URL = 'https://members.junkyardsurf.com.au'

export const template = {
  component: BillingCancelledEmail,
  subject: (data: Record<string, any>) =>
    data?.reason === 'deleted'
      ? `Your ${SITE_NAME} account has been deleted`
      : `Your ${SITE_NAME} membership has been cancelled`,
  displayName: 'Billing — membership cancelled',
  previewData: {
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    firstName: 'Sam',
    reason: 'portal',
    rejoinUrl: `${SITE_URL}/subscribe`,
  },
} satisfies TemplateEntry

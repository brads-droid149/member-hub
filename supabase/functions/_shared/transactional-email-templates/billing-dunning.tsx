import { BillingDunningEmail } from '../email-templates/billing-dunning.tsx'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Junkyard Surf Club'
const SITE_URL = 'https://members.junkyardsurf.com.au'

export const template = {
  component: BillingDunningEmail,
  subject: `Action needed: your ${SITE_NAME} payment failed`,
  displayName: 'Billing — payment failed',
  previewData: {
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    firstName: 'Sam',
    portalUrl: `${SITE_URL}/membership`,
  },
} satisfies TemplateEntry

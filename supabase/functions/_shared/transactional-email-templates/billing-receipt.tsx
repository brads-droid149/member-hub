import { BillingReceiptEmail } from '../email-templates/billing-receipt.tsx'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Junkyard Surf Club'
const SITE_URL = 'https://members.junkyardsurf.com.au'

export const template = {
  component: BillingReceiptEmail,
  subject: `Your ${SITE_NAME} renewal receipt`,
  displayName: 'Billing — receipt',
  previewData: {
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    firstName: 'Sam',
    amountFormatted: 'A$5.00',
    invoiceDate: '1 January 2026',
    invoiceNumber: 'INV-0001',
    invoiceUrl: `${SITE_URL}/membership`,
    nextBillingDate: '1 February 2026',
  },
} satisfies TemplateEntry

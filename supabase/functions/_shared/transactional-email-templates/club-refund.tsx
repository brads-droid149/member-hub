import { ClubRefundEmail } from '../email-templates/club-refund.tsx'
import type { TemplateEntry } from './registry.ts'

export const template = {
  component: ClubRefundEmail,
  subject: 'Your Junkyard Surf Club refund has been issued',
  displayName: 'Club refund confirmation',
  previewData: { firstName: 'Sam', amount: '5.00' },
} satisfies TemplateEntry

import { ClubClosureEmail } from '../email-templates/club-closure.tsx'
import type { TemplateEntry } from './registry.ts'

export const template = {
  component: ClubClosureEmail,
  subject: 'Important: Junkyard Surf Club is closing today (Membership & Refund info)',
  displayName: 'Club closure notice',
  previewData: { firstName: 'Sam' },
} satisfies TemplateEntry

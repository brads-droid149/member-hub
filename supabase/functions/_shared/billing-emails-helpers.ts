// Pure helpers extracted from billing-emails.ts so they can be unit-tested
// without pulling @react-email/components into the Deno module graph.

export const SITE_NAME = 'Junkyard Surf Club'
export const ROOT_DOMAIN = 'junkyardsurf.com.au'
export const SENDER_DOMAIN = 'notify.junkyardsurf.com.au'
export const FROM_DOMAIN = 'notify.junkyardsurf.com.au'
export const SITE_URL = `https://members.${ROOT_DOMAIN}`

export type BillingTemplate =
  | { kind: 'dunning'; portalUrl?: string }
  | { kind: 'cancelled'; reason: 'admin' | 'portal' | 'stale_past_due' | 'deleted' }
  | {
      kind: 'receipt'
      amountFormatted: string
      invoiceDate: string
      invoiceNumber?: string
      invoiceUrl?: string
      nextBillingDate?: string
    }

export const SUBJECTS: Record<string, string> = {
  dunning: `Action needed: your ${SITE_NAME} payment failed`,
  cancelled: `Your ${SITE_NAME} membership has been cancelled`,
  cancelled_deleted: `Your ${SITE_NAME} account has been deleted`,
  receipt: `Your ${SITE_NAME} renewal receipt`,
}

/** Extract first name from a full name string, trimming/splitting safely. */
export function pickFirstName(fullName?: string | null): string | undefined {
  const full = fullName?.trim()
  if (!full) return undefined
  return full.split(/\s+/)[0]
}

/** Map a BillingTemplate to its outgoing subject + tracking label. */
export function getSubjectAndLabel(
  template: BillingTemplate,
): { subject: string; label: string } {
  switch (template.kind) {
    case 'dunning':
      return { subject: SUBJECTS.dunning, label: 'billing-dunning' }
    case 'cancelled':
      return {
        subject:
          template.reason === 'deleted'
            ? SUBJECTS.cancelled_deleted
            : SUBJECTS.cancelled,
        label: `billing-cancelled-${template.reason}`,
      }
    case 'receipt':
      return { subject: SUBJECTS.receipt, label: 'billing-receipt' }
  }
}


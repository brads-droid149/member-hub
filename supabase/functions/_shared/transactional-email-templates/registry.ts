import type { ComponentType } from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as billingDunning } from './billing-dunning.tsx'
import { template as billingCancelled } from './billing-cancelled.tsx'
import { template as billingReceipt } from './billing-receipt.tsx'
import { template as adminSystemAlert } from './admin-system-alert.tsx'

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'billing-dunning': billingDunning,
  'billing-cancelled': billingCancelled,
  'billing-receipt': billingReceipt,
  'admin-system-alert': adminSystemAlert,
}

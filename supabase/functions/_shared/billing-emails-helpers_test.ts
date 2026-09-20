import { assertEquals } from 'jsr:@std/assert@1'
import {
  getSubjectAndLabel,
  pickFirstName,
  SUBJECTS,
} from './billing-emails-helpers.ts'

Deno.test('pickFirstName: returns first whitespace-separated token', () => {
  assertEquals(pickFirstName('Jane Doe'), 'Jane')
  assertEquals(pickFirstName('  Jean-Luc   Picard '), 'Jean-Luc')
  assertEquals(pickFirstName('Cher'), 'Cher')
})

Deno.test('pickFirstName: undefined for empty/whitespace/null', () => {
  assertEquals(pickFirstName(undefined), undefined)
  assertEquals(pickFirstName(null), undefined)
  assertEquals(pickFirstName(''), undefined)
  assertEquals(pickFirstName('   '), undefined)
})

Deno.test('getSubjectAndLabel: dunning', () => {
  const r = getSubjectAndLabel({ kind: 'dunning' })
  assertEquals(r.subject, SUBJECTS.dunning)
  assertEquals(r.label, 'billing-dunning')
})

Deno.test('getSubjectAndLabel: cancelled non-deleted uses cancelled subject', () => {
  for (const reason of ['admin', 'portal', 'stale_past_due'] as const) {
    const r = getSubjectAndLabel({ kind: 'cancelled', reason })
    assertEquals(r.subject, SUBJECTS.cancelled)
    assertEquals(r.label, `billing-cancelled-${reason}`)
  }
})

Deno.test('getSubjectAndLabel: cancelled-deleted uses account-deleted subject', () => {
  const r = getSubjectAndLabel({ kind: 'cancelled', reason: 'deleted' })
  assertEquals(r.subject, SUBJECTS.cancelled_deleted)
  assertEquals(r.label, 'billing-cancelled-deleted')
})

Deno.test('getSubjectAndLabel: receipt', () => {
  const r = getSubjectAndLabel({
    kind: 'receipt',
    amountFormatted: '$50.00',
    invoiceDate: '2025-01-01',
  })
  assertEquals(r.subject, SUBJECTS.receipt)
  assertEquals(r.label, 'billing-receipt')
})

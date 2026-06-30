import { assertEquals, assertMatch } from 'jsr:@std/assert@1'
import {
  buildEnqueuePayload,
  FROM_DOMAIN,
  getSubjectAndLabel,
  pickFirstName,
  SENDER_DOMAIN,
  SITE_NAME,
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

Deno.test('buildEnqueuePayload: shapes a PGMQ payload with sender/from set', () => {
  const out = buildEnqueuePayload({
    messageId: 'msg_abc',
    email: 'user@example.com',
    subject: 'Hello',
    label: 'billing-dunning',
    html: '<p>hi</p>',
    text: 'hi',
    unsubscribeToken: 'tok_xyz',
    queuedAt: '2025-01-01T00:00:00.000Z',
  })

  assertEquals(out.queue_name, 'transactional_emails')
  assertEquals(out.payload.to, 'user@example.com')
  assertEquals(out.payload.from, `${SITE_NAME} <noreply@${FROM_DOMAIN}>`)
  assertEquals(out.payload.sender_domain, SENDER_DOMAIN)
  assertEquals(out.payload.subject, 'Hello')
  assertEquals(out.payload.label, 'billing-dunning')
  assertEquals(out.payload.purpose, 'transactional')
  assertEquals(out.payload.message_id, 'msg_abc')
  assertEquals(out.payload.unsubscribe_token, 'tok_xyz')
  assertEquals(out.payload.queued_at, '2025-01-01T00:00:00.000Z')
})

Deno.test('buildEnqueuePayload: defaults queued_at to an ISO timestamp', () => {
  const out = buildEnqueuePayload({
    messageId: 'm',
    email: 'a@b.co',
    subject: 's',
    label: 'l',
    html: '',
    text: '',
    unsubscribeToken: 't',
  })
  assertMatch(out.payload.queued_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
})

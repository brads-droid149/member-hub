/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  siteName: string
  siteUrl: string
  firstName?: string
  reason: 'admin' | 'portal' | 'stale_past_due' | 'deleted'
  rejoinUrl?: string
}

const HEADLINES: Record<Props['reason'], string> = {
  admin: 'Your membership has been cancelled',
  portal: 'Your membership has been cancelled',
  stale_past_due: 'Your membership has been cancelled',
  deleted: 'Your account has been deleted',
}

const BODIES: Record<Props['reason'], string> = {
  admin: 'A member of our team has cancelled your membership.',
  portal: 'Your membership has been cancelled at your request.',
  stale_past_due: "We weren't able to collect payment for your membership after multiple attempts, so it has been cancelled.",
  deleted: 'Your account and membership have been permanently deleted at your request.',
}

export const BillingCancelledEmail = ({ siteName, siteUrl, firstName, reason, rejoinUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{HEADLINES[reason]}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{HEADLINES[reason]}</Heading>
        <Text style={text}>
          {firstName ? `Hi ${firstName},` : 'Hi,'} {BODIES[reason]}
        </Text>
        <Text style={text}>
          You'll no longer be billed, your giveaway entries have been reset, and access to{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link> has ended.
        </Text>
        {reason !== 'deleted' && rejoinUrl && (
          <>
            <Text style={text}>Changed your mind? You're welcome back anytime.</Text>
            <Button style={button} href={rejoinUrl}>Rejoin the Club</Button>
          </>
        )}
        <Text style={footer}>Thanks for being part of the club.</Text>
      </Container>
    </Body>
  </Html>
)

export default BillingCancelledEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: 'hsl(0, 0%, 10%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(0, 0%, 25%)', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: 'hsl(168, 100%, 36%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(168, 100%, 36%)', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block', margin: '12px 0' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '32px 0 0' }

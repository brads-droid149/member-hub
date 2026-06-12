/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  siteName: string
  siteUrl: string
  firstName?: string
  portalUrl?: string
}

export const BillingDunningEmail = ({ siteName, siteUrl, firstName, portalUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} payment didn't go through</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment failed</Heading>
        <Text style={text}>
          {firstName ? `Hi ${firstName},` : 'Hi,'} we couldn't charge your card for your
          {' '}<Link href={siteUrl} style={link}><strong>{siteName}</strong></Link> membership.
        </Text>
        <Text style={text}>
          We'll retry over the next few days. To avoid losing access, please update your
          payment method now — your membership will be cancelled if payment isn't received
          within 7 days.
        </Text>
        {portalUrl && (
          <Button style={button} href={portalUrl}>Update payment method</Button>
        )}
        <Text style={footer}>If you've already fixed this, you can ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default BillingDunningEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: 'hsl(0, 0%, 10%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(0, 0%, 25%)', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: 'hsl(168, 100%, 36%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(168, 100%, 36%)', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block', margin: '12px 0' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '32px 0 0' }

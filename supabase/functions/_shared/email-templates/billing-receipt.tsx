/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  siteName: string
  siteUrl: string
  firstName?: string
  amountFormatted: string
  invoiceDate: string
  invoiceNumber?: string
  invoiceUrl?: string
  nextBillingDate?: string
}

export const BillingReceiptEmail = ({
  siteName, siteUrl, firstName, amountFormatted, invoiceDate, invoiceNumber, invoiceUrl, nextBillingDate,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} renewal receipt</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks — your renewal went through</Heading>
        <Text style={text}>
          {firstName ? `Hi ${firstName},` : 'Hi,'} we've successfully renewed your{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link> membership.
        </Text>
        <Text style={text}>
          <strong>Amount:</strong> {amountFormatted} (GST inclusive)<br />
          <strong>Date:</strong> {invoiceDate}
          {invoiceNumber && <><br /><strong>Invoice:</strong> {invoiceNumber}</>}
          {nextBillingDate && <><br /><strong>Next bill:</strong> {nextBillingDate}</>}
        </Text>
        {invoiceUrl && (
          <Text style={text}>
            <Link href={invoiceUrl} style={link}>Download invoice</Link>
          </Text>
        )}
        <Text style={footer}>You can manage your subscription anytime from your dashboard.</Text>
      </Container>
    </Body>
  </Html>
)

export default BillingReceiptEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: 'hsl(0, 0%, 10%)', margin: '0 0 20px' }
const text = { fontSize: '15px', color: 'hsl(0, 0%, 25%)', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: 'hsl(168, 100%, 36%)', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '32px 0 0' }

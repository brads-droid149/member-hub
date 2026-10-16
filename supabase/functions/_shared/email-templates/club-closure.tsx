/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  firstName?: string
}

export const ClubClosureEmail = ({ firstName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Junkyard Surf Club is closing today — your membership and refund details</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Junkyard Surf Club is closing</Heading>
        <Text style={text}>{firstName ? `Hi ${firstName},` : 'Hi,'}</Text>
        <Text style={text}>
          We're writing to let you know that <strong>Junkyard Surf Club is shutting down today</strong>, and all memberships have ended.
        </Text>
        <Text style={text}>Here is what has been done and what to expect:</Text>
        <Text style={text}>
          <strong>1. Your subscription is cancelled effective immediately.</strong> Your recurring billing has been stopped and you will never be charged again.
        </Text>
        <Text style={text}>
          <strong>2. Refunds are being issued to all members:</strong>
          <br />• <strong>Monthly members:</strong> You will receive a 100% refund for this month's membership fee ($5.00).
          <br />• <strong>Annual members:</strong> You will receive a refund for the full remaining unused portion of your annual membership.
        </Text>
        <Text style={text}>
          <strong>3. Timing:</strong> Because of standard bank processing times to transfer funds into our merchant account, <strong>all refunds will be processed to your original payment card within the next 2 weeks</strong>. You will receive a separate confirmation receipt from Stripe once the refund is triggered.
        </Text>
        <Text style={text}>
          Thank you so much for backing us and being part of the club. If you have any questions at all, please feel free to reply directly to this email or reach out to us at{' '}
          <Link href="mailto:support@junkyardsurf.com.au" style={link}><strong>support@junkyardsurf.com.au</strong></Link>.
        </Text>
        <Text style={text}>
          Warm regards,<br /><strong>The Junkyard Surf Club Team</strong><br />
          <Link href="https://junkyardsurf.com.au" style={link}>junkyardsurf.com.au</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ClubClosureEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1a1a1a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#404040', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: '#00B894', textDecoration: 'underline' }

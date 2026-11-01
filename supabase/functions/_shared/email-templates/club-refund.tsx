/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  firstName?: string
  amount?: string
}

export const ClubRefundEmail = ({ firstName, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Junkyard Surf Club refund is on its way</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your refund is on its way</Heading>
        <Text style={text}>{firstName ? `Hi ${firstName},` : 'Hi,'}</Text>
        <Text style={text}>
          As promised, we've now issued your refund of <strong>A${amount ?? ''}</strong> to your original payment card.
        </Text>
        <Text style={text}>
          Depending on your bank, it can take 5–10 business days to appear on your statement.
        </Text>
        <Text style={text}>
          Thanks again for being part of the club. Any questions, just reply to this email or contact{' '}
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

export default ClubRefundEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1a1a1a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#404040', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: '#00B894', textDecoration: 'underline' }

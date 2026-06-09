/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to the club</Heading>
        <Text style={text}>
          Thanks for joining{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Confirm your email ({recipient}) to activate your membership.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm email
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: 'hsl(0, 0%, 10%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(0, 0%, 25%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'hsl(168, 100%, 36%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(168, 100%, 36%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '32px 0 0' }

/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

export interface AlertItem {
  key: string
  severity: string
  title: string
  detail?: Record<string, unknown>
}

interface Props {
  siteName: string
  adminUrl: string
  newIssues: AlertItem[]
  ongoingIssues: AlertItem[]
  resolvedIssues: AlertItem[]
  generatedAt: string
}

const sev = (s: string) => (s === 'critical' ? critical : warning)

export const AdminAlertEmail = ({ siteName, adminUrl, newIssues, ongoingIssues, resolvedIssues, generatedAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {newIssues.length > 0
        ? `${newIssues.length} new issue(s) detected on ${siteName}`
        : `${siteName} health update`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{siteName} system health alert</Heading>
        <Text style={muted}>Checked {generatedAt}</Text>

        {newIssues.length > 0 && (
          <Section>
            <Heading style={h2}>New issues</Heading>
            {newIssues.map((i) => (
              <Section key={i.key} style={card}>
                <Text style={sev(i.severity)}>{i.severity.toUpperCase()}</Text>
                <Text style={itemTitle}>{i.title}</Text>
                {i.detail && <Text style={detailText}>{JSON.stringify(i.detail)}</Text>}
              </Section>
            ))}
          </Section>
        )}

        {ongoingIssues.length > 0 && (
          <Section>
            <Heading style={h2}>Still open</Heading>
            {ongoingIssues.map((i) => (
              <Text key={i.key} style={text}>• {i.title}</Text>
            ))}
          </Section>
        )}

        {resolvedIssues.length > 0 && (
          <Section>
            <Heading style={h2}>Resolved</Heading>
            {resolvedIssues.map((i) => (
              <Text key={i.key} style={text}>✓ {i.title}</Text>
            ))}
          </Section>
        )}

        <Text style={text}>
          <Link href={adminUrl} style={link}>Open the admin panel</Link>
        </Text>
        <Text style={footer}>Automated monitoring — you receive this because you are an admin.</Text>
      </Container>
    </Body>
  </Html>
)

export default AdminAlertEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: 'hsl(0, 0%, 10%)', margin: '0 0 6px' }
const h2 = { fontSize: '16px', fontWeight: '700' as const, color: 'hsl(0, 0%, 15%)', margin: '24px 0 8px' }
const text = { fontSize: '14px', color: 'hsl(0, 0%, 25%)', lineHeight: '1.6', margin: '0 0 8px' }
const muted = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '0 0 12px' }
const card = { border: '1px solid hsl(0, 0%, 90%)', borderRadius: '12px', padding: '14px 16px', margin: '0 0 10px' }
const itemTitle = { fontSize: '15px', fontWeight: '600' as const, color: 'hsl(0, 0%, 12%)', margin: '0 0 4px' }
const detailText = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '0', wordBreak: 'break-all' as const }
const critical = { fontSize: '11px', fontWeight: '700' as const, color: 'hsl(0, 72%, 45%)', margin: '0 0 4px', letterSpacing: '0.06em' }
const warning = { fontSize: '11px', fontWeight: '700' as const, color: 'hsl(35, 90%, 38%)', margin: '0 0 4px', letterSpacing: '0.06em' }
const link = { color: 'hsl(168, 100%, 36%)', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 45%)', margin: '28px 0 0' }

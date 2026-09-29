import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { BRAND, styles } from './_brand'

interface InviteEmailProps {
  siteName?: string
  siteUrl?: string
  confirmationUrl?: string
  orgName?: string
  inviterName?: string
}

function originFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export const InviteEmail = ({
  siteName = BRAND.siteName,
  siteUrl,
  confirmationUrl,
  orgName,
  inviterName,
}: InviteEmailProps) => {
  // Prefer an explicit siteUrl; otherwise fall back to the confirmation link's
  // origin so emails never link to placeholder/example.com domains.
  const resolvedSiteUrl = siteUrl ?? originFromUrl(confirmationUrl) ?? '#'
  const resolvedConfirmation = confirmationUrl ?? resolvedSiteUrl
  const workspaceLabel = orgName ?? siteName
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've been invited to join {workspaceLabel}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.brandRow}>
            <Link href={resolvedSiteUrl} style={styles.brandMark}>
              <span style={styles.brandDot} />
              {siteName}
            </Link>
          </Section>

          <Heading style={styles.h1}>You're invited</Heading>
          <Text style={styles.text}>
            {inviterName ? <strong>{inviterName}</strong> : 'A teammate'} has
            invited you to collaborate on{' '}
            <Link href={resolvedSiteUrl} style={styles.link}>
              <strong>{workspaceLabel}</strong>
            </Link>
            . Accept the invitation to create your account and join the
            workspace.
          </Text>
          <Button style={styles.button} href={resolvedConfirmation}>
            Accept invitation
          </Button>
          <Text style={styles.text}>
            Or paste this link into your browser:
            <br />
            <Link href={resolvedConfirmation} style={styles.link}>
              {resolvedConfirmation}
            </Link>
          </Text>

          <Section style={styles.footer}>
            <Text style={{ margin: 0 }}>
              <span style={styles.footerStrong}>{siteName}</span> · {BRAND.tagline}
            </Text>
            <Text style={{ margin: '8px 0 0' }}>
              Weren't expecting this? You can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default InviteEmail

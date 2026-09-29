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

interface MagicLinkEmailProps {
  siteName?: string
  confirmationUrl?: string
}

export const MagicLinkEmail = ({
  siteName = BRAND.siteName,
  confirmationUrl = BRAND.siteUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandRow}>
          <Link href={BRAND.siteUrl} style={styles.brandMark}>
            <span style={styles.brandDot} />
            {siteName}
          </Link>
        </Section>

        <Heading style={styles.h1}>Your sign-in link</Heading>
        <Text style={styles.text}>
          Click the button below to sign in to {siteName}. This link expires
          shortly and can only be used once.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Sign in
        </Button>
        <Text style={styles.text}>
          Or paste this link into your browser:
          <br />
          <Link href={confirmationUrl} style={styles.link}>
            {confirmationUrl}
          </Link>
        </Text>

        <Section style={styles.footer}>
          <Text style={{ margin: 0 }}>
            <span style={styles.footerStrong}>{siteName}</span> · {BRAND.tagline}
          </Text>
          <Text style={{ margin: '8px 0 0' }}>
            Didn't request this link? You can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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

interface RecoveryEmailProps {
  siteName?: string
  confirmationUrl?: string
}

export const RecoveryEmail = ({
  siteName = BRAND.siteName,
  confirmationUrl = BRAND.siteUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandRow}>
          <Link href={BRAND.siteUrl} style={styles.brandMark}>
            <span style={styles.brandDot} />
            {siteName}
          </Link>
        </Section>

        <Heading style={styles.h1}>Reset your password</Heading>
        <Text style={styles.text}>
          We received a request to reset your password for {siteName}. Choose
          a new password using the secure link below.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Reset password
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
            If you didn't request a password reset, you can safely ignore this
            email — your password will remain unchanged.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

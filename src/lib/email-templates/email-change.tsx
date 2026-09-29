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

interface EmailChangeEmailProps {
  siteName?: string
  oldEmail?: string
  email?: string
  newEmail?: string
  confirmationUrl?: string
}

export const EmailChangeEmail = ({
  siteName = BRAND.siteName,
  oldEmail,
  newEmail,
  confirmationUrl = BRAND.siteUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandRow}>
          <Link href={BRAND.siteUrl} style={styles.brandMark}>
            <span style={styles.brandDot} />
            {siteName}
          </Link>
        </Section>

        <Heading style={styles.h1}>Confirm your email change</Heading>
        <Text style={styles.text}>
          You requested to change the email address on your {siteName} account
          {oldEmail && newEmail ? (
            <>
              {' '}from{' '}
              <Link href={`mailto:${oldEmail}`} style={styles.link}>
                {oldEmail}
              </Link>{' '}
              to{' '}
              <Link href={`mailto:${newEmail}`} style={styles.link}>
                {newEmail}
              </Link>
            </>
          ) : null}
          .
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Confirm email change
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
            If you didn't request this change, please secure your account
            immediately by resetting your password.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

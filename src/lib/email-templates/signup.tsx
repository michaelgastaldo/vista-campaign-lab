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

interface SignupEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  confirmationUrl?: string
}

export const SignupEmail = ({
  siteName = BRAND.siteName,
  siteUrl = BRAND.siteUrl,
  recipient,
  confirmationUrl = BRAND.siteUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to start using {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandRow}>
          <Link href={siteUrl} style={styles.brandMark}>
            <span style={styles.brandDot} />
            {siteName}
          </Link>
        </Section>

        <Heading style={styles.h1}>Confirm your email</Heading>
        <Text style={styles.text}>
          Welcome to {siteName} — your marketing command center. Confirm{' '}
          {recipient ? (
            <Link href={`mailto:${recipient}`} style={styles.link}>
              {recipient}
            </Link>
          ) : (
            'your email address'
          )}{' '}
          to activate your workspace.
        </Text>
        <Button style={styles.button} href={confirmationUrl}>
          Verify email
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
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

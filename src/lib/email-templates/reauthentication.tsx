import * as React from 'react'
import {
  Body,
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

interface ReauthenticationEmailProps {
  token?: string
  siteName?: string
}

export const ReauthenticationEmail = ({
  token = '000000',
  siteName = BRAND.siteName,
}: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.brandRow}>
          <Link href={BRAND.siteUrl} style={styles.brandMark}>
            <span style={styles.brandDot} />
            {siteName}
          </Link>
        </Section>

        <Heading style={styles.h1}>Confirm it's you</Heading>
        <Text style={styles.text}>
          Use the code below to confirm your identity on {siteName}.
        </Text>
        <Section style={styles.codeCard}>
          <Text style={styles.code}>{token}</Text>
        </Section>

        <Section style={styles.footer}>
          <Text style={{ margin: 0 }}>
            <span style={styles.footerStrong}>{siteName}</span> · {BRAND.tagline}
          </Text>
          <Text style={{ margin: '8px 0 0' }}>
            This code expires shortly. If you didn't request it, you can
            safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

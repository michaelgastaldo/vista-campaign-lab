// Shared brand tokens for all transactional emails.
// Sourced from the central BRAND config in src/lib/brand.ts so a rebrand
// only touches one file. Sender domain remains here because email
// infrastructure ties to a verified domain, not the marketing brand.
// Email clients have inconsistent CSS support, so we use hex + inline styles.
// Body background MUST stay white — the app is dark indigo/pink, but
// email inboxes render legibly only against white. Accents are hex
// approximations of the app's oklch tokens in src/styles.css:
//   - indigo primary   ← oklch(0.72 0.2 275)
//   - deep indigo ink  ← oklch(0.14 0.03 275) (--primary-foreground)
//   - pink accent      ← oklch(0.78 0.18 340) (gradient stop)
// Headline font is Instrument Serif (the app's serif accent), with
// broadly-supported serif fallbacks for email clients that lack webfonts.

import { BRAND as APP_BRAND } from '@/lib/brand';

const SITE_URL =
  APP_BRAND.domain.startsWith('http://') || APP_BRAND.domain.startsWith('https://')
    ? APP_BRAND.domain
    : `https://${APP_BRAND.domain}`;

export const BRAND = {
  siteName: APP_BRAND.name,
  rootDomain: APP_BRAND.domain,
  siteUrl: SITE_URL,
  tagline: APP_BRAND.tagline,
  // Hex approximations of the app's oklch palette (see comment above).
  ink: '#14132b',         // deep indigo headline ink
  indigo: '#7a6bf5',      // primary CTA / accent (electric indigo)
  indigoDark: '#5b48d9',  // pressed / hover
  pink: '#f27ac2',        // secondary accent (gradient stop)
  textBody: '#3c3a55',
  textMuted: '#7a7893',
  hairline: '#e8e6f2',
  surfaceSoft: '#f5f3fb',
  white: '#ffffff',
} as const;

const SERIF_STACK =
  '"Instrument Serif", "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", Georgia, serif';
const SANS_STACK =
  '"Sora", "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export const styles = {
  main: {
    backgroundColor: BRAND.white,
    fontFamily: SANS_STACK,
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 24px 48px',
  },
  brandRow: {
    paddingBottom: '24px',
    borderBottom: `1px solid ${BRAND.hairline}`,
    marginBottom: '32px',
  },
  brandMark: {
    display: 'inline-block',
    fontFamily: SERIF_STACK,
    fontSize: '20px',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    color: BRAND.ink,
    textDecoration: 'none',
    margin: 0,
  },
  brandDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    backgroundColor: BRAND.indigo,
    marginRight: '8px',
    verticalAlign: 'middle',
  },
  h1: {
    fontFamily: SERIF_STACK,
    fontSize: '30px',
    lineHeight: '1.2',
    fontWeight: 500,
    color: BRAND.ink,
    letterSpacing: '-0.02em',
    margin: '0 0 20px',
  },
  text: {
    fontSize: '15px',
    color: BRAND.textBody,
    lineHeight: '1.65',
    margin: '0 0 20px',
  },
  link: {
    color: BRAND.indigoDark,
    textDecoration: 'underline',
    textDecorationColor: BRAND.indigo,
    textUnderlineOffset: '3px',
  },
  button: {
    display: 'inline-block',
    backgroundColor: BRAND.indigo,
    color: BRAND.white,
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '12px',
    padding: '14px 24px',
    textDecoration: 'none',
    letterSpacing: '-0.005em',
    margin: '8px 0 24px',
  },
  codeCard: {
    backgroundColor: BRAND.surfaceSoft,
    border: `1px solid ${BRAND.hairline}`,
    borderRadius: '12px',
    padding: '20px 24px',
    textAlign: 'center' as const,
    margin: '8px 0 24px',
  },
  code: {
    fontFamily: '"Geist Mono", "SF Mono", Menlo, Consolas, monospace',
    fontSize: '28px',
    fontWeight: 600,
    letterSpacing: '0.18em',
    color: BRAND.ink,
    margin: 0,
  },
  footer: {
    marginTop: '40px',
    paddingTop: '24px',
    borderTop: `1px solid ${BRAND.hairline}`,
    fontSize: '12px',
    lineHeight: '1.6',
    color: BRAND.textMuted,
  },
  footerStrong: {
    color: BRAND.ink,
    fontWeight: 500,
  },
};

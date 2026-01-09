/**
 * Affiliate Welcome Email Template
 *
 * Sent when a user registers as an affiliate.
 * Contains email verification link to activate account.
 *
 * @module lib/email/templates/affiliate/welcome
 */

import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface AffiliateWelcomeEmailProps {
  affiliateName: string;
  verificationLink: string;
}

export default function AffiliateWelcomeEmail({
  affiliateName,
  verificationLink,
}: AffiliateWelcomeEmailProps): React.ReactElement {
  const previewText = 'Welcome to the Trading Alerts Affiliate Program';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to the Affiliate Program!</Heading>

          <Section style={section}>
            <Text style={text}>Hi {affiliateName},</Text>
            <Text style={text}>
              Thank you for joining the Trading Alerts Affiliate Program!
              We&apos;re excited to have you on board.
            </Text>
            <Text style={text}>
              Please verify your email address to activate your affiliate
              account and start earning commissions.
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Link href={verificationLink} style={button}>
              Verify Email Address
            </Link>
          </Section>

          <Section style={section}>
            <Text style={text}>
              Once verified, you&apos;ll receive{' '}
              <strong>15 affiliate codes</strong> to share with potential
              customers.
            </Text>
            <Text style={text}>Here&apos;s how it works:</Text>
            <Text style={listItem}>
              • Customers get <strong>20% off</strong> their subscription
            </Text>
            <Text style={listItem}>
              • You earn <strong>20% commission</strong> on each sale
            </Text>
            <Text style={listItem}>
              • Receive new codes automatically each month
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Text style={footer}>
              If you didn&apos;t request this, you can safely ignore this email.
            </Text>
            <Text style={footer}>— The Trading Alerts Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const heading = {
  fontSize: '28px',
  fontWeight: 'bold',
  marginTop: '48px',
  textAlign: 'center' as const,
  color: '#1a1a1a',
};

const section = {
  padding: '0 48px',
};

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#333333',
};

const listItem = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#333333',
  marginLeft: '16px',
};

const buttonSection = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '22px',
  textAlign: 'center' as const,
};

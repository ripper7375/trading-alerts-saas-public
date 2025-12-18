/**
 * Code Distribution Email Template
 *
 * Sent when new affiliate codes are distributed to an affiliate.
 *
 * @module lib/email/templates/affiliate/code-distributed
 */

import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface CodeDistributedEmailProps {
  affiliateName: string;
  codesCount: number;
  reason: 'INITIAL' | 'MONTHLY' | 'ADMIN_BONUS';
  totalActiveCodes: number;
}

export default function CodeDistributedEmail({
  affiliateName,
  codesCount,
  reason,
  totalActiveCodes,
}: CodeDistributedEmailProps): React.ReactElement {
  const previewText = `${codesCount} new affiliate codes have been added to your account`;

  const reasonText = {
    INITIAL: 'Welcome to the program!',
    MONTHLY: 'Monthly code distribution',
    ADMIN_BONUS: 'Bonus codes from admin',
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>New Codes Distributed!</Heading>

          <Section style={section}>
            <Text style={text}>Hi {affiliateName},</Text>
            <Text style={text}>
              Great news! <strong>{codesCount} new affiliate codes</strong> have
              been added to your account.
            </Text>
          </Section>

          <Section style={statsSection}>
            <div style={statBox}>
              <Text style={statNumber}>{codesCount}</Text>
              <Text style={statLabel}>New Codes</Text>
            </div>
            <div style={statBox}>
              <Text style={statNumber}>{totalActiveCodes}</Text>
              <Text style={statLabel}>Total Active</Text>
            </div>
          </Section>

          <Section style={section}>
            <Text style={reasonBadge}>{reasonText[reason]}</Text>
            <Text style={text}>
              Your new codes are ready to share! Each code gives customers a 20%
              discount, and you earn 20% commission on every sale.
            </Text>
            <Text style={text}>
              Log in to your affiliate dashboard to view and copy your codes.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
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

const statsSection = {
  display: 'flex',
  justifyContent: 'center',
  gap: '24px',
  padding: '24px 48px',
};

const statBox = {
  textAlign: 'center' as const,
  padding: '16px 32px',
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
};

const statNumber = {
  fontSize: '32px',
  fontWeight: 'bold',
  color: '#5469d4',
  margin: '0',
};

const statLabel = {
  fontSize: '14px',
  color: '#8898aa',
  margin: '4px 0 0 0',
};

const reasonBadge = {
  display: 'inline-block',
  backgroundColor: '#e6f7e6',
  color: '#2d8a2d',
  padding: '4px 12px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 'bold',
  marginBottom: '16px',
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

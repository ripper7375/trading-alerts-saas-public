/**
 * Code Used Email Template
 *
 * Sent when an affiliate code is used by a customer.
 * Notifies the affiliate of the commission earned.
 *
 * @module lib/email/templates/affiliate/code-used
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

interface CodeUsedEmailProps {
  affiliateName: string;
  code: string;
  commissionAmount: number;
  totalEarnings: number;
  pendingBalance: number;
}

export default function CodeUsedEmail({
  affiliateName,
  code,
  commissionAmount,
  totalEarnings,
  pendingBalance,
}: CodeUsedEmailProps): React.ReactElement {
  const previewText = `Your affiliate code ${code} was used - $${commissionAmount.toFixed(2)} earned!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Commission Earned!</Heading>

          <Section style={celebrationSection}>
            <Text style={celebrationEmoji}>🎉</Text>
          </Section>

          <Section style={section}>
            <Text style={text}>Hi {affiliateName},</Text>
            <Text style={text}>
              Great news! Your affiliate code <strong>{code}</strong> was just
              used by a customer.
            </Text>
          </Section>

          <Section style={commissionBox}>
            <Text style={commissionLabel}>Commission Earned</Text>
            <Text style={commissionAmountStyle}>
              ${commissionAmount.toFixed(2)}
            </Text>
          </Section>

          <Section style={statsRow}>
            <div style={statItem}>
              <Text style={statValue}>${totalEarnings.toFixed(2)}</Text>
              <Text style={statLabel}>Total Earnings</Text>
            </div>
            <div style={statItem}>
              <Text style={statValue}>${pendingBalance.toFixed(2)}</Text>
              <Text style={statLabel}>Pending Balance</Text>
            </div>
          </Section>

          <Section style={section}>
            <Text style={text}>
              Thank you for promoting Trading Alerts! Keep sharing your codes to
              earn more commissions.
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

const celebrationSection = {
  textAlign: 'center' as const,
  padding: '16px',
};

const celebrationEmoji = {
  fontSize: '48px',
  margin: '0',
};

const section = {
  padding: '0 48px',
};

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#333333',
};

const commissionBox = {
  backgroundColor: '#e6f7e6',
  margin: '24px 48px',
  padding: '24px',
  borderRadius: '12px',
  textAlign: 'center' as const,
};

const commissionLabel = {
  fontSize: '14px',
  color: '#2d8a2d',
  margin: '0 0 8px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
};

const commissionAmountStyle = {
  fontSize: '42px',
  fontWeight: 'bold',
  color: '#2d8a2d',
  margin: '0',
};

const statsRow = {
  display: 'flex',
  justifyContent: 'center',
  gap: '48px',
  padding: '24px 48px',
};

const statItem = {
  textAlign: 'center' as const,
};

const statValue = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0',
};

const statLabel = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '4px 0 0 0',
  textTransform: 'uppercase' as const,
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

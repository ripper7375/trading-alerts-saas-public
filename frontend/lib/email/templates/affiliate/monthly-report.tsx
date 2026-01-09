/**
 * Monthly Performance Report Email Template
 *
 * Sent at the beginning of each month with affiliate performance summary.
 * Contains sales metrics, earnings, and code usage statistics.
 *
 * @module lib/email/templates/affiliate/monthly-report
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

interface MonthlyReportEmailProps {
  affiliateName: string;
  reportMonth: string;
  reportYear: number;
  totalSales: number;
  totalEarnings: number;
  currency: string;
  codesDistributed: number;
  codesUsed: number;
  conversionRate: number;
  pendingPayout: number;
  topPerformingCode?: string;
  dashboardLink: string;
}

export default function MonthlyReportEmail({
  affiliateName,
  reportMonth,
  reportYear,
  totalSales,
  totalEarnings,
  currency,
  codesDistributed,
  codesUsed,
  conversionRate,
  pendingPayout,
  topPerformingCode,
  dashboardLink,
}: MonthlyReportEmailProps): React.ReactElement {
  const previewText = `Your ${reportMonth} ${reportYear} affiliate performance report`;

  const formattedEarnings = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(totalEarnings);

  const formattedPendingPayout = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(pendingPayout);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Monthly Performance Report 📊</Heading>
          <Text style={periodText}>
            {reportMonth} {reportYear}
          </Text>

          <Section style={section}>
            <Text style={text}>Hi {affiliateName},</Text>
            <Text style={text}>
              Here&apos;s your affiliate performance summary for {reportMonth}{' '}
              {reportYear}.
            </Text>
          </Section>

          <Section style={metricsGrid}>
            <table style={metricsTable}>
              <tbody>
                <tr>
                  <td style={metricCard}>
                    <Text style={metricValue}>{totalSales}</Text>
                    <Text style={metricLabel}>Total Sales</Text>
                  </td>
                  <td style={metricCard}>
                    <Text style={metricValue}>{formattedEarnings}</Text>
                    <Text style={metricLabel}>Earnings</Text>
                  </td>
                </tr>
                <tr>
                  <td style={metricCard}>
                    <Text style={metricValue}>
                      {codesUsed}/{codesDistributed}
                    </Text>
                    <Text style={metricLabel}>Codes Used</Text>
                  </td>
                  <td style={metricCard}>
                    <Text style={metricValue}>
                      {conversionRate.toFixed(1)}%
                    </Text>
                    <Text style={metricLabel}>Conversion Rate</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {pendingPayout > 0 && (
            <Section style={payoutSection}>
              <Text style={payoutLabel}>Pending Payout</Text>
              <Text style={payoutAmount}>{formattedPendingPayout}</Text>
              <Text style={payoutNote}>
                Payouts are processed on the 15th of each month
              </Text>
            </Section>
          )}

          {topPerformingCode && (
            <Section style={section}>
              <Heading as="h2" style={subheading}>
                🏆 Top Performing Code
              </Heading>
              <Text style={codeDisplay}>{topPerformingCode}</Text>
              <Text style={text}>
                This code generated the most sales this month. Keep sharing it!
              </Text>
            </Section>
          )}

          <Section style={section}>
            <Heading as="h2" style={subheading}>
              Tips for Next Month
            </Heading>
            <Text style={tipItem}>
              📈 Share codes on social media for broader reach
            </Text>
            <Text style={tipItem}>🎯 Target active trading communities</Text>
            <Text style={tipItem}>
              💬 Engage with potential customers personally
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Link href={dashboardLink} style={button}>
              View Full Dashboard
            </Link>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Text style={footer}>
              Thank you for being part of our affiliate program!
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
  marginBottom: '0',
};

const periodText = {
  fontSize: '16px',
  color: '#666666',
  textAlign: 'center' as const,
  marginTop: '8px',
};

const subheading = {
  fontSize: '18px',
  fontWeight: 'bold',
  marginTop: '24px',
  marginBottom: '16px',
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

const metricsGrid = {
  padding: '0 48px',
  marginTop: '24px',
  marginBottom: '24px',
};

const metricsTable = {
  width: '100%',
  borderCollapse: 'separate' as const,
  borderSpacing: '12px',
};

const metricCard = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
  width: '50%',
};

const metricValue = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0',
};

const metricLabel = {
  fontSize: '12px',
  color: '#666666',
  margin: '4px 0 0 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const payoutSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '12px',
  margin: '24px 48px',
  padding: '20px',
  textAlign: 'center' as const,
};

const payoutLabel = {
  fontSize: '12px',
  color: '#1e40af',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const payoutAmount = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#1d4ed8',
  margin: '8px 0',
};

const payoutNote = {
  fontSize: '12px',
  color: '#1e40af',
  margin: '0',
};

const codeDisplay = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '12px 20px',
  fontSize: '18px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  color: '#5469d4',
  textAlign: 'center' as const,
  margin: '16px 0',
};

const tipItem = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#333333',
  marginLeft: '8px',
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

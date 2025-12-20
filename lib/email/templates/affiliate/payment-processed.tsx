/**
 * Payment Processed Email Template
 *
 * Sent when an affiliate's commission payment has been processed.
 * Contains payment details and transaction information.
 *
 * @module lib/email/templates/affiliate/payment-processed
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

interface PaymentProcessedEmailProps {
  affiliateName: string;
  paymentAmount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  commissionRate: number;
}

export default function PaymentProcessedEmail({
  affiliateName,
  paymentAmount,
  currency,
  paymentMethod,
  transactionId,
  periodStart,
  periodEnd,
  totalSales,
  commissionRate,
}: PaymentProcessedEmailProps): React.ReactElement {
  const previewText = `Payment of ${currency}${paymentAmount.toFixed(2)} has been processed`;

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(paymentAmount);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Payment Processed! 💰</Heading>

          <Section style={section}>
            <Text style={text}>Hi {affiliateName},</Text>
            <Text style={text}>
              Great news! Your affiliate commission payment has been processed
              successfully.
            </Text>
          </Section>

          <Section style={paymentCard}>
            <Text style={amountLabel}>Amount Paid</Text>
            <Text style={amountValue}>{formattedAmount}</Text>
            <Text style={paymentMethodText}>via {paymentMethod}</Text>
          </Section>

          <Section style={section}>
            <Heading as="h2" style={subheading}>
              Payment Details
            </Heading>
            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={detailLabel}>Transaction ID</td>
                  <td style={detailValue}>{transactionId}</td>
                </tr>
                <tr>
                  <td style={detailLabel}>Period</td>
                  <td style={detailValue}>
                    {periodStart} - {periodEnd}
                  </td>
                </tr>
                <tr>
                  <td style={detailLabel}>Total Sales</td>
                  <td style={detailValue}>{totalSales} subscriptions</td>
                </tr>
                <tr>
                  <td style={detailLabel}>Commission Rate</td>
                  <td style={detailValue}>{commissionRate}%</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={section}>
            <Text style={text}>
              Thank you for being a valued partner in our affiliate program.
              Keep sharing your codes to earn more commissions!
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Text style={footer}>
              If you have any questions about this payment, please contact our
              support team.
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

const subheading = {
  fontSize: '20px',
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

const paymentCard = {
  backgroundColor: '#f0fdf4',
  borderRadius: '12px',
  margin: '24px 48px',
  padding: '24px',
  textAlign: 'center' as const,
};

const amountLabel = {
  fontSize: '14px',
  color: '#166534',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const amountValue = {
  fontSize: '36px',
  fontWeight: 'bold',
  color: '#15803d',
  margin: '8px 0',
};

const paymentMethodText = {
  fontSize: '14px',
  color: '#166534',
  margin: '0',
};

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const detailLabel = {
  fontSize: '14px',
  color: '#666666',
  padding: '8px 0',
  borderBottom: '1px solid #e6ebf1',
};

const detailValue = {
  fontSize: '14px',
  color: '#333333',
  fontWeight: '500',
  padding: '8px 0',
  borderBottom: '1px solid #e6ebf1',
  textAlign: 'right' as const,
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

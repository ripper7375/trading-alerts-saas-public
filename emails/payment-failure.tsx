/**
 * Payment Failure Email Template
 *
 * Sent when payment fails:
 * - Notifies user of failure
 * - Shows reason if available
 * - Provides retry link
 *
 * @module emails/payment-failure
 */

import * as React from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentFailureEmailProps {
  userName: string;
  reason: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  retryUrl: string;
  supportEmail: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PaymentFailureEmail({
  userName,
  reason,
  amount,
  currency,
  paymentMethod,
  retryUrl,
  supportEmail,
}: PaymentFailureEmailProps): React.ReactElement {
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          borderBottom: '2px solid #dc2626',
        }}
      >
        <h1
          style={{
            color: '#dc2626',
            margin: '0',
            fontSize: '28px',
          }}
        >
          Payment Failed
        </h1>
      </div>

      {/* Main content */}
      <div style={{ padding: '30px 0' }}>
        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Hi {userName},
        </p>

        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Unfortunately, we couldn&apos;t process your payment. Don&apos;t worry
          - no charges have been made to your account.
        </p>

        {/* Error box */}
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '20px',
            borderRadius: '8px',
            margin: '20px 0',
          }}
        >
          <p
            style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              color: '#7f1d1d',
              fontWeight: 'bold',
            }}
          >
            Reason for failure:
          </p>
          <p
            style={{
              margin: '0',
              fontSize: '14px',
              color: '#991b1b',
            }}
          >
            {reason}
          </p>
        </div>

        {/* Payment details */}
        <div
          style={{
            background: '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            margin: '20px 0',
          }}
        >
          <h2
            style={{
              margin: '0 0 15px 0',
              fontSize: '16px',
              color: '#333',
            }}
          >
            Attempted Payment
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#666' }}>Amount:</td>
                <td style={{ padding: '8px 0', color: '#333' }}>
                  {currency} {amount}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#666' }}>
                  Payment Method:
                </td>
                <td style={{ padding: '8px 0', color: '#333' }}>
                  {paymentMethod}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Troubleshooting tips */}
        <div style={{ margin: '20px 0' }}>
          <h2
            style={{
              margin: '0 0 15px 0',
              fontSize: '18px',
              color: '#333',
            }}
          >
            What you can try:
          </h2>
          <ul style={{ paddingLeft: '20px', color: '#666' }}>
            <li style={{ marginBottom: '8px' }}>
              Check that you have sufficient funds
            </li>
            <li style={{ marginBottom: '8px' }}>
              Verify your payment details are correct
            </li>
            <li style={{ marginBottom: '8px' }}>
              Try a different payment method
            </li>
            <li style={{ marginBottom: '8px' }}>
              Contact your bank if the issue persists
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a
            href={retryUrl}
            style={{
              background: '#0070f3',
              color: 'white',
              padding: '14px 28px',
              textDecoration: 'none',
              borderRadius: '6px',
              display: 'inline-block',
              fontWeight: 'bold',
              fontSize: '16px',
            }}
          >
            Try Again
          </a>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: '#666',
            marginTop: '30px',
            textAlign: 'center',
          }}
        >
          Need help? Contact us at{' '}
          <a href={`mailto:${supportEmail}`} style={{ color: '#0070f3' }}>
            {supportEmail}
          </a>
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: '20px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#999',
        }}
      >
        <p style={{ margin: '5px 0' }}>
          Trading Alerts SaaS - Professional Trading Insights
        </p>
        <p style={{ margin: '5px 0' }}>
          This is an automated notification about your payment.
        </p>
      </div>
    </div>
  );
}

export default PaymentFailureEmail;

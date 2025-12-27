/**
 * Payment Confirmation Email Template
 *
 * Sent after successful dLocal payment:
 * - Confirms payment amount and method
 * - Shows subscription details
 * - Provides access information
 *
 * @module emails/payment-confirmation
 */

import * as React from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentConfirmationEmailProps {
  userName: string;
  amount: string;
  currency: string;
  usdAmount: string;
  planType: string;
  paymentMethod: string;
  expiresAt: string;
  dashboardUrl: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PaymentConfirmationEmail({
  userName,
  amount,
  currency,
  usdAmount,
  planType,
  paymentMethod,
  expiresAt,
  dashboardUrl,
}: PaymentConfirmationEmailProps): React.ReactElement {
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
          borderBottom: '2px solid #0070f3',
        }}
      >
        <h1
          style={{
            color: '#0070f3',
            margin: '0',
            fontSize: '28px',
          }}
        >
          Payment Confirmed!
        </h1>
      </div>

      {/* Main content */}
      <div style={{ padding: '30px 0' }}>
        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Hi {userName},
        </p>

        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Thank you for your purchase! Your payment has been successfully
          processed and your PRO subscription is now active.
        </p>

        {/* Payment details box */}
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
              fontSize: '18px',
              color: '#333',
            }}
          >
            Payment Details
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '8px 0',
                    color: '#666',
                    width: '40%',
                  }}
                >
                  Amount:
                </td>
                <td
                  style={{
                    padding: '8px 0',
                    color: '#333',
                    fontWeight: 'bold',
                  }}
                >
                  {currency} {amount} ({usdAmount} USD)
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#666' }}>Plan:</td>
                <td
                  style={{
                    padding: '8px 0',
                    color: '#333',
                    fontWeight: 'bold',
                  }}
                >
                  {planType}
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
              <tr>
                <td style={{ padding: '8px 0', color: '#666' }}>Expires:</td>
                <td style={{ padding: '8px 0', color: '#333' }}>{expiresAt}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PRO features */}
        <div style={{ margin: '20px 0' }}>
          <h2
            style={{
              margin: '0 0 15px 0',
              fontSize: '18px',
              color: '#333',
            }}
          >
            What&apos;s Included
          </h2>
          <ul style={{ paddingLeft: '20px', color: '#333' }}>
            <li style={{ marginBottom: '8px' }}>15 trading symbols</li>
            <li style={{ marginBottom: '8px' }}>9 timeframes (M5 to D1)</li>
            <li style={{ marginBottom: '8px' }}>20 active alerts</li>
            <li style={{ marginBottom: '8px' }}>50 watchlist items</li>
            <li style={{ marginBottom: '8px' }}>Priority support</li>
          </ul>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a
            href={dashboardUrl}
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
            Go to Dashboard
          </a>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: '#666',
            marginTop: '30px',
          }}
        >
          If you have any questions, reply to this email and we&apos;ll be happy
          to help.
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
          This is an automated email. Please do not reply directly.
        </p>
      </div>
    </div>
  );
}

export default PaymentConfirmationEmail;

/**
 * Renewal Reminder Email Template
 *
 * Sent 3 days before subscription expires:
 * - Reminds user of upcoming expiration
 * - Shows remaining days
 * - Provides renewal link
 *
 * @module emails/renewal-reminder
 */

import * as React from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RenewalReminderEmailProps {
  userName: string;
  expiresAt: string;
  daysRemaining: number;
  renewUrl: string;
  currentPlan: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function RenewalReminderEmail({
  userName,
  expiresAt,
  daysRemaining,
  renewUrl,
  currentPlan,
}: RenewalReminderEmailProps): React.ReactElement {
  const urgencyColor =
    daysRemaining <= 1 ? '#dc2626' : daysRemaining <= 3 ? '#ea580c' : '#f59e0b';

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
          borderBottom: `2px solid ${urgencyColor}`,
        }}
      >
        <h1
          style={{
            color: urgencyColor,
            margin: '0',
            fontSize: '28px',
          }}
        >
          Subscription Expiring Soon
        </h1>
      </div>

      {/* Main content */}
      <div style={{ padding: '30px 0' }}>
        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Hi {userName},
        </p>

        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Your <strong>{currentPlan}</strong> subscription will expire in{' '}
          <strong style={{ color: urgencyColor }}>
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
          </strong>{' '}
          on {expiresAt}.
        </p>

        {/* Urgency box */}
        <div
          style={{
            background: `${urgencyColor}10`,
            border: `1px solid ${urgencyColor}30`,
            padding: '20px',
            borderRadius: '8px',
            margin: '20px 0',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 10px 0',
              fontSize: '18px',
              color: '#333',
            }}
          >
            Don&apos;t lose access to your PRO features!
          </p>
          <p
            style={{
              margin: '0',
              fontSize: '14px',
              color: '#666',
            }}
          >
            Renew now to continue enjoying unlimited access
          </p>
        </div>

        {/* What you'll lose */}
        <div style={{ margin: '20px 0' }}>
          <h2
            style={{
              margin: '0 0 15px 0',
              fontSize: '18px',
              color: '#333',
            }}
          >
            What happens if you don&apos;t renew:
          </h2>
          <ul style={{ paddingLeft: '20px', color: '#666' }}>
            <li style={{ marginBottom: '8px' }}>
              Downgrade from 15 to 5 symbols
            </li>
            <li style={{ marginBottom: '8px' }}>
              Timeframes limited to H1, H4, D1
            </li>
            <li style={{ marginBottom: '8px' }}>Alerts reduced to 5</li>
            <li style={{ marginBottom: '8px' }}>
              Watchlist limited to 5 items
            </li>
            <li style={{ marginBottom: '8px' }}>No priority support</li>
          </ul>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a
            href={renewUrl}
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
            Renew Now
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
          Questions? Reply to this email and we&apos;ll help you out.
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
          You&apos;re receiving this because your subscription is expiring.
        </p>
      </div>
    </div>
  );
}

export default RenewalReminderEmail;

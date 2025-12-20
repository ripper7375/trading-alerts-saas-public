/**
 * Subscription Expired Email Template
 *
 * Sent when subscription expires:
 * - Notifies user of expiration
 * - Informs about downgrade to FREE tier
 * - Provides resubscription link
 *
 * @module emails/subscription-expired
 */

import * as React from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SubscriptionExpiredEmailProps {
  userName: string;
  expiredAt: string;
  previousPlan: string;
  subscribeUrl: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function SubscriptionExpiredEmail({
  userName,
  expiredAt,
  previousPlan,
  subscribeUrl,
}: SubscriptionExpiredEmailProps): React.ReactElement {
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
          Subscription Expired
        </h1>
      </div>

      {/* Main content */}
      <div style={{ padding: '30px 0' }}>
        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Hi {userName},
        </p>

        <p style={{ fontSize: '16px', color: '#333', marginBottom: '20px' }}>
          Your <strong>{previousPlan}</strong> subscription expired on{' '}
          <strong>{expiredAt}</strong>.
        </p>

        {/* Status box */}
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
              fontSize: '16px',
              color: '#991b1b',
              fontWeight: 'bold',
            }}
          >
            Your account has been downgraded to FREE
          </p>
          <p
            style={{
              margin: '0',
              fontSize: '14px',
              color: '#7f1d1d',
            }}
          >
            Some features are now limited until you resubscribe.
          </p>
        </div>

        {/* Current limitations */}
        <div style={{ margin: '20px 0' }}>
          <h2
            style={{
              margin: '0 0 15px 0',
              fontSize: '18px',
              color: '#333',
            }}
          >
            Your current limits (FREE tier):
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    color: '#666',
                  }}
                >
                  Symbols
                </td>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    textAlign: 'right',
                    color: '#dc2626',
                  }}
                >
                  5 (was 15)
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    color: '#666',
                  }}
                >
                  Timeframes
                </td>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    textAlign: 'right',
                    color: '#dc2626',
                  }}
                >
                  3 (was 9)
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    color: '#666',
                  }}
                >
                  Active Alerts
                </td>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    textAlign: 'right',
                    color: '#dc2626',
                  }}
                >
                  5 (was 20)
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    color: '#666',
                  }}
                >
                  Watchlist Items
                </td>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    textAlign: 'right',
                    color: '#dc2626',
                  }}
                >
                  5 (was 50)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a
            href={subscribeUrl}
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
            Resubscribe to PRO
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
          Your alerts and watchlist data have been preserved. Resubscribe to
          regain full access.
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
          You&apos;re receiving this because your subscription has expired.
        </p>
      </div>
    </div>
  );
}

export default SubscriptionExpiredEmail;

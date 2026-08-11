import type { Metadata } from 'next';
import { Lock, Database, Share2, UserCheck, Cookie, Mail } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Public Privacy Policy Page
 *
 * Session 6-10 (F63): production-grade template copy, Davin-approved. Distinct
 * from the auth-gated /settings/privacy page, which is a *privacy settings*
 * control panel (profile visibility, data export toggle) rather than this
 * legal Privacy Policy document — the two intentionally don't overlap.
 *
 * @module app/(marketing)/privacy/page
 */

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Trading Alerts collects, uses, and protects your personal data.',
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center gap-3">
          <Lock className="h-8 w-8 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: December 2024
            </p>
          </div>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              This Privacy Policy describes how Trading Alerts (&quot;we&quot;,
              &quot;us&quot;) collects, uses, and shares information when you
              use our website and services (the &quot;Service&quot;). By using
              the Service, you agree to the collection and use of information in
              accordance with this policy.
            </p>
          </CardContent>
        </Card>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            1. Information We Collect
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong className="text-foreground">Account information:</strong>{' '}
              name, email address, and password (stored as a salted hash, we
              never see or store your plaintext password) when you register.
            </p>
            <p>
              <strong className="text-foreground">Payment information:</strong>{' '}
              subscription and payment details are processed by our third-party
              payment providers (Stripe, dLocal). We never receive or store your
              full card or bank account number.
            </p>
            <p>
              <strong className="text-foreground">Usage data:</strong> alerts
              you configure, chart symbols and timeframes you view, login
              history, device/browser type, and IP address (used during
              registration for approximate regional pricing and fraud/security
              checks).
            </p>
            <p>
              <strong className="text-foreground">Communications:</strong>{' '}
              messages you send us via the contact/support form or email.
            </p>
          </div>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            2. How We Use Your Information
          </h2>
          <ul className="ml-4 list-disc space-y-2 text-muted-foreground">
            <li>To provide, operate, and maintain the Service</li>
            <li>To process subscription payments and send billing receipts</li>
            <li>To deliver the price alerts and notifications you configure</li>
            <li>
              To detect, investigate, and prevent fraudulent transactions and
              other unauthorized activity
            </li>
            <li>To respond to your support requests</li>
            <li>
              To send service-related communications (e.g. subscription status,
              security alerts) — we do not send marketing email without your
              consent
            </li>
          </ul>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Share2 className="h-5 w-5 text-primary" aria-hidden="true" />
            3. How We Share Your Information
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              We do not sell your personal information. We share data only with:
            </p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Payment processors</strong>{' '}
                (Stripe, dLocal) — to process your subscription payment
              </li>
              <li>
                <strong className="text-foreground">
                  Infrastructure providers
                </strong>{' '}
                (hosting, database, email delivery) — solely to operate the
                Service
              </li>
              <li>
                <strong className="text-foreground">Affiliate partners</strong>{' '}
                — only an anonymized referral code and commission amount, if you
                signed up through an affiliate link
              </li>
              <li>
                <strong className="text-foreground">Law enforcement</strong> —
                when required by law, subpoena, or to protect the rights and
                safety of our users
              </li>
            </ul>
          </div>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <UserCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            4. Your Rights
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Depending on your jurisdiction (including under the GDPR for users
              in the EU/EEA and the UK), you have the right to:
            </p>
            <ul className="ml-4 list-disc space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>
                Export your data in a portable format (Settings &gt; Privacy
                &gt; Export Data)
              </li>
              <li>
                Request deletion of your account and associated data (Settings
                &gt; Account &gt; Delete Account — a 7-day confirmation window
                applies before deletion is final)
              </li>
              <li>Object to or restrict certain processing of your data</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a
                href="mailto:privacy@tradingalerts.com"
                className="hover:text-primary/80 text-primary underline"
              >
                privacy@tradingalerts.com
              </a>
              .
            </p>
          </div>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
            5. Cookies &amp; Session Data
          </h2>
          <p className="text-muted-foreground">
            We use essential cookies to keep you signed in and remember your
            preferences (such as light/dark theme). We do not use third-party
            advertising or cross-site tracking cookies.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            6. Data Retention &amp; Security
          </h2>
          <p className="text-muted-foreground">
            We retain your account data for as long as your account is active,
            or as needed to comply with legal obligations, resolve disputes, and
            enforce our agreements. We use industry-standard technical and
            organizational measures — encryption in transit, hashed credentials,
            and access controls — to protect your data. No method of
            transmission or storage is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            7. Children&apos;s Privacy
          </h2>
          <p className="text-muted-foreground">
            The Service is not directed to individuals under 18. We do not
            knowingly collect personal information from children. If you believe
            a child has provided us with personal data, please contact us and we
            will delete it.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            8. Changes to This Policy
          </h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by posting the new policy on this page and
            updating the &quot;Last updated&quot; date above.
          </p>
        </section>

        <Separator className="my-6" />

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            9. Contact Us
          </h2>
          <p className="text-muted-foreground">
            Questions about this Privacy Policy? Contact us at{' '}
            <a
              href="mailto:privacy@tradingalerts.com"
              className="hover:text-primary/80 text-primary underline"
            >
              privacy@tradingalerts.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

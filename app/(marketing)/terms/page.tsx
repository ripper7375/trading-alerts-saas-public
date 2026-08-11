import type { Metadata } from 'next';
import { FileText, Scale, Shield, AlertTriangle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Public Terms of Service Page
 *
 * Session 6-10 (F63): adapted from the existing, Davin-reviewed content at
 * app/(dashboard)/settings/terms/page.tsx (auth-gated) into a public page a
 * signed-out visitor and the registration consent checkbox can both reach.
 * Content kept substantively the same; two sections (Intellectual Property,
 * Termination, Governing Law) added to round out a standalone public
 * document, and the short inline Financial Disclaimer section now links out
 * to the dedicated /disclaimer page instead of duplicating it in full.
 *
 * @module app/(marketing)/terms/page
 */

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The Terms of Service governing your use of Trading Alerts.',
};

export default function TermsPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Terms of Service
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: December 2024
            </p>
          </div>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              By using Trading Alerts, you agree to these terms. Please read
              them carefully before using our services.
            </p>
          </CardContent>
        </Card>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Scale className="h-5 w-5 text-primary" aria-hidden="true" />
            1. Acceptance of Terms
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              By accessing or using Trading Alerts (&quot;the Service&quot;),
              you agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you disagree with any part of the terms,
              you may not access the Service.
            </p>
            <p>
              We reserve the right to update these Terms at any time. Continued
              use of the Service after changes constitutes acceptance of the new
              Terms.
            </p>
          </div>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p className="mb-4 text-muted-foreground">Trading Alerts provides:</p>
          <ul className="ml-4 list-disc space-y-2 text-muted-foreground">
            <li>Real-time price charts with fractal analysis</li>
            <li>Custom price alert notifications</li>
            <li>Multi-timeframe visualization and drawing tools (PRO)</li>
            <li>API access for programmatic trading signals</li>
          </ul>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            3. User Accounts
          </h2>
          <p className="mb-4 text-muted-foreground">
            When you create an account with us, you must provide accurate and
            complete information. You are responsible for:
          </p>
          <ul className="ml-4 list-disc space-y-2 text-muted-foreground">
            <li>Maintaining the security of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized access</li>
            <li>Ensuring your contact information remains current</li>
          </ul>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            4. Subscription Tiers and Billing
          </h2>
          <p className="mb-4 text-muted-foreground">
            We offer FREE and PRO subscription tiers:
          </p>
          <ul className="ml-4 list-disc space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">FREE Tier:</strong> Limited
              symbols, timeframes, and alerts
            </li>
            <li>
              <strong className="text-foreground">PRO Tier:</strong> Extended
              access to symbols, timeframes, alerts, and API
            </li>
          </ul>
          <p className="mt-4 text-muted-foreground">
            PRO subscriptions are billed monthly. You may cancel at any time,
            and your subscription will remain active until the end of the
            billing period.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertTriangle
              className="h-5 w-5 text-amber-500"
              aria-hidden="true"
            />
            5. Financial Disclaimer
          </h2>
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
                Important Notice:
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Trading Alerts provides informational tools only and does NOT
                constitute financial advice. Trading in financial markets
                involves substantial risk of loss. See our full{' '}
                <a
                  href="/disclaimer"
                  className="underline hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Financial Risk Disclaimer
                </a>{' '}
                for details.
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            6. Intellectual Property
          </h2>
          <p className="text-muted-foreground">
            The Service and its original content, features, and functionality
            are owned by Trading Alerts and are protected by international
            copyright, trademark, and other intellectual property laws. You may
            not copy, modify, distribute, or reverse engineer any part of the
            Service without our prior written consent.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            7. Limitation of Liability
          </h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by law, Trading Alerts shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, including but not limited to, loss of profits,
            data, or other intangible losses resulting from your use of the
            Service.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            8. Termination
          </h2>
          <p className="text-muted-foreground">
            We may suspend or terminate your access to the Service at any time,
            with or without cause, with or without notice. You may cancel your
            account at any time from Settings &gt; Account. All provisions of
            these Terms which by their nature should survive termination shall
            survive, including ownership provisions, warranty disclaimers, and
            limitations of liability.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            9. Governing Law
          </h2>
          <p className="text-muted-foreground">
            These Terms shall be governed by and construed in accordance with
            applicable law, without regard to its conflict of law provisions.
            Any disputes arising from these Terms or the Service will be
            resolved through good-faith negotiation in the first instance.
          </p>
        </section>

        <Separator className="my-6" />

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            10. Contact Information
          </h2>
          <p className="text-muted-foreground">
            If you have any questions about these Terms, please contact us at:{' '}
            <a
              href="mailto:legal@tradingalerts.com"
              className="hover:text-primary/80 text-primary underline"
            >
              legal@tradingalerts.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

import { FileText, Scale, Shield, AlertTriangle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Terms of Service Page
 *
 * Displays the terms of service for the Trading Alerts platform.
 * Static content page within the settings section.
 */
export default function TermsPage(): React.ReactElement {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Terms of Service
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: December 2024
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-gray-600 dark:text-gray-400">
            By using Trading Alerts, you agree to these terms. Please read them
            carefully before using our services.
          </p>
        </CardContent>
      </Card>

      {/* Section 1: Acceptance of Terms */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-600" />
          1. Acceptance of Terms
        </h3>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            By accessing or using Trading Alerts (&quot;the Service&quot;), you
            agree to be bound by these Terms of Service (&quot;Terms&quot;). If
            you disagree with any part of the terms, you may not access the
            Service.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            We reserve the right to update these Terms at any time. Continued
            use of the Service after changes constitutes acceptance of the new
            Terms.
          </p>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Section 2: Description of Service */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          2. Description of Service
        </h3>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Trading Alerts provides:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 ml-4">
            <li>Real-time price charts with fractal analysis</li>
            <li>Custom price alert notifications</li>
            <li>Watchlist management for trading symbols</li>
            <li>API access for programmatic trading signals</li>
          </ul>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Section 3: User Accounts */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          3. User Accounts
        </h3>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            When you create an account with us, you must provide accurate and
            complete information. You are responsible for:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 ml-4">
            <li>Maintaining the security of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized access</li>
            <li>Ensuring your contact information remains current</li>
          </ul>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Section 4: Subscription Tiers */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          4. Subscription Tiers and Billing
        </h3>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            We offer FREE and PRO subscription tiers:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 ml-4">
            <li>
              <strong>FREE Tier:</strong> Limited symbols, timeframes, and
              alerts
            </li>
            <li>
              <strong>PRO Tier:</strong> Extended access to symbols, timeframes,
              alerts, and API
            </li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400 mt-4">
            PRO subscriptions are billed monthly. You may cancel at any time,
            and your subscription will remain active until the end of the
            billing period.
          </p>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Section 5: Disclaimer */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          5. Financial Disclaimer
        </h3>
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">
              Important Notice:
            </p>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              Trading Alerts provides informational tools only and does NOT
              constitute financial advice. Past performance is not indicative of
              future results. Trading in financial markets involves substantial
              risk of loss. You should only trade with money you can afford to
              lose. Always consult with a qualified financial advisor before
              making investment decisions.
            </p>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-6" />

      {/* Section 6: Limitation of Liability */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          6. Limitation of Liability
        </h3>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400">
            To the maximum extent permitted by law, Trading Alerts shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, including but not limited to, loss of profits,
            data, or other intangible losses resulting from your use of the
            Service.
          </p>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Section 7: Contact */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          7. Contact Information
        </h3>
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400">
            If you have any questions about these Terms, please contact us at:{' '}
            <a
              href="mailto:legal@tradingalerts.com"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              legal@tradingalerts.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

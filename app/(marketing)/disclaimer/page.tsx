import type { Metadata } from 'next';
import { AlertTriangle, TrendingDown, Scale, Shield } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Public Financial Risk Disclaimer Page
 *
 * Session 6-10 (F63): production-grade template copy, Davin-approved. This
 * is the compliance-relevant disclaimer DECISION-LOG.md F63 flagged as
 * needing real (not Executor-drafted-without-review) copy for a trading
 * alerts product — expands on the short inline disclaimer already embedded
 * in the Terms of Service (Section 5) into its own dedicated page.
 *
 * @module app/(marketing)/disclaimer/page
 */

export const metadata: Metadata = {
  title: 'Financial Risk Disclaimer',
  description:
    'Important risk disclosures for Trading Alerts, an informational trading-signals tool.',
};

export default function DisclaimerPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center gap-3">
          <AlertTriangle
            className="h-8 w-8 text-amber-500"
            aria-hidden="true"
          />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Financial Risk Disclaimer
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: December 2024
            </p>
          </div>
        </div>

        <Card className="mb-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="p-6">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Please read this disclaimer carefully before using Trading Alerts.
              Trading financial instruments involves substantial risk of loss
              and is not suitable for every investor.
            </p>
          </CardContent>
        </Card>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <TrendingDown
              className="h-5 w-5 text-amber-500"
              aria-hidden="true"
            />
            1. No Financial Advice
          </h2>
          <p className="text-muted-foreground">
            Trading Alerts is an informational and analytical tool. Nothing
            provided through the Service — price alerts, chart drawings, fractal
            analysis, or any other feature — constitutes financial, investment,
            tax, or legal advice, nor a recommendation or solicitation to buy or
            sell any financial instrument. We are not a registered investment
            advisor, broker-dealer, or financial institution. Any decision to
            buy, sell, or hold a position is made solely at your own discretion
            and risk.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            2. Risk of Loss
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Trading in gold (XAUUSD), forex, and other financial instruments
              carries a high level of risk and may not be suitable for all
              investors. Before deciding to trade, you should carefully consider
              your investment objectives, level of experience, and risk
              appetite.
            </p>
            <p>
              You could sustain a loss of some or all of your initial
              investment; you should not invest money that you cannot afford to
              lose. You should be aware of all the risks associated with trading
              and seek advice from an independent financial advisor if you have
              any doubts.
            </p>
          </div>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            3. Past Performance Is Not Indicative of Future Results
          </h2>
          <p className="text-muted-foreground">
            Any historical performance, backtesting results, or example alert
            outcomes referenced on this site or within the Service are provided
            for illustrative purposes only. Past performance, whether actual or
            hypothetical, is not a reliable indicator of future results.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            4. Data Accuracy &amp; System Availability
          </h2>
          <p className="text-muted-foreground">
            We source market data from third-party providers and make reasonable
            efforts to keep price data, alerts, and chart information timely and
            accurate, but we do not guarantee its completeness, accuracy, or
            availability. Notifications may be delayed or fail to arrive due to
            factors outside our control (network conditions, third-party
            notification providers, device settings). Do not rely on Trading
            Alerts as your sole source of market information for time-sensitive
            trading decisions.
          </p>
        </section>

        <Separator className="my-6" />

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Scale className="h-5 w-5 text-primary" aria-hidden="true" />
            5. No Guarantee of Results
          </h2>
          <p className="text-muted-foreground">
            We make no representation or warranty, express or implied, that any
            alert, indicator, or drawing produced by the Service will be
            profitable or will not result in losses. Any testimonials, examples,
            or case studies presented represent exceptional results and are not
            intended to represent or guarantee that anyone will achieve the same
            or similar results.
          </p>
        </section>

        <Separator className="my-6" />

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            6. Acknowledgment
          </h2>
          <p className="text-muted-foreground">
            By using Trading Alerts, you acknowledge that you have read and
            understood this disclaimer and that you are solely responsible for
            your own trading decisions. This disclaimer should be read alongside
            our{' '}
            <a
              href="/terms"
              className="hover:text-primary/80 text-primary underline"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              className="hover:text-primary/80 text-primary underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

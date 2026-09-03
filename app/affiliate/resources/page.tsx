/**
 * Public Affiliate Marketing Resources Page
 *
 * Overview of promotional assets, guidelines, and benefits for prospective
 * and active affiliates. Seamlessly links to /affiliate/dashboard/resources for
 * authenticated partners.
 *
 * @module app/affiliate/resources/page
 */

import React from 'react';
import Link from 'next/link';
import {
  Share2,
  Download,
  BookOpen,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export default async function PublicAffiliateResourcesPage(): Promise<React.ReactElement> {
  const dict = getDictionary(await getServerLanguage());
  const dt = (key: string, fallback: string): string => dict[key] ?? fallback;

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      {/* Header */}
      <div className="space-y-4 text-center">
        <div className="bg-primary/10 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
          <Share2 className="h-4 w-4" />{' '}
          {dt(
            'affiliate.resources.partner_marketing_toolkit',
            'Partner Marketing Toolkit'
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {dt(
            'affiliate.resources.public_title',
            'Affiliate Marketing Resources'
          )}
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
          {dt(
            'affiliate.resources.public_subtitle',
            'High-converting banners, copy templates, promotional guidelines, and link generators to help you maximize your affiliate earnings.'
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button asChild size="lg">
            <Link
              href="/affiliate/dashboard/resources"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {dt(
                'affiliate.resources.access_partner_asset_center',
                'Access Partner Asset Center'
              )}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/affiliate/join">
              {dt(
                'affiliate.resources.join_affiliate_program',
                'Join Affiliate Program'
              )}
            </Link>
          </Button>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Share2 className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">
              {dt(
                'affiliate.resources.custom_referral_links',
                'Custom Referral Links'
              )}
            </CardTitle>
            <CardDescription>
              {dt(
                'affiliate.resources.custom_referral_links_desc',
                'Generate tracked UTM campaign links with automatic 30-day attribution cookies.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dt(
              'affiliate.resources.custom_referral_links_body',
              'Easily tag channels (YouTube, Telegram, Twitter, Blog) to measure exact conversion rates per link.'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">
              {dt(
                'affiliate.resources.promo_discount_codes',
                '20% Promo Discount Codes'
              )}
            </CardTitle>
            <CardDescription>
              {dt(
                'affiliate.resources.promo_discount_codes_desc',
                'Distribute exclusive monthly discount codes offering 20% off PRO subscriptions.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dt(
              'affiliate.resources.promo_discount_codes_body',
              'Provide tangible value to your trading audience while earning 20% recurring net commissions.'
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">
              {dt(
                'affiliate.resources.copy_brand_guidelines',
                'Copy & Brand Guidelines'
              )}
            </CardTitle>
            <CardDescription>
              {dt(
                'affiliate.resources.copy_brand_guidelines_desc',
                'Proven ad copy snippets, product screenshots, and compliance guidelines.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {dt(
              'affiliate.resources.copy_brand_guidelines_body',
              'Ready-to-use message templates tailored for trading communities and social media posts.'
            )}
          </CardContent>
        </Card>
      </div>

      {/* Program Highlights */}
      <div className="bg-muted/40 space-y-6 rounded-2xl border p-8">
        <h2 className="text-center text-2xl font-bold text-foreground sm:text-left">
          {dt(
            'affiliate.resources.why_partner',
            'Why Partner with Trading Alerts SaaS?'
          )}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {dt(
                  'affiliate.resources.highlight_timely_payouts',
                  'Timely Payouts:'
                )}
              </strong>{' '}
              {dt(
                'affiliate.resources.highlight_timely_payouts_desc',
                'Automated disbursements via Wise directly into your local bank account.'
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {dt(
                  'affiliate.resources.highlight_realtime_analytics',
                  'Real-time Analytics:'
                )}
              </strong>{' '}
              {dt(
                'affiliate.resources.highlight_realtime_analytics_desc',
                'Instant tracking of clicks, promo code redemptions, and commissions.'
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {dt(
                  'affiliate.resources.highlight_partner_support',
                  'Dedicated Partner Support:'
                )}
              </strong>{' '}
              {dt(
                'affiliate.resources.highlight_partner_support_desc',
                'Direct contact and marketing assistance for top affiliates.'
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {dt(
                  'affiliate.resources.highlight_antifraud',
                  'Anti-Fraud Protection:'
                )}
              </strong>{' '}
              {dt(
                'affiliate.resources.highlight_antifraud_desc',
                'Transparent attribution with zero hidden deductions.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

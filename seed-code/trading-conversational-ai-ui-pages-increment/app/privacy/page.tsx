'use client';

import React from 'react';
import { Shield, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function PrivacyPage() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="space-y-3">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
              {t('Privacy & Data Governance')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl dark:text-slate-100">
              {t('DavinTrade AI Privacy Policy')}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('Effective Date: August 16, 2026')}
            </p>
          </div>

          <Card className="border-slate-200 bg-white shadow-md dark:border-slate-800/80 dark:bg-[#090b14]/80 dark:backdrop-blur-xl">
            <CardContent className="flex items-start gap-4 p-6">
              <Lock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                  {t('Our Commitment to Your Privacy')}
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(
                    'DavinTrade AI adheres to strict data privacy principles under GDPR, CCPA, and global cybersecurity frameworks. We do not sell personal data, we do not store plaintext passwords, and all analytics telemetry is fully encrypted at rest and in transit.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-700 dark:border-slate-800/80 dark:text-slate-300">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                1. {t('Information We Collect')}
              </h2>
              <p>
                {t(
                  'We collect information you provide directly (such as name, email address, password hashes, and billing details processed securely via dLocal/Stripe), as well as technical usage data (IP address, browser type, device identifiers, session timestamps, and workspace interaction events).'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                2. {t('How We Use Your Data')}
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600 md:text-sm dark:text-slate-400">
                <li>
                  {t(
                    'To provision and maintain your real-time trading workspaces and alert deliveries.'
                  )}
                </li>
                <li>
                  {t(
                    'To process subscription billing, recurring receipts, and affiliate commissions.'
                  )}
                </li>
                <li>
                  {t(
                    'To detect and prevent platform abuse, account takeovers, and fraudulent transactions.'
                  )}
                </li>
                <li>
                  {t(
                    'To train and improve Davin AI conversational comprehension without logging private trading credentials.'
                  )}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                3. {t('Your Rights and Data Control')}
              </h2>
              <p>
                {t(
                  'You have the full right to export your data, modify your preferences, revoke active login sessions via /settings/security/activity, or initiate permanent account deletion at /settings/account.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                4. {t('How We Share Your Information')}
              </h2>
              <p>
                {t(
                  'We do not sell your personal information. We share data only with:'
                )}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600 md:text-sm dark:text-slate-400">
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">
                    {t('Payment processors')}
                  </strong>{' '}
                  {t(
                    '(dLocal, Stripe) — to process your subscription payment.'
                  )}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">
                    {t('Infrastructure providers')}
                  </strong>{' '}
                  {t(
                    '(hosting, database, email delivery) — solely to operate the platform.'
                  )}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">
                    {t('Affiliate partners')}
                  </strong>{' '}
                  {t(
                    '— only an anonymized referral code and commission amount, if you signed up through an affiliate link.'
                  )}
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">
                    {t('Law enforcement')}
                  </strong>{' '}
                  {t(
                    '— when required by law, subpoena, or to protect the rights and safety of our users.'
                  )}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                5. {t('Cookies & Session Data')}
              </h2>
              <p>
                {t(
                  'We use essential cookies to keep you signed in and remember your preferences, such as theme accent and appearance settings. We do not use third-party advertising or cross-site tracking cookies.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                6. {t('Data Retention & Security')}
              </h2>
              <p>
                {t(
                  'We retain your account data for as long as your account is active, or as needed to comply with legal obligations, resolve disputes, and enforce our agreements. We use industry-standard technical and organizational measures — encryption in transit and at rest, hashed credentials, and access controls — to protect your data. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                7. {t("Children's Privacy")}
              </h2>
              <p>
                {t(
                  'DavinTrade AI is not directed to individuals under 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will delete it.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                8. {t('Changes to This Policy')}
              </h2>
              <p>
                {t(
                  'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Effective Date" above.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                9. {t('Contact Us')}
              </h2>
              <p>
                {t('Questions about this Privacy Policy? Contact us at')}{' '}
                <a
                  href="mailto:privacy@davintrade.com"
                  className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  privacy@davintrade.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

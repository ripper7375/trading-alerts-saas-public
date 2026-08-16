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
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="space-y-3">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t(
                'Privacy & Data Governance',
                'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูล'
              )}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
              {t(
                'DavinTrade AI Privacy Policy',
                'นโยบายความเป็นส่วนตัว DavinTrade AI'
              )}
            </h1>
            <p className="text-sm text-slate-400">
              {t(
                'Effective Date: August 16, 2026',
                'มีผลบังคับใช้: 16 สิงหาคม 2026'
              )}
            </p>
          </div>

          <Card className="border-slate-800/80 bg-[#090b14]/80 backdrop-blur-xl">
            <CardContent className="flex items-start gap-4 p-6">
              <Lock className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200">
                  {t(
                    'Our Commitment to Your Privacy',
                    'ความมุ่งมั่นในการรักษาความเป็นส่วนตัว'
                  )}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t(
                    'DavinTrade AI adheres to strict data privacy principles under GDPR, CCPA, and global cybersecurity frameworks. We do not sell personal data, we do not store plaintext passwords, and all analytics telemetry is fully encrypted at rest and in transit.',
                    'DavinTrade AI ปฏิบัติตามหลักการคุ้มครองข้อมูลส่วนบุคคลภายใต้ GDPR, CCPA และกรอบความปลอดภัยไซเบอร์สากล เราไม่ขายข้อมูลส่วนบุคคลของคุณ ไม่เก็บรหัสผ่านเป็นข้อความธรรมดา และข้อมูลโทรมาตรทั้งหมดได้รับการเข้ารหัสอย่างปลอดภัย'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 border-t border-slate-800/80 pt-6 text-sm leading-relaxed text-slate-300">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                1. {t('Information We Collect', '1. ข้อมูลที่เราเก็บรวบรวม')}
              </h2>
              <p>
                {t(
                  'We collect information you provide directly (such as name, email address, password hashes, and billing details processed securely via dLocal/Stripe), as well as technical usage data (IP address, browser type, device identifiers, session timestamps, and workspace interaction events).',
                  'เราเก็บรวบรวมข้อมูลที่คุณระบุโดยตรง (เช่น ชื่อ, ที่อยู่อีเมล, รหัสผ่านที่ผ่านการแฮช, และข้อมูลการชำระเงินที่ประมวลผลผ่าน dLocal/Stripe) รวมถึงข้อมูลการใช้งานทางเทคนิค (ที่อยู่ IP, ชนิดเบราว์เซอร์, อุปกรณ์, และบันทึกกิจกรรม)'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                2. {t('How We Use Your Data', '2. วัตถุประสงค์ในการใช้ข้อมูล')}
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400 md:text-sm">
                <li>
                  {t(
                    'To provision and maintain your real-time trading workspaces and alert deliveries.',
                    'เพื่อให้บริการและดูแลรักษาพื้นที่ทำงานการเทรดและการแจ้งเตือน'
                  )}
                </li>
                <li>
                  {t(
                    'To process subscription billing, recurring receipts, and affiliate commissions.',
                    'เพื่อประมวลผลการเรียกเก็บเงินและค่าคอมมิชชันพันธมิตร'
                  )}
                </li>
                <li>
                  {t(
                    'To detect and prevent platform abuse, account takeovers, and fraudulent transactions.',
                    'เพื่อตรวจจับและป้องกันการทุจริตและการโจรกรรมบัญชี'
                  )}
                </li>
                <li>
                  {t(
                    'To train and improve Davin AI conversational comprehension without logging private trading credentials.',
                    'เพื่อพัฒนาความสามารถของ Davin AI โดยไม่จัดเก็บข้อมูลความลับส่วนบุคคล'
                  )}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                3.{' '}
                {t(
                  'Your Rights and Data Control',
                  '3. สิทธิของคุณและการควบคุมข้อมูล'
                )}
              </h2>
              <p>
                {t(
                  'You have the full right to export your data, modify your preferences, revoke active login sessions via /settings/security/activity, or initiate permanent account deletion at /settings/account.',
                  'คุณมีสิทธิ์ในการส่งออกข้อมูล แก้ไขการตั้งค่า เพิกถอนเซสชันการเข้าสู่ระบบที่ /settings/security/activity หรือขอลบบัญชีอย่างถาวรได้ที่ /settings/account'
                )}
              </p>
            </section>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

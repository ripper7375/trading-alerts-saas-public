'use client';

import React from 'react';
import { Scale, FileCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function TermsPage() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="space-y-3">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('Service Agreement', 'ข้อตกลงการให้บริการ')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
              {t('Terms of Service', 'ข้อกำหนดและเงื่อนไขการให้บริการ')}
            </h1>
            <p className="text-sm text-slate-400">
              {t('Last Revised: August 2026', 'แก้ไขล่าสุด: สิงหาคม 2026')}
            </p>
          </div>

          <Card className="border-slate-800/80 bg-[#090b14]/80 backdrop-blur-xl">
            <CardContent className="flex items-start gap-4 p-6">
              <Scale className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200">
                  {t('Acceptance of Terms', 'การยอมรับข้อกำหนด')}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t(
                    'By accessing or using DavinTrade AI, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access our quantitative software or conversational trading interfaces.',
                    'การเข้าถึงหรือใช้งาน DavinTrade AI ถือว่าคุณตกลงที่จะผูกพันตามข้อกำหนดการให้บริการนี้ หากคุณไม่เห็นด้วยกับข้อกำหนดส่วนใดส่วนหนึ่ง คุณจะไม่สามารถเข้าใช้งานซอฟต์แวร์วิเคราะห์ข้อมูลหรืออินเทอร์เฟซ AI ของเราได้'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 border-t border-slate-800/80 pt-6 text-sm leading-relaxed text-slate-300">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                1.{' '}
                {t(
                  'Software License & Acceptable Use',
                  '1. ใบอนุญาตการใช้งานซอฟต์แวร์และการใช้งานที่ยอมรับได้'
                )}
              </h2>
              <p>
                {t(
                  'DavinTrade AI grants you a personal, non-exclusive, non-transferable license to utilize our web workspace and signal infrastructure. You agree not to reverse-engineer, redistribute, scrape, or resell algorithmic signals, proprietary indicators, or conversational models without express written consent.',
                  'DavinTrade AI มอบสิทธิ์การใช้งานส่วนบุคคล ไม่สามารถโอนสิทธิ์ได้ เพื่อใช้งานพื้นที่ทำงานบนเว็บและระบบส่งสัญญาณ คุณตกลงที่จะไม่ทำวิศวกรรมย้อนกลับ ทำซ้ำ ดึงข้อมูล หรือจำหน่ายสัญญาณอัลกอริทึมต่อโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                2.{' '}
                {t(
                  'Subscription Fees & Billing Cycles',
                  '2. ค่าบริการสมาชิกและรอบการเรียกเก็บเงิน'
                )}
              </h2>
              <p>
                {t(
                  'PRO subscriptions are billed in advance on a recurring monthly or annual basis. You may cancel at any time through /settings/billing prior to the renewal date. All payments are processed securely through accredited payment partners including dLocal and Stripe.',
                  'แพ็กเกจสมาชิก PRO จะถูกเรียกเก็บเงินล่วงหน้าเป็นรายเดือนหรือรายปี คุณสามารถยกเลิกได้ทุกเมื่อผ่านหน้า /settings/billing ก่อนถึงวันตัดรอบบิล'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                3. {t('Limitation of Liability', '3. การจำกัดความรับผิด')}
              </h2>
              <p>
                {t(
                  'To the maximum extent permitted by law, DavinTrade AI, its officers, affiliates, and licensors shall not be liable for any direct, indirect, incidental, or consequential trading losses or damages resulting from market volatility, system downtime, or analytical interpretations.',
                  'ในขอบเขตสูงสุดที่กฎหมายอนุญาต DavinTrade AI และพันธมิตรจะไม่รับผิดชอบต่อความเสียหายหรือผลขาดทุนจากการเทรดอันเนื่องมาจากความผันผวนของตลาด ระบบขัดข้อง หรือการตีความบทวิเคราะห์'
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

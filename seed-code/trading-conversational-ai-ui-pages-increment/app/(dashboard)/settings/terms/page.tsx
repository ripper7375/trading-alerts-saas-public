'use client';

import { FileText, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLocale } from '@/lib/context/locale-context';

export default function TermsPage() {
  const { t } = useLocale();

  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <FileText className="h-4 w-4 text-amber-400" />{' '}
              {t(
                'Terms of Service & Risk Disclosure Statements',
                'ข้อตกลงการให้บริการ & คำแถลงการเปิดเผยความเสี่ยง'
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t(
                'Legal agreements, privacy disclosures, and financial trading risk notices',
                'ข้อตกลงทางกฎหมาย การเปิดเผยความเป็นส่วนตัว และคำเตือนความเสี่ยงการเทรดทางการเงิน'
              )}
            </p>
          </div>
          <Badge className="border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-300">
            {t('LEGAL', 'กฎหมาย')}
          </Badge>
        </div>

        {/* High Risk Trading Warning Box */}
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert className="h-4 w-4" />{' '}
            {t(
              'Important Risk Disclosure Notice',
              'ข้อสังเกตการเปิดเผยความเสี่ยงที่สำคัญ'
            )}
          </div>
          <p className="leading-relaxed text-slate-300">
            {t(
              'Trading foreign exchange, precious metals (XAUUSD Gold), and futures carries a high level of risk and may not be suitable for all investors. Quantitative signals and AI chart analysis provided by DavinTrade are for informational and analytical purposes only and do not constitute financial advice.',
              'การเทรดอัตราแลกเปลี่ยน โลหะมีค่า (XAUUSD ทองคำ) และฟิวเจอร์สมีความเสี่ยงสูงและอาจไม่เหมาะกับนักลงทุนทุกคน สัญญาณเชิงปริมาณและการวิเคราะห์กราฟด้วย AI โดย DavinTrade มีไว้เพื่อวัตถุประสงค์ทางข้อมูลและการวิเคราะห์เท่านั้น และไม่ถือเป็นคำแนะนำทางการเงิน'
            )}
          </p>
        </div>

        {/* Terms Articles */}
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            {t(
              '1. Master Subscription Agreement',
              '1. ข้อตกลงการสมัครสมาชิกหลัก'
            )}
          </h3>
          <p>
            {t(
              'By accessing DavinTrade SaaS services, you agree to abide by our subscription terms. PRO Tier accounts grant access to server-side line alerts, quad-RAG AI queries, and multi-timeframe visualization overlays. Account credentials may not be shared across unauthorized third-party automated scripts.',
              'ในการเข้าถึงบริการ DavinTrade SaaS คุณตกลงที่จะปฏิบัติตามเงื่อนไขการสมัครสมาชิก สมาชิก PRO จะได้รับสิทธิ์เข้าถึงการแจ้งเตือนเส้นบนเซิร์ฟเวอร์ การสอบถาม AI quad-RAG และเลเยอร์แสดงผลหลายกรอบเวลา ไม่อนุญาตให้แชร์ข้อมูลบัญชีกับสคริปต์อัตโนมัติที่ไม่ได้รับอนุญาต'
            )}
          </p>

          <Separator className="bg-slate-800" />

          <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            {t(
              '2. Data Privacy & GDPR Compliance',
              '2. ความเป็นส่วนตัวของข้อมูลและการปฏิบัติตาม GDPR'
            )}
          </h3>
          <p>
            {t(
              'Your account data, alert rules, and analytical queries are encrypted using 256-bit SSL protocols. DavinTrade never sells personal trading data to third-party brokers or advertisers.',
              'ข้อมูลบัญชี กฎแจ้งเตือน และการวิเคราะห์ของคุณได้รับการเข้ารหัสด้วยโปรโตคอล SSL 256-bit DavinTrade ไม่เคยขายข้อมูลการเทรดส่วนบุคคลให้แก่โบรกเกอร์หรือผู้โฆษณาภายนอก'
            )}
          </p>

          <Separator className="bg-slate-800" />

          <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            {t(
              '3. Cancellation & Refund Policy',
              '3. นโยบายการยกเลิกและการคืนเงิน'
            )}
          </h3>
          <p>
            {t(
              'Subscriptions renew automatically on a monthly or annual basis. You may cancel your subscription at any time under Settings > Billing. All features remain active through the paid billing period.',
              'การสมัครสมาชิกจะต่ออายุอัตโนมัติรายเดือนหรือรายปี คุณสามารถยกเลิกการสมัครสมาชิกได้ตลอดเวลาภายใต้ การตั้งค่า > การชำระเงิน คุณสมบัติทั้งหมดจะยังคงใช้งานได้ตลอดระยะเวลาที่ชำระเงินแล้ว'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

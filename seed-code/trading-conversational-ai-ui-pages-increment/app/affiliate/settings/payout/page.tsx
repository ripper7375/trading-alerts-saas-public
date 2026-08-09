'use client';

import AppHeader from '@/components/layout/app-header';
import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliatePayoutPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('Partner Payout Setup', 'ตั้งค่าการถอนเงินพันธมิตร')}
        subtitle={t(
          'Wise Business Bank Account & RiseWorks Crypto Payout Configuration',
          'กำหนดค่าบัญชีธนาคาร Wise Business & คริปโท RiseWorks'
        )}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <WiseRecipientForm />
      </main>
    </div>
  );
}

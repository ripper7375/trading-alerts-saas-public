import type { Metadata } from 'next';
import { PricingContent } from './_components/pricing-content';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getServerLanguage } from '@/lib/i18n/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getServerLanguage());
  return {
    title: `${dict['Tier Pricing & Plans']} | DavinTrade AI`,
    description: dict['Compare FREE vs PRO Tier Capabilities'],
  };
}

export default function PricingPage() {
  return <PricingContent />;
}

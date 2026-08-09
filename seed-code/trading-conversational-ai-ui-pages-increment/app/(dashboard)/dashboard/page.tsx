import type { Metadata } from 'next';
import { DashboardContent } from './_components/dashboard-content';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getServerLanguage } from '@/lib/i18n/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getServerLanguage());
  return {
    title: `${dict['Main Terminal Dashboard']} | DavinTrade AI`,
    description:
      dict['Real-Time XAUUSD Quantitative Overview & Alert Telemetry'],
  };
}

export default function DashboardPage() {
  return <DashboardContent />;
}

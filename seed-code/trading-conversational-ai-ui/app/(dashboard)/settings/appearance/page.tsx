import type { Metadata } from 'next';
import { AppearanceForm } from './_components/appearance-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getServerLanguage } from '@/lib/i18n/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getServerLanguage());
  return {
    title: `${dict['Terminal Appearance & Chart Color Scheme']} | DavinTrade AI`,
    description:
      dict[
        'Customise dark trading themes, accent highlights, and candlestick styles'
      ],
  };
}

export default function AppearanceSettingsPage() {
  return <AppearanceForm />;
}

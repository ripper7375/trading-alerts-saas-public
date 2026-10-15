import { WorldGoldMarket } from '@/components/market/world-gold-market';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<{
  title: string;
  description: string;
}> {
  const dict = getDictionary(await getServerLanguage());
  return {
    title: dict['worldGold.title'] ?? 'World Gold Market',
    description: dict['worldGold.subtitle'] ?? '',
  };
}

export default function WorldGoldMarketPage(): React.JSX.Element {
  return <WorldGoldMarket />;
}

'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

interface TickerItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const initialTickers: TickerItem[] = [
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    price: '1.08420',
    change: '+0.34%',
    isPositive: true,
  },
  {
    symbol: 'USDJPY',
    name: 'US Dollar / Yen',
    price: '154.280',
    change: '-0.18%',
    isPositive: false,
  },
  {
    symbol: 'GBPUSD',
    name: 'Pound / US Dollar',
    price: '1.29650',
    change: '+0.52%',
    isPositive: true,
  },
  {
    symbol: 'AUDUSD',
    name: 'Aussie / US Dollar',
    price: '0.66120',
    change: '+0.21%',
    isPositive: true,
  },
  {
    symbol: 'USDCHF',
    name: 'US Dollar / Swiss Franc',
    price: '0.88450',
    change: '-0.42%',
    isPositive: false,
  },
  {
    symbol: 'USDCAD',
    name: 'US Dollar / CAD',
    price: '1.38110',
    change: '-0.09%',
    isPositive: false,
  },
  {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    price: '2,645.80',
    change: '+1.45%',
    isPositive: true,
  },
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    price: '94,820.00',
    change: '+3.12%',
    isPositive: true,
  },
];

export function TickerTape() {
  const { language } = useLocale();
  const [tickers, setTickers] = useState<TickerItem[]>(initialTickers);

  // Simulate subtle real-time price fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setTickers((prev) =>
        prev.map((item) => {
          const rand = Math.random();
          if (rand > 0.6) {
            const currentNum = parseFloat(item.price.replace(',', ''));
            const delta = (Math.random() - 0.48) * (currentNum * 0.0008);
            const newPrice = (currentNum + delta).toFixed(
              item.symbol.includes('USD') &&
                !item.symbol.includes('XAU') &&
                !item.symbol.includes('BTC')
                ? 5
                : 2
            );
            return {
              ...item,
              price:
                item.symbol.includes('BTC') || item.symbol.includes('XAU')
                  ? Number(newPrice).toLocaleString(language, {
                      minimumFractionDigits: 2,
                    })
                  : newPrice,
            };
          }
          return item;
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [language]);

  return (
    <div className="w-full overflow-hidden border-y border-slate-800/80 bg-[#06080e]/90 py-2.5 backdrop-blur-md">
      <div className="animate-marquee flex w-max space-x-8 px-4">
        {[...tickers, ...tickers].map((item, idx) => (
          <div
            key={`${item.symbol}-${idx}`}
            className="flex items-center space-x-3 rounded-lg border border-slate-800/60 bg-[#0c101a]/70 px-3.5 py-1.5 text-xs transition-colors hover:border-amber-500/40"
          >
            <div className="flex items-center space-x-1.5 font-bold text-slate-200">
              <Activity className="h-3 w-3 text-amber-400" />
              <span>{item.symbol}</span>
            </div>
            <span className="font-mono font-semibold text-slate-300">
              {item.price}
            </span>
            <span
              className={`flex items-center font-mono font-medium ${
                item.isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {item.isPositive ? (
                <TrendingUp className="mr-0.5 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-0.5 h-3 w-3" />
              )}
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketItemProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const MarketItem = ({
  symbol,
  name,
  price,
  change,
  changePercent,
}: MarketItemProps) => {
  const isPositive = change >= 0;

  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div className="flex-1">
        <p className="font-semibold text-foreground">{symbol}</p>
        <p className="text-xs text-muted-foreground">{name}</p>
      </div>
      <div className="text-right">
        <p className="font-medium text-foreground">
          {price.toLocaleString('en-US', {
            minimumFractionDigits: symbol.includes('JPY') ? 3 : 5,
          })}
        </p>
        <div className="flex items-center justify-end gap-1">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span
            className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}
          >
            {isPositive ? '+' : ''}
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default MarketItem;

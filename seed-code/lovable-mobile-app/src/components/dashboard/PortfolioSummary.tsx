import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PortfolioSummaryProps {
  totalBalance: number;
  dailyChange: number;
  dailyChangePercent: number;
}

const PortfolioSummary = ({
  totalBalance,
  dailyChange,
  dailyChangePercent,
}: PortfolioSummaryProps) => {
  const isPositive = dailyChange >= 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="pb-6 pt-6">
        <p className="mb-1 text-sm text-muted-foreground">
          Total Portfolio Value
        </p>
        <p className="text-3xl font-bold text-foreground">
          ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}
          >
            {isPositive ? '+' : ''}
            {dailyChange.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}{' '}
            ({isPositive ? '+' : ''}
            {dailyChangePercent.toFixed(2)}%)
          </span>
          <span className="text-xs text-muted-foreground">Today</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioSummary;

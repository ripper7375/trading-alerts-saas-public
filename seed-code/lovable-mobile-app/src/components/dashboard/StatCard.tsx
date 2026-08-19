import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendType = 'neutral',
}: StatCardProps) => {
  const trendColors = {
    positive: 'text-green-500',
    negative: 'text-red-500',
    neutral: 'text-primary',
  };

  return (
    <Card className="bg-card">
      <CardContent className="px-4 pb-4 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{title}</p>
        {trend && (
          <p className={`mt-1 text-xs ${trendColors[trendType]}`}>{trend}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;

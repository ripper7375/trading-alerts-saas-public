import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';

interface AlertItemProps {
  symbol: string;
  condition: string;
  triggeredAt: string;
  status: 'triggered' | 'pending';
}

const AlertItem = ({
  symbol,
  condition,
  triggeredAt,
  status,
}: AlertItemProps) => {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <div
        className={`rounded-full p-2 ${status === 'triggered' ? 'bg-amber-500/10' : 'bg-muted'}`}
      >
        {status === 'triggered' ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{symbol}</p>
        <p className="text-xs text-muted-foreground">{condition}</p>
      </div>
      <span className="text-xs text-muted-foreground">{triggeredAt}</span>
    </div>
  );
};

export default AlertItem;

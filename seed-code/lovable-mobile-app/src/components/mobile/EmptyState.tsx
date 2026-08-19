import { ReactNode } from 'react';
import {
  Star,
  Bell,
  BarChart3,
  Search,
  Inbox,
  TrendingUp,
  AlertCircle,
  FileQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateVariant =
  | 'watchlist'
  | 'alerts'
  | 'search'
  | 'notifications'
  | 'charts'
  | 'data'
  | 'error'
  | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  className?: string;
}

const variants: Record<
  EmptyStateVariant,
  { icon: ReactNode; title: string; description: string }
> = {
  watchlist: {
    icon: <Star className="h-12 w-12" />,
    title: 'Your watchlist is empty',
    description: 'Add symbols to start tracking your favorite assets',
  },
  alerts: {
    icon: <Bell className="h-12 w-12" />,
    title: 'No alerts yet',
    description: 'Create price alerts to get notified when targets are reached',
  },
  search: {
    icon: <Search className="h-12 w-12" />,
    title: 'No results found',
    description: 'Try adjusting your search or filters',
  },
  notifications: {
    icon: <Inbox className="h-12 w-12" />,
    title: 'All caught up!',
    description: 'You have no new notifications',
  },
  charts: {
    icon: <BarChart3 className="h-12 w-12" />,
    title: 'No chart data',
    description: 'Select a symbol to view its chart',
  },
  data: {
    icon: <TrendingUp className="h-12 w-12" />,
    title: 'No data available',
    description: 'Data will appear here once available',
  },
  error: {
    icon: <AlertCircle className="h-12 w-12" />,
    title: 'Something went wrong',
    description: "We couldn't load the data. Please try again.",
  },
  generic: {
    icon: <FileQuestion className="h-12 w-12" />,
    title: 'Nothing here',
    description: 'This section is empty',
  },
};

export function EmptyState({
  variant = 'generic',
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  const config = variants[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      {/* Decorative background circles */}
      <div className="relative mb-6">
        <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-border/50 bg-gradient-to-br from-muted/80 to-muted/40">
          <div className="text-muted-foreground/60">{icon || config.icon}</div>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {title || config.title}
      </h3>

      <p className="mb-6 max-w-[250px] text-sm text-muted-foreground">
        {description || config.description}
      </p>

      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Specific empty states for convenience
export function WatchlistEmpty({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      variant="watchlist"
      action={onAdd ? { label: 'Add Symbol', onClick: onAdd } : undefined}
    />
  );
}

export function AlertsEmpty({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      variant="alerts"
      action={
        onCreate ? { label: 'Create Alert', onClick: onCreate } : undefined
      }
    />
  );
}

export function SearchEmpty() {
  return <EmptyState variant="search" />;
}

export function NotificationsEmpty() {
  return <EmptyState variant="notifications" />;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  );
}

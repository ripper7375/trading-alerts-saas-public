'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  NoWatchlistItems,
  NoActiveAlerts,
  NoNotifications,
  NoSearchResults,
  NoBillingHistory,
  NoTriggeredAlerts,
  ConnectionError,
  ComingSoon,
  UpgradeRequired,
  MaintenanceMode,
  LoadingSkeleton,
} from '@/components/empty-states';

export default function EmptyStatesDemo() {
  const [selectedVariant, setSelectedVariant] = useState<string>('base');
  const [searchQuery, setSearchQuery] = useState('AAPL');
  const [isLoading, setIsLoading] = useState(false);

  const variants = [
    { id: 'base', name: 'Base Component' },
    { id: 'watchlist', name: 'No Watchlist' },
    { id: 'alerts', name: 'No Alerts' },
    { id: 'notifications', name: 'No Notifications' },
    { id: 'search', name: 'No Search Results' },
    { id: 'billing', name: 'No Billing History' },
    { id: 'triggered', name: 'No Triggered Alerts' },
    { id: 'error', name: 'Connection Error' },
    { id: 'coming-soon', name: 'Coming Soon' },
    { id: 'upgrade', name: 'Upgrade Required' },
    { id: 'maintenance', name: 'Maintenance Mode' },
    { id: 'loading', name: 'Loading Skeleton' },
  ];

  const handleAction = (action: string) => {
    console.log(`Action triggered: ${action}`);
    alert(`${action} clicked! (Mock action)`);
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return <LoadingSkeleton type="cards" />;
    }

    switch (selectedVariant) {
      case 'base':
        return (
          <EmptyState
            icon="📦"
            title="No items found"
            description="This is the base empty state component that can be customized"
            action={{
              label: 'Add Item',
              onClick: () => handleAction('Add Item'),
            }}
            secondaryAction={{
              label: 'Learn more',
              onClick: () => handleAction('Learn More'),
            }}
          />
        );

      case 'watchlist':
        return (
          <NoWatchlistItems
            onAddSymbol={() => handleAction('Add Symbol')}
            onBrowseSymbols={() => handleAction('Browse Symbols')}
          />
        );

      case 'alerts':
        return (
          <NoActiveAlerts
            onCreateAlert={() => handleAction('Create Alert')}
            onViewCharts={() => handleAction('View Charts')}
          />
        );

      case 'notifications':
        return (
          <NoNotifications onCreateAlert={() => handleAction('Create Alert')} />
        );

      case 'search':
        return (
          <NoSearchResults
            searchQuery={searchQuery}
            onClearSearch={() => {
              handleAction('Clear Search');
              setSearchQuery('');
            }}
            onViewAll={() => handleAction('View All')}
          />
        );

      case 'billing':
        return <NoBillingHistory />;

      case 'triggered':
        return (
          <NoTriggeredAlerts
            onViewActiveAlerts={() => handleAction('View Active Alerts')}
          />
        );

      case 'error':
        return (
          <ConnectionError
            onRetry={() => handleAction('Retry')}
            onReportIssue={() => handleAction('Report Issue')}
          />
        );

      case 'coming-soon':
        return (
          <ComingSoon
            featureName="Advanced Analytics Dashboard"
            onSubscribe={() => handleAction('Subscribe')}
          />
        );

      case 'upgrade':
        return (
          <UpgradeRequired
            onUpgrade={() => handleAction('Upgrade to PRO')}
            onComparePlans={() => handleAction('Compare Plans')}
          />
        );

      case 'maintenance':
        return (
          <MaintenanceMode onCheckStatus={() => handleAction('Check Status')} />
        );

      case 'loading':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Card Skeleton</h3>
              <LoadingSkeleton type="cards" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">List Skeleton</h3>
              <LoadingSkeleton type="list" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Empty States Component Library
          </h1>
          <p className="text-muted-foreground">
            Production-ready empty state components with all variants
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg p-4 sticky top-4">
              <h2 className="font-semibold text-lg mb-4">Variants</h2>
              <nav className="space-y-1">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedVariant === variant.id
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {variant.name}
                  </button>
                ))}
              </nav>

              <div className="mt-6 pt-6 border-t border-border">
                <Button
                  onClick={() => {
                    setIsLoading(true);
                    setTimeout(() => setIsLoading(false), 2000);
                  }}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Toggle Loading'}
                </Button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {variants.find((v) => v.id === selectedVariant)?.name}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Interactive Demo
                </span>
              </div>

              {renderEmptyState()}
            </div>

            {/* Usage Example */}
            <div className="mt-6 bg-muted rounded-lg p-6">
              <h3 className="font-semibold mb-2">Usage Example:</h3>
              <pre className="text-xs bg-background p-4 rounded overflow-x-auto">
                <code>{`import { ${
                  selectedVariant === 'base'
                    ? 'EmptyState'
                    : variants
                        .find((v) => v.id === selectedVariant)
                        ?.name.replace(/\s+/g, '') || 'EmptyState'
                } } from "@/components/empty-states"

// In your component:
<${
                  selectedVariant === 'base'
                    ? 'EmptyState'
                    : variants
                        .find((v) => v.id === selectedVariant)
                        ?.name.replace(/\s+/g, '') || 'EmptyState'
                }
  ${selectedVariant === 'base' ? 'icon="📦"\n  title="No items"\n  description="Add your first item"\n  action={{ label: "Add", onClick: () => {} }}' : ''}
/>`}</code>
              </pre>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface AlertCardProps {
  id: string;
  name: string;
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  status: 'active' | 'paused' | 'triggered';
  createdAt: string; // ISO date string
  onViewChart?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Calculate distance percentage
const calculateDistance = (target: number, current: number) => {
  const diff = current - target;
  const percent = (diff / target) * 100;
  return { diff, percent };
};

// Get distance badge color
const getDistanceColor = (percent: number) => {
  const absPercent = Math.abs(percent);
  if (absPercent < 0.5) return 'green';
  if (absPercent < 1.0) return 'orange';
  return 'red';
};

// Format relative time
const getRelativeTime = (isoDate: string) => {
  const now = new Date();
  const past = new Date(isoDate);
  const diffMs = now.getTime() - past.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

export function AlertCard({
  id,
  name,
  symbol,
  targetPrice,
  currentPrice,
  status,
  createdAt,
  onViewChart,
  onEdit,
  onDelete,
}: AlertCardProps) {
  const { diff, percent } = calculateDistance(targetPrice, currentPrice);
  const distanceColor = getDistanceColor(percent);

  const statusConfig = {
    active: {
      emoji: '🟢',
      label: 'Active',
      className: 'bg-green-100 text-green-800',
    },
    paused: {
      emoji: '⏸️',
      label: 'Paused',
      className: 'bg-gray-100 text-gray-800',
    },
    triggered: {
      emoji: '✅',
      label: 'Triggered',
      className: 'bg-blue-100 text-blue-800',
    },
  };

  const distanceColorClasses = {
    green: 'bg-green-100 text-green-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
  };

  const handleViewChart = () => {
    if (onViewChart) {
      onViewChart(id);
    } else {
      console.log('View Chart clicked for alert:', id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(id);
    } else {
      console.log('Edit clicked for alert:', id);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(id);
    } else {
      console.log('Delete clicked for alert:', id);
    }
  };

  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white rounded-lg p-6">
      {/* CARD HEADER */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{name}</h3>
          <span className="inline-flex bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
            {symbol}
          </span>
        </div>
        <Badge className={statusConfig[status].className}>
          {statusConfig[status].emoji} {statusConfig[status].label}
        </Badge>
      </div>

      {/* CARD BODY */}
      <div className="space-y-4">
        {/* TARGET PRICE */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Target Price</p>
          <p className="text-3xl font-bold text-gray-900">
            ${targetPrice.toFixed(2)}
          </p>
        </div>

        {/* CURRENT PRICE ROW */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">Current Price</p>
          <p className="text-lg font-semibold text-gray-900">
            ${currentPrice.toFixed(2)}
          </p>
        </div>

        {/* DISTANCE BADGE */}
        <div>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${distanceColorClasses[distanceColor]}`}
          >
            {diff >= 0 ? '+' : ''}
            {diff >= 0 ? '$' : '-$'}
            {Math.abs(diff).toFixed(2)} ({percent >= 0 ? '+' : ''}
            {percent.toFixed(2)}%)
          </span>
        </div>

        {/* METADATA ROW */}
        <div className="text-xs text-gray-500">
          Created {getRelativeTime(createdAt)}
        </div>
      </div>

      {/* CARD FOOTER */}
      <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewChart}
          className="transition-all hover:scale-105 bg-transparent"
        >
          📊 View Chart
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          className="transition-all hover:scale-105"
        >
          ✏️ Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all hover:scale-105"
        >
          🗑️ Delete
        </Button>
      </div>
    </Card>
  );
}

// DEMO USAGE
const mockAlerts: AlertCardProps[] = [
  {
    id: '1',
    name: 'Gold H1 Support B-B1',
    symbol: 'XAUUSD',
    targetPrice: 2645.0,
    currentPrice: 2650.5,
    status: 'active',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'EUR/USD Resistance Break',
    symbol: 'EURUSD',
    targetPrice: 1.085,
    currentPrice: 1.094,
    status: 'paused',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Oil Daily High Alert',
    symbol: 'USOIL',
    targetPrice: 75.2,
    currentPrice: 76.35,
    status: 'triggered',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo component to show usage
export function AlertCardDemo() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-8 bg-gray-50">
      {mockAlerts.map((alert) => (
        <AlertCard
          key={alert.id}
          {...alert}
          onViewChart={(id) => console.log('Viewing chart for:', id)}
          onEdit={(id) => console.log('Editing alert:', id)}
          onDelete={(id) => console.log('Deleting alert:', id)}
        />
      ))}
    </div>
  );
}

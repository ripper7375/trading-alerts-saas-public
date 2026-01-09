'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Alert interface
 */
interface Alert {
  id: string;
  name: string | null;
  symbol: string;
  timeframe: string;
  condition: string;
  alertType: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'paused' | 'triggered';
}

/**
 * Parse condition JSON safely
 */
function parseCondition(conditionJson: string): {
  type: string;
  targetValue: number;
} | null {
  try {
    return JSON.parse(conditionJson);
  } catch {
    return null;
  }
}

/**
 * Get condition display text
 */
function getConditionDisplay(conditionType: string): string {
  switch (conditionType) {
    case 'price_above':
      return 'Price Above';
    case 'price_below':
      return 'Price Below';
    case 'price_equals':
      return 'Price Equals';
    default:
      return conditionType;
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format datetime for display
 */
function formatDateTime(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Props for AlertCard component
 */
interface AlertCardProps {
  alert: Alert;
  isSelected?: boolean;
  onSelect?: () => void;
  onViewChart: () => void;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

/**
 * AlertCard Component
 *
 * Individual alert display card with status badge and action buttons.
 * Based on seed-code/v0-components/alert-card-component
 */
export function AlertCard({
  alert,
  isSelected = false,
  onSelect,
  onViewChart,
  onEdit,
  onPause,
  onResume,
  onDelete,
}: AlertCardProps): React.JSX.Element {
  const condition = parseCondition(alert.condition);
  const conditionDisplay = condition
    ? getConditionDisplay(condition.type)
    : 'Unknown';
  const targetValue = condition?.targetValue || 0;

  // Status configuration
  const statusConfig = {
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800',
      borderColor: 'border-l-green-500',
      icon: '🟢',
    },
    paused: {
      label: 'Paused',
      className: 'bg-gray-100 text-gray-700',
      borderColor: 'border-l-gray-300',
      icon: '⏸️',
    },
    triggered: {
      label: 'Triggered',
      className: 'bg-orange-100 text-orange-800',
      borderColor: 'border-l-orange-500',
      icon: '✅',
    },
  };

  const config = statusConfig[alert.status];

  return (
    <Card
      className={`${config.borderColor} border-l-4 hover:shadow-lg transition-shadow ${
        alert.status === 'paused' ? 'opacity-70' : ''
      } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <CardContent className="p-6">
        {/* Card Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-3">
            {/* Selection Checkbox */}
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onSelect}
                className="h-5 w-5 mt-1 text-blue-600 rounded"
              />
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {alert.name || `${alert.symbol} Alert`}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{alert.symbol}</Badge>
                <span className="text-sm text-gray-500">{alert.timeframe}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <Badge className={`${config.className} hover:${config.className}`}>
              {config.icon} {config.label}
            </Badge>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                >
                  <span className="text-lg">&#8942;</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onViewChart}>
                  View Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>Edit Alert</DropdownMenuItem>
                {alert.status === 'active' && (
                  <DropdownMenuItem onClick={onPause}>
                    Pause Alert
                  </DropdownMenuItem>
                )}
                {alert.status === 'paused' && (
                  <DropdownMenuItem onClick={onResume}>
                    Resume Alert
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  Delete Alert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Condition Info */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">{conditionDisplay}</p>
          <p className="text-2xl font-bold text-gray-900">
            $
            {targetValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Triggered Info */}
        {alert.status === 'triggered' && alert.lastTriggered && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700">
              Triggered: {formatDateTime(alert.lastTriggered)}
            </p>
            <p className="text-xs text-gray-500">
              Total triggers: {alert.triggerCount}
            </p>
          </div>
        )}

        {/* Card Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            Created {formatDate(alert.createdAt)}
          </span>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onViewChart}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              View Chart
            </Button>

            {alert.status === 'active' && (
              <>
                <Button onClick={onEdit} variant="outline" size="sm">
                  Edit
                </Button>
                <Button
                  onClick={onPause}
                  variant="outline"
                  size="sm"
                  className="text-gray-600"
                >
                  Pause
                </Button>
              </>
            )}

            {alert.status === 'paused' && (
              <>
                <Button
                  onClick={onResume}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  Resume
                </Button>
                <Button onClick={onEdit} variant="outline" size="sm">
                  Edit
                </Button>
              </>
            )}

            {alert.status === 'triggered' && (
              <Button onClick={onEdit} variant="outline" size="sm">
                Create Similar
              </Button>
            )}

            <Button
              onClick={onDelete}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:border-red-500"
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simple AlertCard for display only (no actions)
 */
export interface SimpleAlertCardProps {
  id: string;
  name: string;
  symbol: string;
  targetPrice: number;
  currentPrice?: number;
  status: 'active' | 'paused' | 'triggered';
  createdAt: string;
  onViewChart?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Calculate distance between current and target price
 */
function calculateDistance(
  target: number,
  current: number
): { diff: number; percent: number } {
  const diff = current - target;
  const percent = (diff / target) * 100;
  return { diff, percent };
}

/**
 * Get distance badge color
 */
function getDistanceColor(percent: number): string {
  const absPercent = Math.abs(percent);
  if (absPercent < 0.5) return 'bg-green-100 text-green-800';
  if (absPercent < 1.0) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

/**
 * SimpleAlertCard Component
 *
 * Simplified alert card for basic display.
 */
export function SimpleAlertCard({
  id,
  name,
  symbol,
  targetPrice,
  currentPrice = 0,
  status,
  createdAt,
  onViewChart,
  onEdit,
  onDelete,
}: SimpleAlertCardProps): React.JSX.Element {
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

  const config = statusConfig[status];

  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white rounded-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{name}</h3>
          <span className="inline-flex bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
            {symbol}
          </span>
        </div>
        <Badge className={config.className}>
          {config.emoji} {config.label}
        </Badge>
      </div>

      {/* Body */}
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Target Price</p>
          <p className="text-3xl font-bold text-gray-900">
            ${targetPrice.toFixed(2)}
          </p>
        </div>

        {currentPrice > 0 && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">Current Price</p>
              <p className="text-lg font-semibold text-gray-900">
                ${currentPrice.toFixed(2)}
              </p>
            </div>

            <div>
              <span
                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${distanceColor}`}
              >
                {diff >= 0 ? '+' : ''}${diff.toFixed(2)} (
                {percent >= 0 ? '+' : ''}
                {percent.toFixed(2)}%)
              </span>
            </div>
          </>
        )}

        <div className="text-xs text-gray-500">
          Created {new Date(createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
        {onViewChart && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewChart(id)}
            className="transition-all hover:scale-105 bg-transparent"
          >
            View Chart
          </Button>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(id)}
            className="transition-all hover:scale-105"
          >
            Edit
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all hover:scale-105"
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

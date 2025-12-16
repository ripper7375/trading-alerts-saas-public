'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
type UserTier = 'FREE' | 'PRO';
type AlertStatus = 'active' | 'paused' | 'triggered';
type AlertType = 'Near Level' | 'Cross Level' | 'Fractal';
type PriceDirection = 'toward' | 'away';

interface Alert {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: AlertStatus;
  targetLine: string;
  targetPrice: number;
  tolerancePercent: number;
  toleranceRange: { min: number; max: number };
  alertType: AlertType;
  currentPrice: number;
  distanceDollar: number;
  distancePercent: number;
  direction: PriceDirection;
  distanceToTargetPercent: number;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  lastChecked: string;
  createdAt: string;
  pausedAt?: string;
  triggeredAt?: string;
  triggeredPrice?: number;
  notificationsSent?: string[];
  autoArchiveIn?: string;
}

// Mock Data
const mockAlerts: Alert[] = [
  {
    id: '1',
    name: 'Gold H1 Support B-B1',
    symbol: 'XAUUSD',
    timeframe: 'H1',
    status: 'active',
    targetLine: 'B-B1 Support',
    targetPrice: 2645.0,
    tolerancePercent: 0.1,
    toleranceRange: { min: 2642.35, max: 2647.65 },
    alertType: 'Near Level',
    currentPrice: 2650.5,
    distanceDollar: -5.5,
    distancePercent: -0.21,
    direction: 'toward',
    distanceToTargetPercent: 0.21,
    notifications: { email: true, push: true, sms: false },
    lastChecked: '5 seconds ago',
    createdAt: '2 hours ago',
  },
  {
    id: '2',
    name: 'EUR/USD H4 Resistance',
    symbol: 'EURUSD',
    timeframe: 'H4',
    status: 'active',
    targetLine: 'Key Resistance Zone',
    targetPrice: 1.085,
    tolerancePercent: 0.05,
    toleranceRange: { min: 1.08446, max: 1.08554 },
    alertType: 'Cross Level',
    currentPrice: 1.0795,
    distanceDollar: 0.0055,
    distancePercent: 0.51,
    direction: 'away',
    distanceToTargetPercent: 0.51,
    notifications: { email: true, push: true, sms: true },
    lastChecked: '12 seconds ago',
    createdAt: '1 day ago',
  },
  {
    id: '3',
    name: 'BTC Daily Fractal',
    symbol: 'BTCUSD',
    timeframe: 'D1',
    status: 'active',
    targetLine: 'Fractal Low',
    targetPrice: 42500.0,
    tolerancePercent: 0.2,
    toleranceRange: { min: 42415.0, max: 42585.0 },
    alertType: 'Fractal',
    currentPrice: 42520.0,
    distanceDollar: -20.0,
    distancePercent: -0.047,
    direction: 'toward',
    distanceToTargetPercent: 0.047,
    notifications: { email: true, push: false, sms: false },
    lastChecked: '3 seconds ago',
    createdAt: '5 hours ago',
  },
  {
    id: '4',
    name: 'S&P 500 Weekly Support',
    symbol: 'SPX',
    timeframe: 'W1',
    status: 'paused',
    targetLine: 'Major Support',
    targetPrice: 4500.0,
    tolerancePercent: 0.15,
    toleranceRange: { min: 4493.25, max: 4506.75 },
    alertType: 'Near Level',
    currentPrice: 4575.0,
    distanceDollar: -75.0,
    distancePercent: -1.64,
    direction: 'away',
    distanceToTargetPercent: 1.64,
    notifications: { email: true, push: true, sms: false },
    lastChecked: '5 minutes ago',
    createdAt: '3 days ago',
    pausedAt: '3 hours ago',
  },
  {
    id: '5',
    name: 'Gold H1 Support B-B1',
    symbol: 'XAUUSD',
    timeframe: 'H1',
    status: 'triggered',
    targetLine: 'B-B1 Support',
    targetPrice: 2645.0,
    tolerancePercent: 0.1,
    toleranceRange: { min: 2642.35, max: 2647.65 },
    alertType: 'Cross Level',
    currentPrice: 2643.2,
    distanceDollar: 1.8,
    distancePercent: 0.068,
    direction: 'away',
    distanceToTargetPercent: 0.068,
    notifications: { email: true, push: true, sms: false },
    lastChecked: '1 minute ago',
    createdAt: '2 days ago',
    triggeredAt: 'Jan 15, 2025 14:32 UTC',
    triggeredPrice: 2645.8,
    notificationsSent: ['Email sent', 'Push notification sent'],
    autoArchiveIn: '23 days',
  },
  {
    id: '6',
    name: 'EUR/USD M15 Breakout',
    symbol: 'EURUSD',
    timeframe: 'M15',
    status: 'triggered',
    targetLine: 'Intraday High',
    targetPrice: 1.092,
    tolerancePercent: 0.05,
    toleranceRange: { min: 1.09145, max: 1.09255 },
    alertType: 'Near Level',
    currentPrice: 1.0885,
    distanceDollar: 0.0035,
    distancePercent: 0.32,
    direction: 'away',
    distanceToTargetPercent: 0.32,
    notifications: { email: true, push: false, sms: false },
    lastChecked: '30 seconds ago',
    createdAt: '1 day ago',
    triggeredAt: 'Jan 14, 2025 09:15 UTC',
    triggeredPrice: 1.0921,
    notificationsSent: ['Email sent'],
    autoArchiveIn: '24 days',
  },
];

export default function AlertsPage() {
  const [userTier] = useState<UserTier>('PRO');
  const [alerts] = useState<Alert[]>(mockAlerts);
  const [activeTab, setActiveTab] = useState<string>('active');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<Alert | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Filter alerts by status and search
  const activeAlerts = alerts.filter(
    (a) =>
      a.status === 'active' &&
      (symbolFilter === 'all' || a.symbol === symbolFilter) &&
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pausedAlerts = alerts.filter(
    (a) =>
      a.status === 'paused' &&
      (symbolFilter === 'all' || a.symbol === symbolFilter) &&
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const triggeredAlerts = alerts.filter(
    (a) =>
      a.status === 'triggered' &&
      (symbolFilter === 'all' || a.symbol === symbolFilter) &&
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const allFilteredAlerts = alerts.filter(
    (a) =>
      (symbolFilter === 'all' || a.symbol === symbolFilter) &&
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique symbols for filter
  const symbols = Array.from(new Set(alerts.map((a) => a.symbol)));

  // Mock functions
  const onViewChart = (alertId: string) => {
    console.log('View chart for alert:', alertId);
  };

  const onEdit = (alertId: string) => {
    console.log('Edit alert:', alertId);
  };

  const onPause = (alertId: string) => {
    console.log('Pause alert:', alertId);
  };

  const onResume = (alertId: string) => {
    console.log('Resume alert:', alertId);
  };

  const onDelete = (alert: Alert) => {
    setAlertToDelete(alert);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    console.log('Delete alert:', alertToDelete?.id);
    if (dontAskAgain) {
      console.log('Dont ask again preference saved');
    }
    setDeleteModalOpen(false);
    setAlertToDelete(null);
  };

  const onCreate = () => {
    console.log('Create new alert');
  };

  const onMute = (alertId: string) => {
    console.log('Mute alert for 1h:', alertId);
  };

  const onArchive = (alertId: string) => {
    console.log('Archive alert:', alertId);
  };

  const onCreateSimilar = (alertId: string) => {
    console.log('Create similar alert:', alertId);
  };

  const toggleAlertSelection = (alertId: string) => {
    setSelectedAlerts((prev) =>
      prev.includes(alertId)
        ? prev.filter((id) => id !== alertId)
        : [...prev, alertId]
    );
  };

  const pauseSelected = () => {
    console.log('Pause selected alerts:', selectedAlerts);
    setSelectedAlerts([]);
  };

  const deleteSelected = () => {
    console.log('Delete selected alerts:', selectedAlerts);
    setSelectedAlerts([]);
  };

  // Get progress bar color based on distance
  const getProgressBarColor = (distancePercent: number) => {
    const absDistance = Math.abs(distancePercent);
    if (absDistance > 1) return 'bg-gray-400';
    if (absDistance > 0.5) return 'bg-yellow-500';
    if (absDistance > 0.2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Render alert card
  const renderAlertCard = (alert: Alert) => {
    const isSelected = selectedAlerts.includes(alert.id);
    const borderColor =
      alert.status === 'active'
        ? 'border-l-green-500'
        : alert.status === 'paused'
          ? 'border-l-gray-300'
          : 'border-l-orange-500';

    return (
      <Card
        key={alert.id}
        className={`${borderColor} border-l-4 mb-4 hover:shadow-xl transition-shadow ${alert.status === 'paused' ? 'opacity-70' : ''}`}
      >
        <CardContent className="p-6">
          {/* Card Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleAlertSelection(alert.id)}
              />
              <Badge
                className={
                  alert.status === 'active'
                    ? 'bg-green-100 text-green-800 hover:bg-green-100'
                    : alert.status === 'paused'
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                      : 'bg-orange-100 text-orange-800 hover:bg-orange-100'
                }
              >
                {alert.status === 'active' && '⏰ Watching'}
                {alert.status === 'paused' && '⏸️ Paused'}
                {alert.status === 'triggered' && '✅ Triggered'}
              </Badge>
              <h3 className="text-xl font-bold text-gray-900">{alert.name}</h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                >
                  ⋮
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewChart(alert.id)}>
                  📊 View Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(alert.id)}>
                  ✏️ Edit Alert
                </DropdownMenuItem>
                {alert.status === 'active' && (
                  <>
                    <DropdownMenuItem onClick={() => onPause(alert.id)}>
                      ⏸️ Pause Alert
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMute(alert.id)}>
                      🔕 Mute for 1h
                    </DropdownMenuItem>
                  </>
                )}
                {alert.status === 'paused' && (
                  <DropdownMenuItem onClick={() => onResume(alert.id)}>
                    ▶️ Resume Alert
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(alert)}
                  className="text-red-600"
                >
                  🗑️ Delete Alert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Second row */}
          <div className="flex gap-4 text-sm text-gray-600 mb-6">
            <span>
              {alert.symbol} • {alert.timeframe}
            </span>
            <span>•</span>
            <span>Created {alert.createdAt}</span>
            {alert.pausedAt && (
              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
                Paused {alert.pausedAt}
              </Badge>
            )}
          </div>

          {/* Card Body */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Left Column - Target Information */}
            <div>
              <div className="text-xs uppercase text-gray-500 font-semibold mb-1">
                Target
              </div>
              <div className="text-lg font-semibold text-green-600 mb-1">
                {alert.targetLine}
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                $
                {alert.targetPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                ±{alert.tolerancePercent}% ($
                {alert.toleranceRange.min.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                -$
                {alert.toleranceRange.max.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                )
              </div>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                {alert.alertType}
              </Badge>
            </div>

            {/* Right Column - Current Status */}
            <div>
              <div className="text-xs uppercase text-gray-500 font-semibold mb-1">
                Current Price
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                $
                {alert.currentPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: alert.symbol === 'EURUSD' ? 4 : 2,
                })}
              </div>
              <div
                className={`text-lg mb-3 ${alert.direction === 'toward' ? 'text-orange-600' : 'text-gray-600'}`}
              >
                {alert.direction === 'toward' ? '↓' : '↑'} $
                {Math.abs(alert.distanceDollar).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: alert.symbol === 'EURUSD' ? 4 : 2,
                })}{' '}
                ({alert.distancePercent > 0 ? '+' : ''}
                {alert.distancePercent.toFixed(2)}%)
              </div>

              {/* Distance Indicator */}
              <div className="mb-2">
                <div className="text-xs text-gray-500 mb-1 flex justify-between items-center">
                  <span>Distance to target</span>
                  {Math.abs(alert.distanceToTargetPercent) < 0.2 && (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
                      ⚠️ NEAR
                    </Badge>
                  )}
                </div>
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressBarColor(alert.distanceToTargetPercent)}`}
                    style={{
                      width: `${Math.min(Math.abs(alert.distanceToTargetPercent) * 50, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Triggered Info */}
          {alert.status === 'triggered' && alert.triggeredAt && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="text-lg font-semibold mb-1">
                Triggered at: ${alert.triggeredPrice?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                Time: {alert.triggeredAt}
              </div>
              <div className="text-sm text-green-600">
                {alert.notificationsSent?.map((notification, idx) => (
                  <span key={idx}>
                    {idx > 0 && ' | '}✓ {notification}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Card Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex gap-2 text-sm">
                <span
                  className={
                    alert.notifications.email ? 'opacity-100' : 'opacity-30'
                  }
                >
                  ✉️ Email
                </span>
                <span
                  className={
                    alert.notifications.push ? 'opacity-100' : 'opacity-30'
                  }
                >
                  📱 Push
                </span>
                <span
                  className={
                    alert.notifications.sms ? 'opacity-100' : 'opacity-30'
                  }
                >
                  💬 SMS
                </span>
              </div>
              <span className="text-xs text-gray-500">
                Updated {alert.lastChecked}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onViewChart(alert.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                📊 View Chart
              </Button>
              {alert.status === 'active' && (
                <>
                  <Button
                    onClick={() => onEdit(alert.id)}
                    variant="outline"
                    className="border-2 border-gray-300 hover:border-blue-500"
                  >
                    ✏️ Edit
                  </Button>
                  <Button
                    onClick={() => onDelete(alert)}
                    variant="outline"
                    className="border-2 border-gray-300 hover:border-red-500 hover:text-red-600"
                  >
                    🗑️ Delete
                  </Button>
                </>
              )}
              {alert.status === 'paused' && (
                <>
                  <Button
                    onClick={() => onResume(alert.id)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    ▶️ Resume
                  </Button>
                  <Button
                    onClick={() => onDelete(alert)}
                    variant="outline"
                    className="border-2 border-gray-300 hover:border-red-500 hover:text-red-600"
                  >
                    🗑️ Delete
                  </Button>
                </>
              )}
              {alert.status === 'triggered' && (
                <>
                  <Button
                    onClick={() => onCreateSimilar(alert.id)}
                    variant="outline"
                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    🔄 Create Similar
                  </Button>
                  <Button
                    onClick={() => onArchive(alert.id)}
                    variant="outline"
                    className="border-2 border-gray-300 hover:border-red-500"
                  >
                    🗑️ Archive
                  </Button>
                </>
              )}
            </div>
          </div>

          {alert.status === 'triggered' && alert.autoArchiveIn && (
            <div className="text-xs text-gray-500 mt-2 text-right">
              Will be archived in {alert.autoArchiveIn}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const displayedAlerts =
    activeTab === 'active'
      ? activeAlerts
      : activeTab === 'paused'
        ? pausedAlerts
        : activeTab === 'triggered'
          ? triggeredAlerts
          : allFilteredAlerts;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-4">
            Dashboard &gt; Alerts
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">🔔 Alerts</h1>
              <p className="text-gray-600">Manage your price alerts</p>
            </div>
            <Button
              onClick={onCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              + Create New Alert
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Active Alerts Card */}
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardContent className="p-6">
              <div className="text-4xl mb-2">⏰</div>
              <div className="text-sm uppercase font-semibold text-gray-600 mb-2">
                Active
              </div>
              <div className="text-4xl font-bold text-green-600 mb-1">
                {activeAlerts.length}/{userTier === 'PRO' ? '∞' : '5'}
              </div>
              <div className="text-sm text-gray-500">alerts watching</div>
            </CardContent>
          </Card>

          {/* Paused Alerts Card */}
          <Card className="border-l-4 border-l-gray-300 shadow-md">
            <CardContent className="p-6">
              <div className="text-4xl mb-2">⏸️</div>
              <div className="text-sm uppercase font-semibold text-gray-600 mb-2">
                Paused
              </div>
              <div className="text-4xl font-bold text-gray-600 mb-1">
                {pausedAlerts.length}
              </div>
              <div className="text-sm text-gray-500">temporarily inactive</div>
            </CardContent>
          </Card>

          {/* Triggered Alerts Card */}
          <Card className="border-l-4 border-l-orange-500 shadow-md">
            <CardContent className="p-6">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-sm uppercase font-semibold text-gray-600 mb-2">
                Triggered
              </div>
              <div className="text-4xl font-bold text-orange-600 mb-1">
                {triggeredAlerts.length}
              </div>
              <div className="text-sm text-gray-500">in last 7 days</div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions Bar */}
        {selectedAlerts.length > 0 && (
          <div className="bg-blue-600 text-white rounded-lg p-4 shadow-lg mb-6 flex flex-wrap items-center justify-between gap-4">
            <span className="font-semibold">
              {selectedAlerts.length} alerts selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={pauseSelected}
                variant="secondary"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                Pause Selected
              </Button>
              <Button
                onClick={deleteSelected}
                variant="secondary"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                Delete Selected
              </Button>
              <Button
                onClick={() => setSelectedAlerts([])}
                variant="secondary"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                Deselect All
              </Button>
            </div>
          </div>
        )}

        {/* Filters & Tabs */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">
                  Active ({activeAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="paused">
                  Paused ({pausedAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="triggered">
                  Triggered ({triggeredAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="all">
                  All ({allFilteredAlerts.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Symbols" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Symbols</SelectItem>
                  {symbols.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Newest First" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="near">Price Near Target</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  🔍
                </span>
                <Input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-2 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Alerts Section */}
        {activeTab === 'active' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              🟢 Active Alerts ({activeAlerts.length}):
            </h2>
            {activeAlerts.length === 0 ? (
              <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
                <CardContent className="p-16 text-center">
                  <div className="text-8xl opacity-30 mb-4">🔔</div>
                  <h3 className="text-2xl text-gray-500 mb-2">
                    No active alerts
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Create your first alert to get notified about price
                    movements
                  </p>
                  <Button
                    onClick={onCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg"
                  >
                    + Create Your First Alert
                  </Button>
                </CardContent>
              </Card>
            ) : (
              activeAlerts.map(renderAlertCard)
            )}
          </div>
        )}

        {/* Paused Alerts Section */}
        {activeTab === 'paused' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              ⏸️ Paused Alerts ({pausedAlerts.length}):
            </h2>
            {pausedAlerts.length === 0 ? (
              <p className="text-gray-500 italic">No paused alerts</p>
            ) : (
              pausedAlerts.map(renderAlertCard)
            )}
          </div>
        )}

        {/* Triggered Alerts Section */}
        {activeTab === 'triggered' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              ✅ Triggered Alerts (Last 7 days) ({triggeredAlerts.length}):
            </h2>
            {triggeredAlerts.length === 0 ? (
              <p className="text-gray-500 italic">
                No alerts have triggered in the last 7 days
              </p>
            ) : (
              triggeredAlerts.map(renderAlertCard)
            )}
          </div>
        )}

        {/* All Alerts Section */}
        {activeTab === 'all' && (
          <div>
            {allFilteredAlerts.length === 0 ? (
              <p className="text-gray-500 italic">No alerts found</p>
            ) : (
              <>
                {activeAlerts.length > 0 && (
                  <>
                    <h2 className="text-2xl font-bold mb-6 mt-8">
                      🟢 Active Alerts ({activeAlerts.length}):
                    </h2>
                    {activeAlerts.map(renderAlertCard)}
                  </>
                )}
                {pausedAlerts.length > 0 && (
                  <>
                    <h2 className="text-2xl font-bold mb-6 mt-12">
                      ⏸️ Paused Alerts ({pausedAlerts.length}):
                    </h2>
                    {pausedAlerts.map(renderAlertCard)}
                  </>
                )}
                {triggeredAlerts.length > 0 && (
                  <>
                    <h2 className="text-2xl font-bold mb-6 mt-12">
                      ✅ Triggered Alerts (Last 7 days) (
                      {triggeredAlerts.length}):
                    </h2>
                    {triggeredAlerts.map(renderAlertCard)}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-600">
              ⚠️ Delete Alert?
            </DialogTitle>
            <DialogDescription className="text-gray-700 pt-4">
              Are you sure you want to delete the alert &apos;
              {alertToDelete?.name}&apos;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-4">
            <Checkbox
              id="dontAsk"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor="dontAsk"
              className="text-sm text-gray-600 cursor-pointer"
            >
              Don&apos;t ask me again
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setDeleteModalOpen(false);
                setAlertToDelete(null);
              }}
              variant="outline"
              className="border-2 border-gray-300 px-6 py-3"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3"
            >
              Delete Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

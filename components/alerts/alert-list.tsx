'use client';

import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { AlertCard } from './alert-card';

/**
 * Alert interface
 */
export interface Alert {
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
 * Props for AlertList component
 */
interface AlertListProps {
  alerts: Alert[];
  onViewChart: (symbol: string, timeframe: string) => void;
  onEdit: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * AlertList Component
 *
 * Renders a list of alerts with status badges, bulk selection, and actions.
 */
export function AlertList({
  alerts,
  onViewChart,
  onEdit,
  onPause,
  onResume,
  onDelete,
}: AlertListProps): React.JSX.Element {
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Toggle alert selection
  const toggleSelection = (id: string): void => {
    setSelectedAlerts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all alerts
  const selectAll = (): void => {
    setSelectedAlerts(alerts.map((a) => a.id));
  };

  // Deselect all alerts
  const deselectAll = (): void => {
    setSelectedAlerts([]);
  };

  // Handle bulk pause
  const handleBulkPause = (): void => {
    selectedAlerts.forEach((id) => onPause(id));
    setSelectedAlerts([]);
  };

  // Handle bulk delete confirmation
  const openBulkDeleteModal = (): void => {
    setDeleteModalOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = (): void => {
    selectedAlerts.forEach((id) => onDelete(id));
    setSelectedAlerts([]);
    setDeleteModalOpen(false);
  };

  if (alerts.length === 0) {
    return (
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
        <CardContent className="p-16 text-center">
          <h3 className="text-2xl text-gray-500 mb-2">No alerts</h3>
          <p className="text-gray-400">
            Create your first alert to get notified about price movements
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Bulk Actions Bar */}
      {selectedAlerts.length > 0 && (
        <div className="bg-blue-600 text-white rounded-lg p-4 shadow-lg mb-6 flex flex-wrap items-center justify-between gap-4">
          <span className="font-semibold">
            {selectedAlerts.length} alert
            {selectedAlerts.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkPause}
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Pause Selected
            </Button>
            <Button
              onClick={openBulkDeleteModal}
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Delete Selected
            </Button>
            <Button
              onClick={deselectAll}
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Select All Toggle */}
      {alerts.length > 1 && selectedAlerts.length === 0 && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All ({alerts.length})
          </Button>
        </div>
      )}

      {/* Alert Cards */}
      <div className="space-y-4">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            isSelected={selectedAlerts.includes(alert.id)}
            onSelect={() => toggleSelection(alert.id)}
            onViewChart={() => onViewChart(alert.symbol, alert.timeframe)}
            onEdit={() => onEdit(alert.id)}
            onPause={() => onPause(alert.id)}
            onResume={() => onResume(alert.id)}
            onDelete={() => onDelete(alert.id)}
          />
        ))}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">
              Delete {selectedAlerts.length} Alert
              {selectedAlerts.length !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription className="text-gray-700 pt-4">
              Are you sure you want to delete these alerts? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setDeleteModalOpen(false);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Status Badge Component
 */
export function AlertStatusBadge({
  status,
}: {
  status: 'active' | 'paused' | 'triggered';
}): React.JSX.Element {
  const config = {
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800',
      icon: '🟢',
    },
    paused: {
      label: 'Paused',
      className: 'bg-gray-100 text-gray-700',
      icon: '⏸️',
    },
    triggered: {
      label: 'Triggered',
      className: 'bg-orange-100 text-orange-800',
      icon: '✅',
    },
  };

  const { label, className, icon } = config[status];

  return (
    <Badge className={`${className} hover:${className}`}>
      {icon} {label}
    </Badge>
  );
}

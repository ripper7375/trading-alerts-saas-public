import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellRing, Plus, Pencil, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/mobile/PullToRefresh';
import { AlertsSkeleton } from '@/components/mobile/Skeletons';
import { AlertsEmpty, SearchEmpty } from '@/components/mobile/EmptyState';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';

interface Alert {
  id: string;
  symbol: string;
  condition: 'above' | 'below' | 'equals';
  price: string;
  status: 'active' | 'triggered';
  createdAt: string;
}

const availableSymbols = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen' },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar' },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar' },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
];

const initialAlerts: Alert[] = [
  {
    id: '1',
    symbol: 'EURUSD',
    condition: 'above',
    price: '1.0900',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    symbol: 'XAUUSD',
    condition: 'below',
    price: '2000.00',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    symbol: 'BTCUSD',
    condition: 'equals',
    price: '45000',
    status: 'triggered',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    symbol: 'GBPUSD',
    condition: 'above',
    price: '1.2700',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

const Alerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAlertId, setDeleteAlertId] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formSymbol, setFormSymbol] = useState('');
  const [formCondition, setFormCondition] = useState<
    'above' | 'below' | 'equals'
  >('above');
  const [formPrice, setFormPrice] = useState('');

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
  }, []);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filteredAlerts = alerts.filter((alert) =>
    alert.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAlerts = filteredAlerts.filter((a) => a.status === 'active');
  const triggeredAlerts = filteredAlerts.filter(
    (a) => a.status === 'triggered'
  );

  const resetForm = () => {
    setFormSymbol('');
    setFormCondition('above');
    setFormPrice('');
  };

  const handleCreateAlert = () => {
    if (!formSymbol || !formPrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const newAlert: Alert = {
      id: Date.now().toString(),
      symbol: formSymbol,
      condition: formCondition,
      price: formPrice,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    setAlerts([newAlert, ...alerts]);
    setIsCreateDialogOpen(false);
    resetForm();
    toast({
      title: 'Alert Created',
      description: `Alert for ${formSymbol} has been created`,
    });
  };

  const handleEditAlert = () => {
    if (!editingAlert || !formSymbol || !formPrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setAlerts(
      alerts.map((alert) =>
        alert.id === editingAlert.id
          ? {
              ...alert,
              symbol: formSymbol,
              condition: formCondition,
              price: formPrice,
            }
          : alert
      )
    );
    setIsEditDialogOpen(false);
    setEditingAlert(null);
    resetForm();
    toast({
      title: 'Alert Updated',
      description: `Alert for ${formSymbol} has been updated`,
    });
  };

  const handleDeleteAlert = (alertId?: string) => {
    const idToDelete = alertId || deleteAlertId;
    if (!idToDelete) return;

    const alertToDelete = alerts.find((a) => a.id === idToDelete);
    setAlerts(alerts.filter((alert) => alert.id !== idToDelete));
    setDeleteAlertId(null);
    toast({
      title: 'Alert Deleted',
      description: `Alert for ${alertToDelete?.symbol} has been deleted`,
    });
  };

  const openEditDialog = (alert: Alert) => {
    setEditingAlert(alert);
    setFormSymbol(alert.symbol);
    setFormCondition(alert.condition);
    setFormPrice(alert.price);
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'above':
        return 'goes above';
      case 'below':
        return 'goes below';
      case 'equals':
        return 'reaches';
      default:
        return condition;
    }
  };

  const renderAlertCard = (alert: Alert, isTriggered: boolean = false) => (
    <SwipeableItem key={alert.id} onDelete={() => handleDeleteAlert(alert.id)}>
      <Card
        className={`rounded-none border-0 bg-card ${isTriggered ? 'opacity-75' : ''}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isTriggered ? 'bg-accent' : 'bg-primary/10'
                }`}
              >
                {isTriggered ? (
                  <BellRing className="h-5 w-5 text-accent-foreground" />
                ) : (
                  <Bell className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground">{alert.symbol}</p>
                <p className="text-sm text-muted-foreground">
                  {getConditionLabel(alert.condition)} {alert.price}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={isTriggered ? 'outline' : 'secondary'}>
                {isTriggered ? 'Triggered' : 'Active'}
              </Badge>
              {!isTriggered && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditDialog(alert)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </SwipeableItem>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Alerts</h1>
            <p className="text-sm text-muted-foreground">
              {activeAlerts.length} active, {triggeredAlerts.length} triggered
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="icon" onClick={() => resetForm()}>
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Alert</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Select value={formSymbol} onValueChange={setFormSymbol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select symbol" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSymbols.map((item) => (
                        <SelectItem key={item.symbol} value={item.symbol}>
                          <span className="font-medium">{item.symbol}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {item.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <Select
                    value={formCondition}
                    onValueChange={(value: 'above' | 'below' | 'equals') =>
                      setFormCondition(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Price goes above</SelectItem>
                      <SelectItem value="below">Price goes below</SelectItem>
                      <SelectItem value="equals">Price reaches</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Target Price</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.0001"
                    placeholder="Enter target price"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAlert}>Create Alert</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </header>

      {/* Content */}
      <div
        ref={containerRef}
        className="relative flex-1 space-y-4 overflow-y-auto p-4 pb-24"
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />

        {isLoading ? (
          <AlertsSkeleton />
        ) : filteredAlerts.length === 0 ? (
          searchQuery ? (
            <SearchEmpty />
          ) : (
            <AlertsEmpty onCreate={openCreateDialog} />
          )
        ) : (
          <>
            {/* Active Alerts */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active Alerts ({activeAlerts.length})
              </h2>
              {activeAlerts.length === 0 ? (
                <Card className="bg-card">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>No active alerts</p>
                    <p className="text-sm">Create one to get started</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.map((alert) => renderAlertCard(alert, false))}
                </div>
              )}
            </div>

            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Triggered ({triggeredAlerts.length})
                </h2>
                <div className="space-y-2">
                  {triggeredAlerts.map((alert) => renderAlertCard(alert, true))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-symbol">Symbol</Label>
              <Select value={formSymbol} onValueChange={setFormSymbol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  {availableSymbols.map((item) => (
                    <SelectItem key={item.symbol} value={item.symbol}>
                      <span className="font-medium">{item.symbol}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {item.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-condition">Condition</Label>
              <Select
                value={formCondition}
                onValueChange={(value: 'above' | 'below' | 'equals') =>
                  setFormCondition(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Price goes above</SelectItem>
                  <SelectItem value="below">Price goes below</SelectItem>
                  <SelectItem value="equals">Price reaches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Target Price</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.0001"
                placeholder="Enter target price"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditAlert}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteAlertId}
        onOpenChange={(open) => !open && setDeleteAlertId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this alert? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteAlert()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Alerts;

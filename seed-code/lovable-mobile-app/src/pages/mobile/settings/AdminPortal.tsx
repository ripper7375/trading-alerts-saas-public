import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Users,
  Database,
  Activity,
  Settings2,
  FileText,
  Shield,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const adminFeatures = [
  {
    icon: Users,
    label: 'User Management',
    description: 'Manage users and permissions',
    badge: '12 active',
    locked: false,
  },
  {
    icon: Database,
    label: 'Database',
    description: 'View and manage data',
    badge: null,
    locked: false,
  },
  {
    icon: Activity,
    label: 'System Metrics',
    description: 'Performance monitoring',
    badge: 'Live',
    locked: false,
  },
  {
    icon: Settings2,
    label: 'System Config',
    description: 'App configuration',
    badge: null,
    locked: false,
  },
  {
    icon: FileText,
    label: 'Audit Logs',
    description: 'Activity history',
    badge: '24 new',
    locked: false,
  },
  {
    icon: Shield,
    label: 'Security Settings',
    description: 'Auth and encryption',
    badge: null,
    locked: true,
  },
];

const systemStats = [
  { label: 'Active Users', value: '1,247', change: '+12%' },
  { label: 'API Calls (24h)', value: '45.2K', change: '+8%' },
  { label: 'Uptime', value: '99.9%', change: null },
  { label: 'Avg Response', value: '124ms', change: '-5%' },
];

const AdminPortal = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Admin Portal</h1>
            <p className="text-sm text-muted-foreground">System management</p>
          </div>
          <Badge variant="destructive" className="text-xs">
            Admin
          </Badge>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* System Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              System Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-3">
              {systemStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg bg-secondary/50 p-3"
                >
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold text-foreground">
                      {stat.value}
                    </p>
                    {stat.change && (
                      <span
                        className={`text-xs ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {stat.change}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Admin Features */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Administration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {adminFeatures.map((feature) => (
              <button
                key={feature.label}
                disabled={feature.locked}
                className={`flex w-full items-center gap-3 rounded-lg p-3 transition-colors ${
                  feature.locked
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <feature.icon className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
                {feature.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                )}
                {feature.locked ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-1 py-3"
              >
                <Database className="h-4 w-4" />
                <span className="text-xs">Backup DB</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-1 py-3"
              >
                <Activity className="h-4 w-4" />
                <span className="text-xs">View Logs</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-1 py-3"
              >
                <Users className="h-4 w-4" />
                <span className="text-xs">Add User</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-1 py-3"
              >
                <Settings2 className="h-4 w-4" />
                <span className="text-xs">Clear Cache</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPortal;

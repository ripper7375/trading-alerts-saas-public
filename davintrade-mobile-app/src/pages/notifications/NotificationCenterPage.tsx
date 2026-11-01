import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  TrendingUp,
  Trash2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/mobile/EmptyState';
import { useNotifications } from '@/contexts/NotificationContext';

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header & Mark All Read */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground">
            Notification Center
            {unreadCount > 0 && (
              <Badge variant="pro" className="px-2 py-0 text-[10px]">
                {unreadCount} New
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            Price breach triggers and market updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            className="h-8 gap-1 text-[11px] font-bold"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Mark all read</span>
          </Button>
        )}
      </div>

      {/* Notifications Feed */}
      <div className="flex flex-col gap-2.5">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="All caught up"
            description="You have no notifications. Armed alerts will appear here when price breaches occur."
          />
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              onClick={() => {
                markAsRead(n.id);
                if (n.url) navigate(n.url);
              }}
              className={`cursor-pointer border-border/80 transition-all ${
                !n.isRead
                  ? 'border-amber-500/40 bg-amber-500/10 shadow-sm'
                  : 'bg-card/60'
              }`}
            >
              <CardContent className="flex items-start justify-between gap-3 p-3.5">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      n.priority === 'HIGH'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold leading-tight text-foreground">
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {n.body}
                    </p>
                    <span className="block pt-0.5 font-mono text-[9px] text-muted-foreground/80">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(n.id);
                  }}
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  CreditCard,
  Palette,
  Globe,
  Lock,
  HelpCircle,
  FileText,
  ChevronRight,
  LogOut,
  Sparkles,
  Users,
  Bell,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsOverviewPage() {
  const navigate = useNavigate();
  const { user, isPro, isAffiliate, logout } = useAuth();

  const SETTINGS_SECTIONS = [
    {
      title: 'Account & Subscription',
      items: [
        {
          icon: User,
          label: 'User Profile',
          desc: 'Name, avatar & experience',
          path: '/settings/profile',
        },
        {
          icon: CreditCard,
          label: 'Billing & Plans',
          desc: isPro ? 'PRO Plan ($29/mo)' : 'FREE Plan (Upgrade available)',
          path: '/settings/billing',
          badge: user?.tier,
        },
        {
          icon: Shield,
          label: 'Security & 2FA',
          desc: 'Password & two-factor authenticator',
          path: '/settings/security',
        },
      ],
    },
    {
      title: 'Preferences & Display',
      items: [
        {
          icon: Palette,
          label: 'Appearance & Theme',
          desc: 'Dark, OLED, accent colors & charts',
          path: '/settings/appearance',
        },
        {
          icon: Globe,
          label: 'Language & Region',
          desc: 'Timezones & display currency',
          path: '/settings/language',
        },
        {
          icon: Lock,
          label: 'Privacy & Data',
          desc: 'GDPR telemetry & data export',
          path: '/settings/privacy',
        },
      ],
    },
    ...(isAffiliate
      ? [
          {
            title: 'Partner Affiliate Portal',
            items: [
              {
                icon: Users,
                label: 'Affiliate Dashboard',
                desc: '20% lifetime recurring commissions',
                path: '/affiliate/dashboard',
                badge: 'PARTNER',
              },
              {
                icon: CreditCard,
                label: 'Payout Setup',
                desc: 'Bank, Wire & USDT TRC20 details',
                path: '/affiliate/dashboard/profile/payment',
              },
            ],
          },
        ]
      : []),
    {
      title: 'Support & Legal',
      items: [
        {
          icon: HelpCircle,
          label: 'Help & FAQ Support',
          desc: 'Guides, tickets & documentation',
          path: '/settings/help',
        },
        {
          icon: FileText,
          label: 'Terms & Risk Disclaimer',
          desc: 'SLA agreement & legal disclosures',
          path: '/settings/terms',
        },
        {
          icon: Trash2,
          label: 'Account Management',
          desc: 'Deactivate or delete account',
          path: '/settings/account',
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Profile Header Card */}
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/20 text-base font-black text-amber-500">
              {user?.name.charAt(0) || 'U'}
            </div>
            <div>
              <div className="text-sm font-black text-foreground">
                {user?.name}
              </div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <Badge
            variant={isPro ? 'pro' : 'outline'}
            className="px-2 py-0.5 text-[10px]"
          >
            {user?.tier}
          </Badge>
        </CardContent>
      </Card>

      {/* Settings Groups */}
      <div className="space-y-4">
        {SETTINGS_SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-1.5">
            <h2 className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {sec.title}
            </h2>
            <Card className="divide-y divide-border/60 overflow-hidden border-border/80 bg-card">
              {sec.items.map((item) => (
                <div
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex cursor-pointer items-center justify-between p-3.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        {item.label}
                        {item.badge && (
                          <Badge variant="pro" className="px-1 py-0 text-[9px]">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </div>
              ))}
            </Card>
          </div>
        ))}

        {/* Log Out Button */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-2">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out of Account</span>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

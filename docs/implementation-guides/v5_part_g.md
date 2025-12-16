### 9.3 SERVICE 3: Settings & Configuration

#### 9.3.1 Settings Layout

Create `app/(dashboard)/settings/layout.tsx`:

```typescript
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  User,
  Palette,
  Shield,
  CreditCard,
  Globe,
  HelpCircle,
  BookOpen,
  LogOut
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const settingsSections = [
  { name: 'Profile', href: '/settings/profile', icon: User },
  { name: 'Appearance', href: '/settings/appearance', icon: Palette },
  { name: 'Account', href: '/settings/account', icon: Shield },
  { name: 'Privacy', href: '/settings/privacy', icon: Shield },
  { name: 'Billing', href: '/settings/billing', icon: CreditCard },
  { name: 'Language', href: '/settings/language', icon: Globe },
  { name: 'Get Help', href: '/settings/help', icon: HelpCircle },
  { name: 'Learn More', href: '/settings/learn', icon: BookOpen },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        {/* User Tier Badge */}
        <div className="mb-6 px-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Current Plan</p>
            <div className="flex items-center justify-between">
              <Badge
                variant={session?.user?.tier === 'PRO' ? 'default' : 'secondary'}
                className="text-sm"
              >
                {session?.user?.tier || 'FREE'}
              </Badge>
              {session?.user?.tier === 'FREE' && (
                <Link
                  href="/settings/billing"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const isActive = pathname === section.href;

            return (
              <Link
                key={section.href}
                href={section.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                <Icon size={20} />
                <span className="font-medium">{section.name}</span>
              </Link>
            );
          })}

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-red-50 text-red-600 w-full"
          >
            <LogOut size={20} />
            <span className="font-medium">Log Out</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
```

#### 9.3.2 User Profile Settings

Create `app/(dashboard)/settings/profile/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProfileSettings() {
  const { data: session, update } = useSession();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const form = useForm({
    defaultValues: {
      name: session?.user?.name || '',
      bio: '',
      location: '',
      website: ''
    }
  });

  async function onSubmit(data: any) {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to update profile');

      await update(); // Refresh session
      toast({ title: 'Profile updated successfully' });

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    // Implement file upload logic here
    // For example, upload to S3 or similar service

    setUploading(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Tier Display */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Account Tier</p>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant={session?.user?.tier === 'PRO' ? 'default' : 'secondary'}>
                  {session?.user?.tier || 'FREE'}
                </Badge>
                <span className="text-sm text-gray-700">
                  {session?.user?.tier === 'FREE'
                    ? 'Access to XAUUSD'
                    : 'Access to 10 symbols'}
                </span>
              </div>
            </div>
            {session?.user?.tier === 'FREE' && (
              <Button variant="outline" size="sm" asChild>
                <a href="/settings/billing">Upgrade to PRO</a>
              </Button>
            )}
          </div>
        </div>

        {/* Avatar */}
        <div>
          <label className="text-sm font-medium mb-2 block">Profile Picture</label>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={session?.user?.image || ''} />
              <AvatarFallback>
                {session?.user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <span className="text-sm">Change Photo</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium mb-2 block">Full Name</label>
          <Input {...form.register('name')} />
        </div>

        {/* Bio */}
        <div>
          <label className="text-sm font-medium mb-2 block">Bio</label>
          <Textarea
            {...form.register('bio')}
            rows={4}
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Location */}
        <div>
          <label className="text-sm font-medium mb-2 block">Location</label>
          <Input {...form.register('location')} placeholder="City, Country" />
        </div>

        {/* Website */}
        <div>
          <label className="text-sm font-medium mb-2 block">Website</label>
          <Input
            {...form.register('website')}
            type="url"
            placeholder="https://example.com"
          />
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}
```

#### 9.3.3 Appearance Settings

Create `app/(dashboard)/settings/appearance/page.tsx`:

```typescript
'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Appearance</h1>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Theme</h2>
          <RadioGroup value={theme} onValueChange={setTheme}>
            <div className="grid grid-cols-3 gap-4">
              {themes.map((themeOption) => {
                const Icon = themeOption.icon;
                return (
                  <div key={themeOption.value}>
                    <RadioGroupItem
                      value={themeOption.value}
                      id={themeOption.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={themeOption.value}
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Icon className="mb-3 h-6 w-6" />
                      {themeOption.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Layout Density</h2>
          <RadioGroup defaultValue="comfortable">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="comfortable" id="comfortable" />
              <Label htmlFor="comfortable">Comfortable</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="compact" id="compact" />
              <Label htmlFor="compact">Compact</Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Font Size</h2>
          <RadioGroup defaultValue="medium">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="small" id="small" />
              <Label htmlFor="small">Small</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="medium" />
              <Label htmlFor="medium">Medium</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="large" id="large" />
              <Label htmlFor="large">Large</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
```

#### 9.3.4 Billing Settings (2-Tier System)

Create `app/(dashboard)/settings/billing/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Download, Check, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const TIER_FEATURES = {
  FREE: [
    '1 symbol: XAUUSD',
    '7 timeframes',
    'Basic alerts',
    'Community support'
  ],
  PRO: [
    '10 symbols',
    '7 timeframes per symbol',
    'Unlimited alerts',
    'Priority support',
    'Advanced indicators',
    'API access'
  ]
};

export default function BillingSettings() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/subscription');
      return res.json();
    }
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await fetch('/api/invoices');
      return res.json();
    }
  });

  const upgradeToPro = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'PRO' })
      });
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      }
    }
  });

  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to cancel subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: 'Subscription cancelled successfully' });
      setShowCancelDialog(false);
    }
  });

  const currentTier = session?.user?.tier as 'FREE' | 'PRO';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Billing & Subscription</h1>

      {/* Current Plan */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant={currentTier === 'PRO' ? 'default' : 'secondary'}
                className="text-lg px-3 py-1"
              >
                {currentTier}
              </Badge>
              <span className="text-2xl font-bold">
                {currentTier === 'PRO' ? '$29' : '$0'}
                <span className="text-sm font-normal text-gray-600">/month</span>
              </span>
            </div>
            {subscription?.status === 'ACTIVE' && currentTier === 'PRO' && (
              <p className="text-gray-600">
                Renews on {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Current Plan Features */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-600 mb-3">Your current benefits:</p>
          <ul className="space-y-2">
            {TIER_FEATURES[currentTier].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {currentTier === 'FREE' ? (
            <Button
              onClick={() => upgradeToPro.mutate()}
              disabled={upgradeToPro.isPending}
              className="flex items-center gap-2"
            >
              Upgrade to PRO
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">Cancel Subscription</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel PRO Subscription?</DialogTitle>
                  <DialogDescription>
                    You'll lose access to 9 additional symbols and will only have access to XAUUSD.
                    Your subscription will remain active until the end of the billing period.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(false)}
                  >
                    Keep PRO
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => cancelSubscription.mutate()}
                    disabled={cancelSubscription.isPending}
                  >
                    {cancelSubscription.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </Card>

      {/* Plan Comparison */}
      {currentTier === 'FREE' && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <h2 className="text-lg font-semibold mb-4">Upgrade to PRO</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="font-semibold text-gray-700 mb-2">FREE (Current)</p>
              <ul className="space-y-2">
                {TIER_FEATURES.FREE.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-gray-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-blue-700 mb-2">PRO - $29/month</p>
              <ul className="space-y-2">
                {TIER_FEATURES.PRO.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-blue-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button
            onClick={() => upgradeToPro.mutate()}
            disabled={upgradeToPro.isPending}
            className="w-full"
          >
            {upgradeToPro.isPending ? 'Processing...' : 'Upgrade to PRO Now'}
          </Button>
        </Card>
      )}

      {/* Payment Method (PRO only) */}
      {currentTier === 'PRO' && subscription?.status === 'ACTIVE' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6" />
              <div>
                <p className="font-medium">•••• •••• •••• 4242</p>
                <p className="text-sm text-gray-600">Expires 12/25</p>
              </div>
            </div>
            <Button variant="outline">Update</Button>
          </div>
        </Card>
      )}

      {/* Invoice History (PRO only) */}
      {currentTier === 'PRO' && invoices && invoices.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Invoice History</h2>
          <div className="space-y-3">
            {invoices.map((invoice: any) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">${invoice.amount / 100}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(invoice.date).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

#### 9.3.5 Subscription Management Hooks

Create `hooks/use-subscription.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function useSubscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/subscription');
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return res.json();
    },
  });

  const upgradeToPro = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'PRO' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
      return data;
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to start upgrade process',
        variant: 'destructive',
      });
    },
  });

  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to cancel subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: 'Subscription cancelled successfully' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    },
  });

  return {
    subscription: subscription.data,
    isLoading: subscription.isLoading,
    upgradeToPro,
    cancelSubscription,
  };
}
```

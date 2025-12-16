### 9.4 SERVICE 4: Admin Dashboard

#### 9.4.1 Admin Dashboard Layout

Create `app/(dashboard)/admin/layout.tsx`:

```typescript
'use client';

import { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Users,
  BarChart3,
  DollarSign,
  Activity,
  AlertCircle,
  Settings
} from 'lucide-react';

const adminSections = [
  { name: 'Overview', href: '/admin', icon: BarChart3 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Revenue', href: '/admin/revenue', icon: DollarSign },
  { name: 'API Usage', href: '/admin/api-usage', icon: Activity },
  { name: 'Error Logs', href: '/admin/errors', icon: AlertCircle },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  // V5: Admin access based on role, not tier
  if (session?.user?.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="flex gap-6">
      <aside className="w-64 shrink-0">
        <div className="mb-6 px-4">
          <h2 className="text-lg font-bold">Admin Panel</h2>
          <p className="text-xs text-gray-500 mt-1">2-Tier System (FREE/PRO)</p>
        </div>
        <nav className="space-y-1">
          {adminSections.map((section) => {
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
        </nav>
      </aside>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
```

#### 9.4.2 Admin Dashboard Overview

Create `app/(dashboard)/admin/page.tsx`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Users, DollarSign, Activity, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/analytics');
      return res.json();
    }
  });

  const stats = [
    {
      name: 'Total Users',
      value: analytics?.totalUsers || 0,
      change: '+12%',
      icon: Users,
      color: 'bg-blue-500',
      breakdown: `FREE: ${analytics?.freeUsers || 0} | PRO: ${analytics?.proUsers || 0}`
    },
    {
      name: 'Revenue (MTD)',
      value: `$${analytics?.revenue || 0}`,
      change: '+8%',
      icon: DollarSign,
      color: 'bg-green-500',
      breakdown: `PRO: ${analytics?.proSubscriptions || 0} active`
    },
    {
      name: 'API Calls',
      value: analytics?.apiCalls || 0,
      change: '+23%',
      icon: Activity,
      color: 'bg-purple-500',
      breakdown: `Avg: ${analytics?.avgCallsPerUser || 0}/user`
    },
    {
      name: 'PRO Conversion',
      value: `${analytics?.conversionRate || 0}%`,
      change: '+5%',
      icon: TrendingUp,
      color: 'bg-orange-500',
      breakdown: `${analytics?.newProThisMonth || 0} new this month`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Badge variant="secondary">FREE Tier: {analytics?.freeUsers || 0}</Badge>
          <Badge variant="default">PRO Tier: {analytics?.proUsers || 0}</Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm text-green-600">{stat.change}</span>
              </div>
              <p className="text-sm text-gray-600">{stat.name}</p>
              <p className="text-2xl font-bold mt-2">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-2">{stat.breakdown}</p>
            </Card>
          );
        })}
      </div>

      {/* Tier Distribution */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Tier Distribution</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">FREE Tier</span>
              <span className="text-sm text-gray-600">
                {analytics?.freeUsers || 0} users ({analytics?.freePercentage || 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-500 h-2 rounded-full"
                style={{ width: `${analytics?.freePercentage || 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">PRO Tier</span>
              <span className="text-sm text-gray-600">
                {analytics?.proUsers || 0} users ({analytics?.proPercentage || 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${analytics?.proPercentage || 0}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {analytics?.recentActivity?.map((activity: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{activity.message}</p>
                <p className="text-xs text-gray-500">{activity.timestamp}</p>
              </div>
              {activity.tier && (
                <Badge variant={activity.tier === 'PRO' ? 'default' : 'secondary'}>
                  {activity.tier}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">User Growth (FREE vs PRO)</h2>
          {/* Add chart here showing FREE and PRO user growth over time */}
          <div className="h-64 flex items-center justify-center text-gray-400">
            Chart showing FREE vs PRO growth trends
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue Trend (PRO only)</h2>
          {/* Add chart here showing PRO subscription revenue */}
          <div className="h-64 flex items-center justify-center text-gray-400">
            Chart showing PRO subscription revenue
          </div>
        </Card>
      </div>
    </div>
  );
}
```

#### 9.4.3 Admin Users Management

Create `app/(dashboard)/admin/users/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Search, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'FREE' | 'PRO'>('ALL');
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', search, tierFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (tierFilter !== 'ALL') params.append('tier', tierFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      return res.json();
    }
  });

  const changeTier = useMutation({
    mutationFn: async ({ userId, newTier }: { userId: string; newTier: 'FREE' | 'PRO' }) => {
      const res = await fetch(`/api/admin/user/${userId}/tier`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier })
      });
      if (!res.ok) throw new Error('Failed to change tier');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/user/${userId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Total: {users?.total || 0}
          </Badge>
          <Badge variant="secondary">
            FREE: {users?.freeCount || 0}
          </Badge>
          <Badge variant="default">
            PRO: {users?.proCount || 0}
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={tierFilter} onValueChange={(value: any) => setTierFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Tiers</SelectItem>
            <SelectItem value="FREE">FREE Only</SelectItem>
            <SelectItem value="PRO">PRO Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              users?.data?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.tier === 'PRO' ? 'default' : 'secondary'}>
                      {user.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit User</DropdownMenuItem>
                        {user.tier === 'FREE' ? (
                          <DropdownMenuItem
                            onClick={() => changeTier.mutate({
                              userId: user.id,
                              newTier: 'PRO'
                            })}
                          >
                            Upgrade to PRO
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => changeTier.mutate({
                              userId: user.id,
                              newTier: 'FREE'
                            })}
                          >
                            Downgrade to FREE
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>Reset Password</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteUser.mutate(user.id)}
                        >
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### 9.5 SERVICE 5: E-commerce (Pricing & Plans)

#### 9.5.1 Pricing Plans Page (2-Tier System)

Create `app/(marketing)/pricing/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Zap, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// V5: Symbol access by tier
const TIER_SYMBOLS = {
  FREE: ['XAUUSD'],
  PRO: [
    'AUDUSD',
    'BTCUSD',
    'ETHUSD',
    'EURUSD',
    'GBPUSD',
    'NDX100',
    'US30',
    'USDJPY',
    'XAGUSD',
    'XAUUSD'
  ]
} as const;

const plans = [
  {
    name: 'Free',
    price: 0,
    billing: 'forever',
    description: 'Perfect for trying out our platform',
    icon: Zap,
    features: [
      '1 symbol: XAUUSD',
      '7 timeframes (M1, M5, M15, M30, H1, H4, D1)',
      'Basic alerts',
      'Real-time data from our MT5',
      'Community support',
      'Mobile web access'
    ],
    tier: 'FREE',
    highlight: false
  },
  {
    name: 'Pro',
    price: 29,
    billing: 'per month',
    description: 'For serious traders who need full market coverage',
    icon: Crown,
    features: [
      '10 symbols (see list below)',
      '7 timeframes per symbol',
      'Unlimited alerts',
      'All technical indicators',
      'Priority support',
      'Mobile app access',
      'Advanced charting',
      'Email & SMS alerts',
      'API access',
      'Custom watchlists'
    ],
    tier: 'PRO',
    highlight: true
  }
];

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  async function handleSubscribe(tier: string) {
    if (!session) {
      router.push('/register');
      return;
    }

    if (tier === 'FREE') {
      router.push('/dashboard');
      return;
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingCycle })
      });

      const { url } = await response.json();
      if (url) window.location.href = url;

    } catch (error) {
      console.error('Checkout error:', error);
    }
  }

  return (
    <div className="py-12 px-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Choose the plan that's right for you
        </p>
        <p className="text-sm text-gray-500">
          All data comes from our professional MT5 terminal
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const price = billingCycle === 'yearly' && plan.price > 0
            ? Math.floor(plan.price * 0.8)
            : plan.price;

          return (
            <Card
              key={plan.name}
              className={`p-8 ${
                plan.highlight
                  ? 'border-blue-500 border-2 shadow-2xl relative'
                  : 'shadow-lg'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-blue-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${
                  plan.highlight ? 'bg-blue-500' : 'bg-gray-500'
                }`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">${price}</span>
                <span className="text-gray-600">/{plan.billing}</span>
              </div>

              <Button
                onClick={() => handleSubscribe(plan.tier)}
                className="w-full mb-6"
                variant={plan.highlight ? 'default' : 'outline'}
              >
                {!session
                  ? 'Get Started'
                  : session.user.tier === plan.tier
                    ? 'Current Plan'
                    : plan.name === 'Free'
                      ? 'Switch to Free'
                      : 'Upgrade to Pro'}
              </Button>

              <div className="border-t pt-6">
                <p className="text-sm font-semibold mb-3">What's included:</p>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Symbol Comparison Table */}
      <div className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">
          Symbol Access Comparison
        </h2>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
            <div className="font-semibold">Symbol</div>
            <div className="font-semibold text-center">FREE</div>
            <div className="font-semibold text-center">PRO</div>
          </div>
          {TIER_SYMBOLS.PRO.map((symbol) => {
            const inFree = TIER_SYMBOLS.FREE.includes(symbol as any);
            return (
              <div
                key={symbol}
                className="grid grid-cols-3 gap-4 p-4 border-b last:border-0 items-center"
              >
                <div className="font-medium">{symbol}</div>
                <div className="text-center">
                  {inFree ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
                <div className="text-center">
                  <Check className="h-5 w-5 text-green-500 mx-auto" />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">
              Can I connect my own MT5 account?
            </h3>
            <p className="text-gray-600">
              No, this is a commercial SaaS platform. All data comes from our professional
              MT5 terminal, ensuring consistent, high-quality data for all users.
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2">
              What happens if I downgrade from PRO to FREE?
            </h3>
            <p className="text-gray-600">
              You'll lose access to 9 symbols and will only be able to track XAUUSD.
              Your alerts for other symbols will be paused but not deleted.
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2">
              How many timeframes can I use?
            </h3>
            <p className="text-gray-600">
              Both FREE and PRO tiers have access to all 7 timeframes (M1, M5, M15, M30, H1, H4, D1).
              The difference is in the number of symbols you can track.
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2">
              Can I cancel anytime?
            </h3>
            <p className="text-gray-600">
              Yes! PRO subscriptions can be cancelled at any time. You'll retain PRO access
              until the end of your billing period, then automatically switch to FREE.
            </p>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center mt-16">
        <h2 className="text-3xl font-bold mb-4">
          Ready to get started?
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Start with FREE, upgrade anytime
        </p>
        <Button
          size="lg"
          onClick={() => router.push('/register')}
        >
          Create Free Account
        </Button>
      </div>
    </div>
  );
}
```

#### 9.5.2 Checkout API Route

Create `app/api/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia', // V5: Updated Stripe API version
});

// V5: Only PRO tier has a price ID
const priceIds = {
  PRO: process.env.STRIPE_PRO_PRICE_ID!,
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier, billingCycle } = await request.json();

    // V5: Only allow checkout for PRO tier
    if (tier !== 'PRO') {
      return NextResponse.json(
        { error: 'Only PRO tier requires payment' },
        { status: 400 }
      );
    }

    // Check if user is already PRO
    if (session.user.tier === 'PRO') {
      return NextResponse.json(
        { error: 'Already subscribed to PRO' },
        { status: 400 }
      );
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: session.user.email,
      line_items: [
        {
          price: priceIds.PRO,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true&tier=PRO`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      metadata: {
        userId: session.user.id,
        tier: 'PRO',
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

#### 9.5.3 Subscription Webhook Handler

Create `app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId) {
          // Update user to PRO tier
          await prisma.user.update({
            where: { id: userId },
            data: {
              tier: 'PRO',
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            },
          });

          // Create subscription record
          await prisma.subscription.create({
            data: {
              userId,
              tier: 'PRO',
              status: 'ACTIVE',
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              stripePriceId: session.line_items?.data[0]?.price?.id!,
              stripeCurrentPeriodEnd: new Date(session.expires_at * 1000),
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status === 'active' ? 'ACTIVE' : 'CANCELLED',
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Downgrade user to FREE tier
        const sub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
          include: { user: true },
        });

        if (sub) {
          await prisma.user.update({
            where: { id: sub.userId },
            data: { tier: 'FREE' },
          });

          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: { status: 'CANCELLED' },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
```

#### 9.5.4 Tier Constants & Helpers

Create `lib/constants/tiers.ts`:

```typescript
// V5: 2-Tier System with Symbol Access

export const TIER_SYMBOLS = {
  FREE: ['XAUUSD'],
  PRO: [
    'AUDUSD',
    'BTCUSD',
    'ETHUSD',
    'EURUSD',
    'GBPUSD',
    'NDX100',
    'US30',
    'USDJPY',
    'XAGUSD',
    'XAUUSD',
  ],
} as const;

export const TIMEFRAMES = {
  M1: 'M1',
  M5: 'M5',
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H4: 'H4',
  D1: 'D1',
} as const;

export type UserTier = 'FREE' | 'PRO';
export type Symbol =
  | (typeof TIER_SYMBOLS.FREE)[number]
  | (typeof TIER_SYMBOLS.PRO)[number];
export type Timeframe = keyof typeof TIMEFRAMES;

// Helper functions
export function canAccessSymbol(tier: UserTier, symbol: string): boolean {
  return TIER_SYMBOLS[tier].includes(symbol as any);
}

export function canAccessCombination(
  tier: UserTier,
  symbol: string,
  timeframe: string
): boolean {
  return (
    TIER_SYMBOLS[tier].includes(symbol as any) &&
    Object.keys(TIMEFRAMES).includes(timeframe)
  );
}

export function getTierSymbols(tier: UserTier): readonly string[] {
  return TIER_SYMBOLS[tier];
}

export function getTierFeatures(tier: UserTier) {
  const features = {
    FREE: {
      symbols: 1,
      symbolList: ['XAUUSD'],
      timeframes: 7,
      alerts: 'Basic',
      support: 'Community',
      price: 0,
    },
    PRO: {
      symbols: 10,
      symbolList: TIER_SYMBOLS.PRO,
      timeframes: 7,
      alerts: 'Unlimited',
      support: 'Priority',
      price: 29,
    },
  };

  return features[tier];
}
```

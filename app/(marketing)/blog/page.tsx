import type { Metadata } from 'next';
import { Bell, LineChart, Wallet, Calendar } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Public Blog / Product Updates Page (B2-3)
 *
 * Static content page -- no CMS backs this list. Entries describe real,
 * already-shipped product capability rather than fabricated data, matching
 * the F64/6-1b precedent of not presenting invented figures as live facts.
 *
 * @module app/(marketing)/blog/page
 */

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Product updates and news from the Trading Alerts team.',
};

interface Post {
  icon: React.ComponentType<{ className?: string }>;
  date: string;
  category: string;
  title: string;
  excerpt: string;
}

const posts: Post[] = [
  {
    icon: Bell,
    date: 'August 2026',
    category: 'Product',
    title: 'Real-time alert delivery, end to end',
    excerpt:
      'Fired alerts now reach your browser the instant they trigger -- both as a notification-bell update and a live marker on your chart -- backed by a persistent real-time connection rather than a polling refresh.',
  },
  {
    icon: LineChart,
    title: 'Editing alerts without recreating them',
    date: 'August 2026',
    category: 'Product',
    excerpt:
      'You can now edit a price alert’s name and target value directly from the Alerts page instead of deleting and re-creating it -- the symbol, timeframe, and condition type stay locked to keep the alert’s evaluation logic consistent.',
  },
  {
    icon: Wallet,
    date: 'July 2026',
    category: 'Affiliate Program',
    title: 'International affiliate payouts, made simple',
    excerpt:
      'Affiliates outside the US can now receive commission payouts directly to their local bank account, with a dedicated payout status page showing every transfer from initiated through settled.',
  },
  {
    icon: LineChart,
    date: 'July 2026',
    category: 'Product',
    title: 'A single, unified dashboard for everything',
    excerpt:
      'Alerts, charts, settings, and affiliate tools now live behind one consistent navigation shell with a real 404 page and error boundary -- no more dead-end links.',
  },
];

export default function BlogPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Blog</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Product updates and news from the Trading Alerts team. For a
            complete, dated list of every change, see the{' '}
            <a
              href="/changelog"
              className="hover:text-primary/80 text-primary underline"
            >
              Changelog
            </a>
            .
          </p>
        </div>

        <div className="space-y-6">
          {posts.map((post) => {
            const Icon = post.icon;
            return (
              <Card key={post.title}>
                <CardContent className="p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <Badge variant="secondary">{post.category}</Badge>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      {post.date}
                    </span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
                      <Icon
                        className="h-4 w-4 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h2 className="mb-2 text-lg font-semibold text-foreground">
                        {post.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

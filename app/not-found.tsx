'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CompassIcon, HomeIcon, LayoutDashboardIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Global 404 page (Next.js App Router convention — rendered for any
 * unmatched route, or wherever notFound() is called from a Server
 * Component). Lives inside the root layout, so global chrome (fonts,
 * theming) still applies even though no page-level layout matched.
 */
export default function NotFound(): React.ReactElement {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-2 text-center">
        <CardContent className="flex flex-col items-center p-8">
          <div
            className="bg-primary/10 mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <CompassIcon className="h-8 w-8 text-primary" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Error 404
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            Page not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => router.back()} variant="outline">
              Go Back
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                <LayoutDashboardIcon className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/">
              <Button className="w-full">
                <HomeIcon className="h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { AlertOctagon, RefreshCw, Home, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
        <Card className="w-full max-w-md space-y-6 border-rose-500/30 bg-[#0a0d18]/95 p-6 text-center shadow-2xl backdrop-blur-2xl">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-400">
              <AlertOctagon className="h-8 w-8" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-100">
              System Error Encountered
            </h1>
            <p className="text-xs leading-relaxed text-slate-400">
              An unexpected application exception occurred. Our diagnostic
              telemetry has recorded this incident.
            </p>
            {error.digest && (
              <div className="pt-1">
                <span className="rounded border border-rose-500/30 bg-rose-950/60 px-2 py-0.5 font-mono text-[10px] text-rose-300">
                  Digest: {error.digest}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              onClick={() => reset()}
              className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <Link href="/" className="w-full">
              <Button
                variant="outline"
                className="w-full border-slate-800 bg-[#070912] text-slate-300 hover:bg-slate-800"
              >
                <Home className="mr-2 h-4 w-4" />
                Return to Safe Home
              </Button>
            </Link>
          </div>

          <p className="text-[11px] text-slate-500">
            If the problem persists, please{' '}
            <a
              href="mailto:support@davintrade.com"
              className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
            >
              contact support
            </a>
            .
          </p>
        </Card>
      </body>
    </html>
  );
}

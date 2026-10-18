/**
 * T3-d: the five heavy segments have their own error and loading boundaries.
 *
 * `error.tsx` sits beside the segment's `layout.tsx`, so a failure in the page
 * replaces only the page (the layout's navigation stays) instead of falling
 * through to the root `app/error.tsx`, which replaces the whole app. Like the
 * root boundary it never prints `error.message`, shows the digest, logs the
 * full error with it, and its button calls Next's `retry` (which refreshes the
 * route, so a failed server read runs again), not `reset`.
 */

import fs from 'fs';
import path from 'path';

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/lib/context/locale-context', () => ({
  __esModule: true,
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import AdminDashboardsError from '@/app/admin/dashboards/error';
import AdminDashboardsLoading from '@/app/admin/dashboards/loading';
import AffiliateDashboardError from '@/app/affiliate/dashboard/error';
import AffiliateDashboardLoading from '@/app/affiliate/dashboard/loading';
import FreeError from '@/app/free/error';
import FreeLoading from '@/app/free/loading';
import CurrencyIndexProError from '@/app/pro/currency-index/error';
import CurrencyIndexProLoading from '@/app/pro/currency-index/loading';
import TerminalError from '@/app/terminal/error';
import TerminalLoading from '@/app/terminal/loading';

type BoundaryError = Error & { digest?: string };
type ErrorBoundary = (props: {
  error: BoundaryError;
  retry: () => void;
}) => React.ReactElement;

interface Segment {
  name: string;
  dir: string;
  Error: ErrorBoundary;
  Loading: () => React.ReactElement;
  /** The segment's layout has no chrome, so its card links home. */
  homeLink: boolean;
}

const SEGMENTS: Segment[] = [
  {
    name: 'admin/dashboards',
    dir: 'app/admin/dashboards',
    Error: AdminDashboardsError,
    Loading: AdminDashboardsLoading,
    homeLink: false,
  },
  {
    name: 'affiliate/dashboard',
    dir: 'app/affiliate/dashboard',
    Error: AffiliateDashboardError,
    Loading: AffiliateDashboardLoading,
    homeLink: false,
  },
  {
    name: 'terminal',
    dir: 'app/terminal',
    Error: TerminalError,
    Loading: TerminalLoading,
    homeLink: true,
  },
  {
    name: 'free',
    dir: 'app/free',
    Error: FreeError,
    Loading: FreeLoading,
    homeLink: true,
  },
  {
    name: 'pro/currency-index',
    dir: 'app/pro/currency-index',
    Error: CurrencyIndexProError,
    Loading: CurrencyIndexProLoading,
    homeLink: true,
  },
];

const SECRET = 'ECONNREFUSED postgres://app:s3cret@10.0.0.5:5432/trading';

function serverError(digest?: string): BoundaryError {
  const error: BoundaryError = new Error(SECRET);
  if (digest) error.digest = digest;
  return error;
}

const ROOT = path.resolve(__dirname, '..', '..');

let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
    /* the boundaries log on purpose */
  });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe.each(SEGMENTS)('$name', ({ name, dir, Error, Loading, homeLink }) => {
  describe('files', () => {
    it('has an error.tsx and a loading.tsx beside its layout', () => {
      for (const file of ['layout.tsx', 'error.tsx', 'loading.tsx']) {
        expect(fs.existsSync(path.join(ROOT, dir, file))).toBe(true);
      }
    });

    it('declares error.tsx a Client Component (an error boundary must be one)', () => {
      const source = fs.readFileSync(path.join(ROOT, dir, 'error.tsx'), 'utf8');
      expect(source.trimStart().startsWith("'use client'")).toBe(true);
    });
  });

  describe('error.tsx', () => {
    it('shows the fixed sentence, not the error message', () => {
      render(<Error error={serverError('dg_4821')} retry={jest.fn()} />);

      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeTruthy();
      expect(document.body.textContent).not.toContain('s3cret');
      expect(document.body.textContent).not.toContain('ECONNREFUSED');
    });

    it('shows the digest so support can find the server log line', () => {
      render(<Error error={serverError('dg_4821')} retry={jest.fn()} />);

      expect(document.body.textContent).toContain('dg_4821');
    });

    it('shows no id line when there is no digest', () => {
      render(<Error error={serverError()} retry={jest.fn()} />);

      expect(document.body.textContent).not.toContain('Error ID:');
    });

    it('logs the full error with its digest and where it happened', () => {
      const error = serverError('dg_4821');

      render(<Error error={error} retry={jest.fn()} />);

      expect(consoleError).toHaveBeenCalledWith(
        `Segment error (${name}):`,
        error,
        { digest: 'dg_4821' }
      );
    });

    it("calls Next's retry when the trader presses Try again", () => {
      const retry = jest.fn();
      render(<Error error={serverError('dg_4821')} retry={retry} />);

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(retry).toHaveBeenCalledTimes(1);
    });

    it(`${homeLink ? 'links' : 'does not link'} home`, () => {
      render(<Error error={serverError('dg_4821')} retry={jest.fn()} />);

      const home = screen.queryByRole('link', { name: /homepage/i });
      if (homeLink) {
        expect(home?.getAttribute('href')).toBe('/');
      } else {
        expect(home).toBeNull();
      }
    });

    it('announces itself as an alert', () => {
      render(<Error error={serverError()} retry={jest.fn()} />);

      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  describe('loading.tsx', () => {
    it('renders a busy placeholder with no text of its own', () => {
      const { container } = render(<Loading />);

      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(container.textContent).toBe('');
    });
  });
});

describe('the retry the boundary calls', () => {
  it('is the one Next 16.4 passes to an error boundary, next to reset', () => {
    // The installed runtime hands both props to `error.tsx`; the card must use
    // `retry` (refresh + re-render). `reset` alone re-renders the cached
    // payload and would show the same server failure again.
    const boundary = fs.readFileSync(
      path.join(
        ROOT,
        'node_modules/next/dist/client/components/error-boundary.js'
      ),
      'utf8'
    );
    expect(boundary).toMatch(/retry:\s*this\.retry/);
    expect(boundary).toMatch(/reset:\s*this\.reset/);
    expect(boundary).toMatch(/this\.context\?\.refresh\(\)/);
  });
});

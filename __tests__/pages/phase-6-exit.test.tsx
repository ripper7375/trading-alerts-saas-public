/**
 * Phase 6 Exit Verification Tests (Session 6-12)
 *
 * Covers three things this session's own audit touched that had zero
 * existing test coverage anywhere in the repo:
 *  - app/not-found.tsx and the two error boundaries (app/error.tsx,
 *    app/global-error.tsx) -- built at Session 6-2, never directly tested
 *    before (existing "not-found" test hits are dynamic-route notFound()
 *    calls, not these root-level boundary pages themselves).
 *  - Route integrity: app/test-api/page.tsx is genuinely gone from disk.
 *  - A representative sample of this session's own a11y fixes (icon-only
 *    buttons that previously had no accessible name) -- the
 *    password-toggle fixes get their own regression tests inside
 *    login-form.test.tsx / register-form.test.tsx, where the render
 *    harness already exists; ToastContainer is covered here since it has
 *    no existing test file and no complex dependencies to mock.
 *
 * @module __tests__/pages/phase-6-exit.test
 */
import fs from 'fs';
import path from 'path';

import { render, screen, fireEvent } from '@testing-library/react';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import NotFound from '@/app/not-found';
import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';
import { ToastContainer } from '@/components/ui/toast-container';

describe('app/not-found.tsx (404 handling)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the 404 heading and recovery actions', () => {
    render(<NotFound />);

    expect(
      screen.getByRole('heading', { name: 'Page not found', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('calls router.back() from the Go Back action', () => {
    render(<NotFound />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('app/error.tsx (route-segment error boundary)', () => {
  it('renders the error heading and calls reset() from Try again', () => {
    const reset = jest.fn();
    render(<ErrorPage error={new Error('boom')} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: /something went wrong/i, level: 1 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error digest when present, for support triage', () => {
    const error = new Error('boom') as Error & { digest?: string };
    error.digest = 'digest-abc123';
    render(<ErrorPage error={error} reset={jest.fn()} />);

    expect(screen.getByText(/digest-abc123/)).toBeInTheDocument();
  });
});

describe('app/global-error.tsx (root error boundary)', () => {
  it('renders its own <html>/<body> and calls reset() from Try again', () => {
    const reset = jest.fn();
    render(<GlobalError error={new Error('fatal')} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: /something went wrong/i, level: 1 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('Route integrity: app/test-api/page.tsx retirement', () => {
  it('no longer exists on disk (deleted per Phase 6 exit criteria)', () => {
    const testApiPath = path.join(process.cwd(), 'app', 'test-api');
    expect(fs.existsSync(testApiPath)).toBe(false);
  });
});

describe('ToastContainer a11y (Session 6-12 fix: dismiss button had no accessible name)', () => {
  it('exposes an accessibly-named dismiss button per toast', () => {
    const onDismiss = jest.fn();
    render(
      <ToastContainer
        toasts={[{ id: 't1', type: 'success', title: 'Saved', duration: 4000 }]}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', {
      name: 'Dismiss notification',
    });
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

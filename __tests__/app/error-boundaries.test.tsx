/**
 * T2-d: the two error boundaries never print `error.message`.
 *
 * A server error that reaches a boundary can carry internals (a connection
 * string, a table name). The page shows a fixed, translated sentence plus the
 * `digest` (the id that ties it to the server log), and the full error goes to
 * the console together with the digest.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';

jest.mock('@/lib/context/locale-context', () => ({
  __esModule: true,
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';

const SECRET = 'ECONNREFUSED postgres://app:s3cret@10.0.0.5:5432/trading';

function serverError(digest?: string): Error & { digest?: string } {
  const error: Error & { digest?: string } = new Error(SECRET);
  if (digest) error.digest = digest;
  return error;
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
    /* the boundaries log on purpose */
  });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('app/error.tsx (route-segment boundary)', () => {
  it('shows the fixed sentence, not the error message', () => {
    render(<ErrorPage error={serverError('dg_4821')} reset={jest.fn()} />);

    expect(
      screen.getByText('An unexpected error occurred. Please try again.')
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('s3cret');
    expect(document.body.textContent).not.toContain('ECONNREFUSED');
  });

  it('shows the digest so support can find the server log line', () => {
    render(<ErrorPage error={serverError('dg_4821')} reset={jest.fn()} />);

    expect(document.body.textContent).toContain('dg_4821');
  });

  it('shows no id line when there is no digest', () => {
    render(<ErrorPage error={serverError()} reset={jest.fn()} />);

    expect(document.body.textContent).not.toContain('Error ID:');
  });

  it('logs the full error together with its digest', () => {
    const error = serverError('dg_4821');

    render(<ErrorPage error={error} reset={jest.fn()} />);

    expect(consoleError).toHaveBeenCalledWith('Application error:', error, {
      digest: 'dg_4821',
    });
  });
});

describe('app/global-error.tsx (root-layout boundary)', () => {
  // This page renders its own <html> and <body>: React takes those over as
  // the document's, so the text is read from the document, not the container.
  async function renderGlobal(error: Error & { digest?: string }) {
    await act(async () => {
      render(<GlobalError error={error} reset={jest.fn()} />);
    });
    return document.documentElement.textContent ?? '';
  }

  it('shows no part of the error message', async () => {
    const text = await renderGlobal(serverError('dg_9001'));

    // The page itself is there (so the checks below cannot pass on an empty read).
    expect(text).toContain('System Error Encountered');
    expect(text).not.toContain('s3cret');
    expect(text).not.toContain('ECONNREFUSED');
  });

  it('shows the digest', async () => {
    const text = await renderGlobal(serverError('dg_9001'));

    expect(text).toContain('dg_9001');
  });

  it('logs the full error together with its digest', async () => {
    const error = serverError('dg_9001');

    await act(async () => {
      render(<GlobalError error={error} reset={jest.fn()} />);
    });

    expect(consoleError).toHaveBeenCalledWith(
      'Global application error:',
      error,
      { digest: 'dg_9001' }
    );
  });
});

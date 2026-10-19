/**
 * Admin users list: the status column (F21).
 *
 * A soft-deleted account (the 24 h deletion worker stamped `deletedAt`) reads "deleted" with a grey
 * dot and its date as a tooltip, never as one of the admin's own suspensions (red).
 */
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/lib/context/locale-context', () => ({
  __esModule: true,
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    formatDate: (value: string | Date) =>
      `on ${new Date(value).toISOString().slice(0, 10)}`,
  }),
}));

jest.mock('@/components/admin/user-view-as/view-as-user-button', () => ({
  __esModule: true,
  default: () => null,
}));

import UsersPage from '@/app/admin/users/page';

const baseUser = {
  tier: 'FREE',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  alertCount: 0,
};

const deletedUser = {
  ...baseUser,
  id: 'u-del',
  name: 'Gone',
  email: 'gone@example.com',
  status: 'deleted',
  deletedAt: '2026-10-20T08:30:00.000Z',
};

const suspendedUser = {
  ...baseUser,
  id: 'u-sus',
  name: 'Held',
  email: 'held@example.com',
  status: 'suspended',
  deletedAt: null,
};

const activeUser = {
  ...baseUser,
  id: 'u-act',
  name: 'Live',
  email: 'live@example.com',
  status: 'active',
  deletedAt: null,
};

function respondWith(users: unknown[]): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      users,
      total: users.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    }),
  }) as unknown as typeof fetch;
}

describe('Admin users list: status column', () => {
  it('shows deleted, suspended and active users each with their own marker', async () => {
    respondWith([deletedUser, suspendedUser, activeUser]);

    const { container } = render(<UsersPage />);

    await waitFor(() =>
      expect(screen.getByText('gone@example.com')).toBeInTheDocument()
    );
    const dotOf = (label: string): string =>
      screen.getByText(label).previousElementSibling?.className ?? '';

    expect(dotOf('deleted')).toContain('bg-slate-400');
    expect(dotOf('deleted')).not.toContain('bg-red-500');
    expect(dotOf('suspended')).toContain('bg-red-500');
    expect(dotOf('active')).toContain('bg-emerald-500');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('gives the deleted status the deletion date as a tooltip, and the others none', async () => {
    respondWith([deletedUser, suspendedUser]);

    render(<UsersPage />);

    await waitFor(() =>
      expect(screen.getByText('deleted')).toBeInTheDocument()
    );
    expect(screen.getByText('deleted')).toHaveAttribute(
      'title',
      'on 2026-10-20'
    );
    expect(screen.getByText('suspended')).not.toHaveAttribute('title');
  });
});

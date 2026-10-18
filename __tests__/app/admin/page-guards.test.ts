/**
 * Source guard for Next.js remediation T1-e.
 *
 * `app/admin/layout.tsx` and the middleware check the role, but a page that
 * reads data must not rely on them (layouts and pages render in parallel). Each
 * of the eight Server Component pages below must import `requireAdminPage`
 * from '@/lib/auth/session' and make `await requireAdminPage();` the first
 * statement of its default export, before any other await (searchParams,
 * params, a data read).
 *
 * The behaviour of the guard itself is in __tests__/lib/auth/
 * require-admin-page.test.ts; the pages' own tests assert that nothing is read
 * when it redirects.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ADMIN_RSC_PAGES = [
  'app/admin/dashboards/affiliates/page.tsx',
  'app/admin/dashboards/executive/page.tsx',
  'app/admin/dashboards/regional/page.tsx',
  'app/admin/dashboards/revenue/page.tsx',
  'app/admin/dashboards/users/page.tsx',
  'app/admin/system/config-history/page.tsx',
  'app/admin/system/outbox/page.tsx',
  'app/admin/users/[id]/page.tsx',
];

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('admin Server Component pages call requireAdminPage() first', () => {
  it.each(ADMIN_RSC_PAGES)('%s', (page) => {
    const text = source(page);

    expect(text).toMatch(
      /import \{ requireAdminPage \} from '@\/lib\/auth\/session';/
    );
    // `export default async function Name(<params>): Promise<React.ReactElement> {`
    // followed directly by the guard, ahead of every other statement
    expect(text).toMatch(
      /export default async function \w+\([\s\S]*?\): Promise<React\.ReactElement> \{\s*await requireAdminPage\(\);/
    );
    expect(text.match(/requireAdminPage\(\)/g)).toHaveLength(1);
  });

  it('none of the eight is a Client Component (a guard there would be bypassable)', () => {
    for (const page of ADMIN_RSC_PAGES) {
      expect(source(page).slice(0, 200)).not.toMatch(/['"]use client['"]/);
    }
  });
});

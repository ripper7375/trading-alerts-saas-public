/**
 * Source guard for Next.js remediation T2-a.
 *
 * Every layout and page below used to call `getServerSession(authOptions)`
 * itself, so one request decrypted the JWE once per layout and once more in the
 * page. They now read the session through `getSession()` from
 * '@/lib/auth/session', which is wrapped in React.cache() (the de-duplication
 * itself is exercised in __tests__/lib/react-cache-dedupe.test.ts). A new
 * direct `getServerSession` call in one of them would silently bring the extra
 * decryption back.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SESSION_CONSUMERS = [
  'app/admin/disbursement/layout.tsx',
  'app/admin/layout.tsx',
  'app/alerts/layout.tsx',
  'app/dashboard/layout.tsx',
  'app/dashboard/page.tsx',
  'app/free/layout.tsx',
  'app/free/page.tsx',
  'app/notifications/layout.tsx',
  'app/pro/currency-index/compare/page.tsx',
  'app/pro/currency-index/layout.tsx',
  'app/pro/currency-index/page.tsx',
  'app/settings/layout.tsx',
  'app/terminal/layout.tsx',
  'app/terminal/page.tsx',
];

/** Module path -> exports that must be the result of cache(...). */
const CACHED_EXPORTS: Record<string, string[]> = {
  'lib/auth/session.ts': [
    'getSession',
    'getAffiliateProfile',
    'requireAdminPage',
  ],
  'lib/appearance/server-appearance.ts': ['getServerAppearance'],
  'lib/i18n/server-locale.ts': [
    'getServerLanguage',
    'getServerLocalePreferences',
  ],
  'lib/affiliate/view-as.ts': ['getAdminViewAs'],
  'lib/admin/user-view-as.ts': ['loadUserViewAsTarget'],
  'lib/tutorials/service.ts': ['getPublishedTutorialById'],
};

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('layouts and pages read the session through the cached getSession()', () => {
  it.each(SESSION_CONSUMERS)('%s', (file) => {
    const text = source(file);

    expect(text).toMatch(
      /import \{ getSession \} from '@\/lib\/auth\/session';/
    );
    expect(text.match(/await getSession\(\)/g)).toHaveLength(1);
    expect(text).not.toMatch(/getServerSession/);
    expect(text).not.toMatch(/authOptions/);
    expect(text).not.toMatch(/from 'next-auth'/);
  });
});

describe('the request-scoped readers are wrapped in React.cache()', () => {
  it.each(
    Object.entries(CACHED_EXPORTS).flatMap(([file, names]) =>
      names.map((name) => [file, name] as const)
    )
  )('%s exports %s = cache(...)', (file, name) => {
    const text = source(file);

    expect(text).toMatch(/import \{[^}]*\bcache\b[^}]*\} from 'react';/);
    expect(text).toMatch(new RegExp(`export const ${name} = cache\\(`));
  });

  it('getAdminUserViewAs stays an uncached wrapper (its argument is an object, which cache() compares by reference)', () => {
    const text = source('lib/admin/user-view-as.ts');

    expect(text).toMatch(/export async function getAdminUserViewAs\(/);
    expect(text).not.toMatch(/export const getAdminUserViewAs = cache\(/);
  });
});

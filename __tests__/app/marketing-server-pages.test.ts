/**
 * T3-b: the marketing pages are Server Components. A `'use client'` page ships
 * its markup and its copy as JavaScript, so this reads the sources: no page in
 * the list may carry the directive or reach for a browser hook, each that
 * writes text asks the server for its translator, and what does need the
 * browser lives in a leaf module that says so.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const read = (file: string): string =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

/** Pages that write text: they ask the server for it. */
const TEXT_PAGES = [
  'app/(marketing)/about/page.tsx',
  'app/(marketing)/careers/page.tsx',
  'app/(marketing)/changelog/page.tsx',
  'app/(marketing)/disclaimer/page.tsx',
  'app/(marketing)/privacy/page.tsx',
  'app/(marketing)/terms/page.tsx',
  'app/affiliate/join/page.tsx',
  'app/(marketing)/blog/page.tsx',
  'app/(marketing)/docs/page.tsx',
  'app/(marketing)/econ-news/page.tsx',
  'app/(marketing)/help/page.tsx',
  'app/(marketing)/xaux-vs-usdx/page.tsx',
  'app/affiliate/page.tsx',
];

/** The page that is only a frame around one client component. */
const FRAME_PAGES = ['app/(marketing)/pricing/page.tsx'];

const BROWSER_HOOKS =
  /\b(useState|useEffect|useLayoutEffect|useMemo|useCallback|useRef|useReducer|useLocale|useSession|useRouter|usePathname|useSearchParams|useAffiliateConfig)\b/;

describe.each([...TEXT_PAGES, ...FRAME_PAGES])('%s', (file) => {
  const source = read(file);

  it("is not a 'use client' module", () => {
    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('calls no browser hook and imports no client locale context', () => {
    expect(source).not.toMatch(BROWSER_HOOKS);
    expect(source).not.toMatch(/@\/lib\/context\/locale-context/);
  });
});

describe.each(TEXT_PAGES)('%s writes its text on the server', (file) => {
  const source = read(file);

  it('is an async page that asks for the server translator', () => {
    expect(source).toMatch(/export default async function \w+\(/);
    expect(source).toMatch(
      /await (getServerTranslator|getServerLocaleTools)\(\)/
    );
    expect(source).toMatch(/@\/lib\/i18n\/server-translator/);
  });
});

/** Leaves: the parts of those pages that need the browser. */
const CLIENT_LEAVES = [
  'components/affiliate/affiliate-landing-leaves.tsx',
  'components/affiliate/commission-percent-text.tsx',
  'components/marketing/blog-browser.tsx',
  'components/marketing/docs-browser.tsx',
  'components/marketing/econ-news-filters.tsx',
  'components/marketing/help-search-box.tsx',
  'components/market/xaux-usdx-workspace.tsx',
];

describe.each(CLIENT_LEAVES)('%s', (file) => {
  it("is a 'use client' module", () => {
    expect(read(file).trimStart()).toMatch(/^'use client';/);
  });
});

/**
 * A server page reads values (not only components) from these: they carry no
 * directive, because a value exported from a 'use client' module reaches a
 * Server Component as a reference, not as the value.
 */
const PLAIN_MODULES = [
  'components/marketing/blog-categories.ts',
  'components/marketing/econ-news-presets.ts',
];

describe.each(PLAIN_MODULES)('%s', (file) => {
  it("is not a 'use client' module", () => {
    // The directive is the first statement; a comment may mention it.
    const withoutComments = read(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/['"]use client['"]/);
  });
});

describe('the landing page', () => {
  const source = read('app/(marketing)/page.tsx');

  it('puts only the pricing section behind Suspense', () => {
    const boundaries = source.match(/<Suspense\b[\s\S]*?<\/Suspense>/g) ?? [];
    expect(boundaries).toHaveLength(1);
    const inside = boundaries[0] ?? '';
    expect(inside).toContain('<LandingPricing />');
    expect(inside).not.toContain('<LandingHero');
    expect(inside).not.toContain('<LandingFeatures');
    expect(inside).not.toContain('<TickerTape');
  });

  it('renders the hero and the features outside any boundary', () => {
    const outside = source.replace(/<Suspense\b[\s\S]*?<\/Suspense>/g, '');
    expect(outside).toContain('<LandingHero />');
    expect(outside).toContain('<LandingFeatures />');
    expect(outside).toContain('<TickerTape />');
  });
});

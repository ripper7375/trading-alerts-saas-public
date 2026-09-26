/**
 * @jest-environment node
 */
/**
 * Guard: admin-configurable business figures must come from SystemConfig.
 *
 * The PRO price, the 3-day price, the affiliate discount and commission
 * percentages, codes per month and the payout minimum are set by the admin
 * (/admin/settings/affiliate and /admin/disbursement/settings) and change
 * without a deploy. A figure written into source or into a translation stays
 * behind when the admin changes it: pages, emails and charges then disagree
 * with the setting (found 2026-09-26: dLocal charged a fixed $29, /docs
 * promised 30% commission while 20% was configured, affiliates received a
 * fixed 15 codes). Read them with getAffiliateConfigFromDB()/getBasePriceUsd()
 * (lib/affiliate/db) on the server, useAffiliateConfig() in the browser, or
 * AffiliateConfigService in money-service, and put {percent}/{price}/{count}
 * placeholders in dictionary text.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks', 'money-service/src'];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), {
      withFileTypes: true,
    })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (!/node_modules|__tests__|dictionaries/.test(rel)) walk(rel);
      } else if (
        /\.tsx?$/.test(e.name) &&
        !/\.(test|spec)\.tsx?$/.test(e.name)
      ) {
        out.push(rel);
      }
    }
  };
  SOURCE_DIRS.forEach(walk);
  return out;
}

/** Source lines without comments (JSDoc, // and block-comment lines). */
function codeLines(file: string): Array<[number, string]> {
  return fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .map((line, i): [number, string] => [i + 1, line])
    .filter(([, line]) => !/^\s*(\*|\/\/|\/\*)/.test(line));
}

const FILES = sourceFiles();

/** Where the defaults themselves are defined (fallbacks for a failed read). */
const DEFAULT_DEFINITIONS = new Set([
  'lib/affiliate/constants.ts',
  'lib/affiliate/db.ts',
  'lib/affiliate/commission-calculator.ts',
  'lib/dlocal/constants.ts',
  // Browser fallback shown until /api/config/affiliate answers
  'lib/hooks/useAffiliateConfig.ts',
  'money-service/src/affiliate/affiliate.constants.ts',
  'money-service/src/affiliate/affiliate-config.service.ts',
  'money-service/src/affiliate/commission-calculator.ts',
  'money-service/src/dlocal/dlocal.constants.ts',
]);

function offenders(pattern: RegExp, allow: Set<string> = new Set()): string[] {
  const hits: string[] = [];
  for (const file of FILES) {
    if (allow.has(file)) continue;
    for (const [n, line] of codeLines(file)) {
      if (pattern.test(line)) hits.push(`${file}:${n}: ${line.trim()}`);
    }
  }
  return hits;
}

describe('SystemConfig figures are never hardcoded', () => {
  it('finds the source tree', () => {
    expect(FILES.length).toBeGreaterThan(500);
    expect(FILES).toContain('app/api/payments/dlocal/create/route.ts');
    expect(FILES).toContain(
      'money-service/src/dlocal/dlocal-payment.controller.ts'
    );
  });

  it('no user-facing text states a price or a discount/commission rate', () => {
    const figure = new RegExp(
      [
        String.raw`\$\s?(29|49|290|490|50|75|1\.99|23\.20|5\.80|4\.64)(\.00)?\b`,
        String.raw`\b(10|15|20|25|30)\s?%\s?(off|discount|commission|recurring|revshare|lifetime|monthly|share)`,
        String.raw`\b(commission|discount)\s?\(?(10|20|25|30)\s?%`,
        String.raw`SAVE \d+%`,
      ].join('|'),
      'i'
    );
    expect(offenders(figure)).toEqual([]);
  });

  it('charge, email and display code reads prices from SystemConfig, not the static defaults', () => {
    const staticDefault =
      /PRICING\.(MONTHLY_USD|THREE_DAY_USD)|AFFILIATE_CONFIG\.(DISCOUNT_PERCENT|COMMISSION_PERCENT|BASE_PRICE_USD|CODES_PER_MONTH)/;
    expect(offenders(staticDefault, DEFAULT_DEFINITIONS)).toEqual([]);
  });

  it('no price is assigned as a number literal', () => {
    // e.g. `amountUsd = 29`, `const PRO_MONTHLY_PRICE = 29`, `? 290 : 29`
    const literalPrice =
      /\b(amount\w*|\w*[Pp]rice\w*|PRICE\w*)\s*(:\s*number\s*)?[=:]\s*(29|49|290|1\.99)(\.0+)?\b|\?\s*290\s*:\s*29\b/;
    const allow = new Set([
      ...DEFAULT_DEFINITIONS,
      // The shared catalog default, documented as "not the live price"
      'lib/tier-config.ts',
      // Admin settings form: initial state until the saved values load
      'app/admin/settings/affiliate/page.tsx',
      // Test-mode mock status only (NODE_ENV=test / no API key)
      'lib/dlocal/dlocal-payment.service.ts',
      'money-service/src/dlocal/dlocal-payment.service.ts',
      // Seed route for local test data
      'app/api/test/seed/route.ts',
    ]);
    expect(offenders(literalPrice, allow)).toEqual([]);
  });

  it('the retired NEXT_PUBLIC_PRO_PRICE_* env price is not read again', () => {
    expect(offenders(/process\.env\[?['".]?NEXT_PUBLIC_PRO_PRICE/)).toEqual([]);
  });

  it('no dictionary text states a business figure (placeholders instead)', () => {
    const en = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'lib/i18n/dictionaries/en-GB.json'),
        'utf8'
      )
    ) as Record<string, string>;
    const figure = /(\$\s?\d|\d+(\.\d+)?\s?%|%\s?\d)/;
    const business =
      /(commission|discount|off\b|payout|threshold|price|pro\b|\/mo|annual|monthly|revshare|share|pool|save|earn|promo|minimum|renewal|referr|subscri|charge|billed)/i;
    // Figures that are not SystemConfig settings: sample XAUUSD alert
    // prices, alert tolerance, VAT, a mock dashboard metric.
    const allow = new Set([
      '82% PRO Conversion',
      'Price < $2,634.50',
      'Price = $2,634.50',
      'Price > $2,648.00',
      'Price > $2,648.50',
      'XAUUSD Price > $2,648.50',
      'alerts.condition_equals_desc',
      'alerts.equals_tolerance_note',
      'billing.reverse_charge',
    ]);
    const hits = Object.entries(en)
      .filter(([k, v]) => !allow.has(k) && figure.test(v) && business.test(v))
      .map(([k, v]) => `${JSON.stringify(k)} => ${v}`);
    expect(hits).toEqual([]);
  });
});

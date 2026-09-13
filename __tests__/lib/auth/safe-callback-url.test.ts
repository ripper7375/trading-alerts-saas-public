import { describe, it, expect } from '@jest/globals';

import {
  DEFAULT_POST_LOGIN_PATH,
  safeCallbackUrl,
} from '@/lib/auth/safe-callback-url';

describe('safeCallbackUrl', () => {
  it.each([
    ['/pro/currency-index/compare', '/pro/currency-index/compare'],
    ['/alerts?tab=active#row-3', '/alerts?tab=active#row-3'],
    ['/dashboard', '/dashboard'],
    // URL-encoded characters stay encoded, and stay on this site.
    ['/search?q=a%20b', '/search?q=a%20b'],
  ])('accepts same-site path %s', (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    ['missing', null],
    ['undefined', undefined],
    ['empty', ''],
    ['absolute https', 'https://evil.example/pro'],
    ['absolute same-looking host', 'https://davintrade.app.evil.example/'],
    ['protocol-relative', '//evil.example/path'],
    ['backslash protocol-relative', '/\\evil.example'],
    ['backslash later in the path', '/pro\\..\\..\\evil'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,hi'],
    ['relative without a slash', 'dashboard'],
    ['tab smuggling', '/\t/evil.example'],
    ['newline smuggling', '/\n/evil.example'],
    ['embedded space', '/ /evil.example'],
    ['loop back to login', '/login'],
    ['loop back to login with query', '/login?callbackUrl=%2Fdashboard'],
    ['loop to register', '/register'],
    ['loop to verify-2fa', '/verify-2fa?token=x'],
    ['absurdly long', `/${'a'.repeat(3000)}`],
  ])('rejects %s', (_label, input) => {
    expect(safeCallbackUrl(input as string | null | undefined)).toBe(
      DEFAULT_POST_LOGIN_PATH
    );
  });

  it('does not treat a path that merely starts with an auth page name as a loop', () => {
    expect(safeCallbackUrl('/login-help')).toBe('/login-help');
  });

  it('uses the caller-supplied fallback', () => {
    expect(safeCallbackUrl('https://evil.example', '/free')).toBe('/free');
  });
});

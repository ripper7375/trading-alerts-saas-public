/**
 * @jest-environment node
 */
/**
 * Which language an e-mail to one person is written in (the monolith side):
 * what they saved in Settings, then the request that triggered the mail, then
 * English. And the one-time capture of a signed-in browser's language.
 */
const mockCookies = jest.fn();
const mockHeaders = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
}));

const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userPreferences: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

import {
  emailLocaleForRecipient,
  rememberAccountLocaleIfAbsent,
  requestEmailLocaleHint,
} from '@/lib/email/recipient-locale';

function request(
  cookieValues: Record<string, string>,
  headerValues: Record<string, string> = {}
): void {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name in cookieValues ? { value: cookieValues[name] } : undefined,
  });
  mockHeaders.mockResolvedValue({
    get: (name: string) => headerValues[name] ?? null,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockFindFirst.mockResolvedValue(null);
  mockFindUnique.mockResolvedValue(null);
  mockUpsert.mockResolvedValue({});
  mockCookies.mockRejectedValue(new Error('outside a request'));
  mockHeaders.mockRejectedValue(new Error('outside a request'));
});

describe('requestEmailLocaleHint', () => {
  it('reads the locale cookies and the IP-derived timezone of the request', async () => {
    request(
      { 'davintrade-locale': 'th', 'davintrade-formats': 'DMY.24h' },
      { 'x-vercel-ip-timezone': 'Asia/Bangkok' }
    );
    await expect(requestEmailLocaleHint()).resolves.toEqual({
      language: 'th',
      timezone: 'Asia/Bangkok',
      dateFormat: 'DMY',
      timeFormat: '24h',
    });
  });

  it('prefers a timezone the user pinned over the detected one', async () => {
    request(
      { 'davintrade-timezone': 'Europe/Paris' },
      { 'x-vercel-ip-timezone': 'Asia/Bangkok' }
    );
    expect((await requestEmailLocaleHint()).timezone).toBe('Europe/Paris');
  });

  it('is empty outside a request (a webhook retry, a cron, a test)', async () => {
    await expect(requestEmailLocaleHint()).resolves.toEqual({});
  });
});

describe('emailLocaleForRecipient', () => {
  it('is English and UTC for someone nothing is known about', async () => {
    await expect(emailLocaleForRecipient('new@user.test')).resolves.toEqual({
      language: 'en-US',
    });
  });

  it('uses what the person saved in Settings', async () => {
    mockFindFirst.mockResolvedValue({
      preferences: {
        language: 'ja',
        timezone: 'Asia/Tokyo',
        dateFormat: 'YMD',
        timeFormat: '24h',
        theme: 'dark',
      },
    });
    await expect(emailLocaleForRecipient('a@b.test')).resolves.toEqual({
      language: 'ja',
      timezone: 'Asia/Tokyo',
      dateFormat: 'YMD',
      timeFormat: '24h',
    });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { user: { email: 'a@b.test' } },
      select: { preferences: true },
    });
  });

  it('lets the saved choice win over the browser that triggered the mail', async () => {
    mockFindFirst.mockResolvedValue({ preferences: { language: 'th' } });
    request({ 'davintrade-locale': 'de' });
    expect((await emailLocaleForRecipient('a@b.test')).language).toBe('th');
  });

  it('lets the request fill what was never saved', async () => {
    mockFindFirst.mockResolvedValue({ preferences: { language: 'th' } });
    request(
      { 'davintrade-formats': 'MDY.12h' },
      { 'x-vercel-ip-timezone': 'Asia/Bangkok' }
    );
    await expect(emailLocaleForRecipient('a@b.test')).resolves.toEqual({
      language: 'th',
      timezone: 'Asia/Bangkok',
      dateFormat: 'MDY',
      timeFormat: '12h',
    });
  });

  it('writes in the language of the request for someone with no saved choice', async () => {
    request({ 'davintrade-locale': 'ko' });
    expect((await emailLocaleForRecipient('a@b.test')).language).toBe('ko');
  });

  it('ignores a stored value that is not a language the app has', async () => {
    mockFindFirst.mockResolvedValue({ preferences: { language: 'klingon' } });
    request({ 'davintrade-locale': 'it' });
    expect((await emailLocaleForRecipient('a@b.test')).language).toBe('it');
  });

  it('still answers when the database does not', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));
    request({ 'davintrade-locale': 'fr' });
    expect((await emailLocaleForRecipient('a@b.test')).language).toBe('fr');
  });
});

describe('rememberAccountLocaleIfAbsent', () => {
  it("saves the browser's language, formats and timezone for an account with none", async () => {
    request(
      { 'davintrade-locale': 'th', 'davintrade-formats': 'DMY.24h' },
      { 'x-vercel-ip-timezone': 'Asia/Bangkok' }
    );
    await rememberAccountLocaleIfAbsent('user-1');
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        preferences: {
          language: 'th',
          dateFormat: 'DMY',
          timeFormat: '24h',
          timezone: 'Asia/Bangkok',
        },
      },
      update: {
        preferences: {
          language: 'th',
          dateFormat: 'DMY',
          timeFormat: '24h',
          timezone: 'Asia/Bangkok',
        },
      },
    });
  });

  it('keeps everything else already stored', async () => {
    mockFindUnique.mockResolvedValue({
      preferences: { theme: 'dark', timezone: 'Europe/Rome' },
    });
    request(
      { 'davintrade-locale': 'it' },
      { 'x-vercel-ip-timezone': 'Asia/Bangkok' }
    );
    await rememberAccountLocaleIfAbsent('user-1');
    expect(mockUpsert.mock.calls[0]?.[0].update.preferences).toEqual({
      theme: 'dark',
      timezone: 'Europe/Rome',
      language: 'it',
    });
  });

  it('never replaces a language the account already saved', async () => {
    mockFindUnique.mockResolvedValue({ preferences: { language: 'de' } });
    request({ 'davintrade-locale': 'th' });
    await rememberAccountLocaleIfAbsent('user-1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves nothing when the request carried no language of its own', async () => {
    request({}, { 'x-vercel-ip-timezone': 'Asia/Bangkok' });
    await rememberAccountLocaleIfAbsent('user-1');
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves nothing for a cookie that is not a language', async () => {
    request({ 'davintrade-locale': 'klingon' });
    await rememberAccountLocaleIfAbsent('user-1');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('never throws: a sign-in must not fail over a language', async () => {
    request({ 'davintrade-locale': 'th' });
    mockFindUnique.mockRejectedValue(new Error('db down'));
    await expect(
      rememberAccountLocaleIfAbsent('user-1')
    ).resolves.toBeUndefined();
  });
});

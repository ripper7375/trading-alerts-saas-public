import { EmailLocaleContextMiddleware } from './email-locale.context';
import { EmailLocaleService } from './email-locale.service';
import { localeFor, setRecipientLocaleResolver } from './recipient-locale';

function makeService(opts: {
  user?: { id: string } | null;
  preferences?: Record<string, unknown> | null;
  fail?: boolean;
}) {
  const findUser = jest.fn();
  const findPreferences = jest.fn();
  if (opts.fail) {
    findUser.mockRejectedValue(new Error('db down'));
  } else {
    findUser.mockResolvedValue(
      opts.user === undefined ? { id: 'u1' } : opts.user
    );
    findPreferences.mockResolvedValue(
      opts.preferences ? { preferences: opts.preferences } : null
    );
  }
  const prisma = {
    user: { findUnique: findUser },
    userPreferences: { findUnique: findPreferences },
  };
  const service = new EmailLocaleService(prisma as never);
  return { service, findUser, findPreferences };
}

/** Runs `fn` as a request that carried these forwarded headers. */
function inRequest<T>(
  headers: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const middleware = new EmailLocaleContextMiddleware();
  return new Promise<T>((resolve, reject) => {
    middleware.use(
      { header: (name: string) => headers[name] } as never,
      {} as never,
      () => {
        fn().then(resolve, reject);
      }
    );
  });
}

afterEach(() => {
  setRecipientLocaleResolver(null);
  jest.restoreAllMocks();
});

describe('EmailLocaleService.forRecipient', () => {
  it('is English and UTC for someone nothing is known about', async () => {
    const { service } = makeService({ user: null });
    await expect(service.forRecipient('new@user.test')).resolves.toEqual({
      language: 'en-US',
    });
  });

  it('uses what the person saved in Settings', async () => {
    const { service, findUser, findPreferences } = makeService({
      preferences: {
        language: 'ja',
        timezone: 'Asia/Tokyo',
        dateFormat: 'YMD',
        timeFormat: '24h',
        theme: 'dark',
      },
    });
    await expect(service.forRecipient('a@b.test')).resolves.toEqual({
      language: 'ja',
      timezone: 'Asia/Tokyo',
      dateFormat: 'YMD',
      timeFormat: '24h',
    });
    // the user lookup selects only the id (the shared User table has columns
    // this service's schema does not know)
    expect(findUser).toHaveBeenCalledWith({
      where: { email: 'a@b.test' },
      select: { id: true },
    });
    expect(findPreferences).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { preferences: true },
    });
  });

  it('writes in the language of the forwarded request for someone with none saved', async () => {
    const { service } = makeService({ user: null });
    const locale = await inRequest(
      {
        'x-email-language': 'de',
        'x-email-formats': 'DMY.24h',
        'x-email-timezone': 'Europe/Berlin',
      },
      () => service.forRecipient('new@user.test')
    );
    expect(locale).toEqual({
      language: 'de',
      timezone: 'Europe/Berlin',
      dateFormat: 'DMY',
      timeFormat: '24h',
    });
  });

  it('lets the saved choice win over the browser that triggered the mail', async () => {
    const { service } = makeService({ preferences: { language: 'th' } });
    const locale = await inRequest({ 'x-email-language': 'de' }, () =>
      service.forRecipient('a@b.test')
    );
    expect(locale.language).toBe('th');
  });

  it('lets the request fill what was never saved', async () => {
    const { service } = makeService({ preferences: { language: 'th' } });
    const locale = await inRequest(
      { 'x-email-formats': 'MDY.12h', 'x-email-timezone': 'Asia/Bangkok' },
      () => service.forRecipient('a@b.test')
    );
    expect(locale).toEqual({
      language: 'th',
      timezone: 'Asia/Bangkok',
      dateFormat: 'MDY',
      timeFormat: '12h',
    });
  });

  it('refuses a forwarded value that is not a locale', async () => {
    const { service } = makeService({ user: null });
    const locale = await inRequest(
      {
        'x-email-language': 'th\r\nx-evil: 1',
        'x-email-timezone': '<script>',
        'x-email-formats': 'XYZ.99h',
      },
      () => service.forRecipient('a@b.test')
    );
    expect(locale).toEqual({ language: 'en-US' });
  });

  it("keeps one request's hint out of the next", async () => {
    const { service } = makeService({ user: null });
    await inRequest({ 'x-email-language': 'de' }, () =>
      service.forRecipient('a@b.test')
    );
    await expect(service.forRecipient('a@b.test')).resolves.toEqual({
      language: 'en-US',
    });
  });

  it('still answers when the database does not', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service } = makeService({ fail: true });
    const locale = await inRequest({ 'x-email-language': 'fr' }, () =>
      service.forRecipient('a@b.test')
    );
    expect(locale.language).toBe('fr');
  });
});

describe('the resolver registered at start-up', () => {
  it('is English until the service is initialised', async () => {
    await expect(localeFor('a@b.test', undefined)).resolves.toEqual({
      language: 'en-US',
    });
  });

  it('is what the senders ask once it is', async () => {
    const { service } = makeService({ preferences: { language: 'ko' } });
    service.onModuleInit();
    await expect(localeFor('a@b.test', undefined)).resolves.toMatchObject({
      language: 'ko',
    });
  });

  it('never overrides a locale the caller passed', async () => {
    const { service, findUser } = makeService({
      preferences: { language: 'ko' },
    });
    service.onModuleInit();
    await expect(localeFor('a@b.test', { language: 'it' })).resolves.toEqual({
      language: 'it',
    });
    expect(findUser).not.toHaveBeenCalled();
  });

  it('falls back to English if the resolver throws', async () => {
    setRecipientLocaleResolver(() => Promise.reject(new Error('boom')));
    await expect(localeFor('a@b.test', undefined)).resolves.toEqual({
      language: 'en-US',
    });
  });
});

import {
  getAccountDeletionEmail,
  sendAccountDeletionEmail,
} from './email.util';

describe('account deletion email', () => {
  const confirmUrl =
    'https://app.example.test/settings/account/delete/confirm?token=abc123';
  const cancelUrl =
    'https://app.example.test/settings/account/delete/cancel?token=abc123';
  const expiresAt = new Date('2026-10-23T09:30:00.000Z');

  describe('getAccountDeletionEmail', () => {
    it('carries the confirm link, the cancel link and the expiry in UTC', () => {
      const html = getAccountDeletionEmail(
        'Alice',
        confirmUrl,
        cancelUrl,
        expiresAt
      );

      expect(html).toContain(`href="${confirmUrl}"`);
      expect(html).toContain(`href="${cancelUrl}"`);
      expect(html).toContain('Hi Alice');
      expect(html).toContain('October 23, 2026');
      expect(html).toContain('UTC');
    });

    it('escapes the name and the links', () => {
      const html = getAccountDeletionEmail(
        '<script>alert(1)</script>',
        'https://app.example.test/x?a=1&b="2"',
        cancelUrl,
        expiresAt
      );

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).toContain('a=1&amp;b=&quot;2&quot;');
    });
  });

  describe('sendAccountDeletionEmail', () => {
    const originalKey = process.env['RESEND_API_KEY'];
    const originalEnv = process.env['NODE_ENV'];

    afterEach(() => {
      if (originalKey === undefined) delete process.env['RESEND_API_KEY'];
      else process.env['RESEND_API_KEY'] = originalKey;
      Reflect.set(process.env, 'NODE_ENV', originalEnv);
    });

    it.each([null, '', '   '])(
      'greets "User" when the account has no usable name (%p), and sends the subject and both links',
      async (name) => {
        const send = jest
          .fn()
          .mockResolvedValue({ data: { id: 'msg-1' }, error: null });
        process.env['RESEND_API_KEY'] = 'test-key';
        let isolated: typeof import('./email.util') | undefined;
        jest.isolateModules(() => {
          jest.doMock('resend', () => ({
            Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
          }));
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          isolated = require('./email.util');
        });

        const result = await isolated!.sendAccountDeletionEmail(
          'a@b.com',
          name,
          confirmUrl,
          cancelUrl,
          expiresAt
        );

        expect(result).toEqual({ success: true, messageId: 'msg-1' });
        const sent = send.mock.calls[0]?.[0] as {
          to: string;
          subject: string;
          html: string;
        };
        expect(sent.to).toBe('a@b.com');
        expect(sent.subject).toBe(
          'Confirm Your Account Deletion - Trading Alerts'
        );
        expect(sent.html).toContain('Hi User,');
        expect(sent.html).toContain(`href="${confirmUrl}"`);
        expect(sent.html).toContain(`href="${cancelUrl}"`);
        jest.dontMock('resend');
      }
    );

    it('reports a failure instead of throwing when email is not configured', async () => {
      delete process.env['RESEND_API_KEY'];
      Reflect.set(process.env, 'NODE_ENV', 'production');

      await expect(
        sendAccountDeletionEmail(
          'a@b.com',
          'Alice',
          confirmUrl,
          cancelUrl,
          expiresAt
        )
      ).resolves.toEqual({
        success: false,
        error: 'Email service not configured',
      });
    });
  });
});

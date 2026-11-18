/**
 * @jest-environment node
 */
/**
 * Chat gateway input checks
 * (infra/contabo-chat-stack/apps/server/src/security.ts): the client address a
 * rate limit is keyed on, the shape of a `client_message`, and the queue job
 * id. The module is side-effect-free, so it is imported here as it is.
 */
import { randomBytes } from 'crypto';

import {
  UNKNOWN_CLIENT,
  chatJobId,
  getClientIp,
  isValidClientMessagePayload,
  normalizeClientIp,
  pickClientMessage,
} from '../../../infra/contabo-chat-stack/apps/server/src/security';
import {
  CLIENT_MESSAGE_TOPICS,
  MAX_CLIENT_MESSAGE_LENGTH,
} from '../../../infra/contabo-chat-stack/apps/server/src/types';

function socketWith(
  headers: Record<string, string | string[] | undefined>,
  address?: string
): Parameters<typeof getClientIp>[0] {
  return { handshake: { headers, address } };
}

describe('normalizeClientIp', () => {
  it.each([
    ['203.0.113.50', '203.0.113.50'],
    ['  203.0.113.50  ', '203.0.113.50'],
    ['0.0.0.0', '0.0.0.0'],
  ])('keeps the IPv4 address %p', (raw, expected) => {
    expect(normalizeClientIp(raw)).toBe(expected);
  });

  it.each([
    ['::ffff:203.0.113.50', '203.0.113.50'],
    ['::FFFF:203.0.113.50', '203.0.113.50'],
    ['::ffff:cb00:7132', '203.0.113.50'],
    ['0:0:0:0:0:ffff:203.0.113.50', '203.0.113.50'],
    ['::ffff:127.0.0.1', '127.0.0.1'],
  ])(
    'counts the IPv4-mapped address %p as the IPv4 address',
    (raw, expected) => {
      expect(normalizeClientIp(raw)).toBe(expected);
    }
  );

  it.each([
    ['2001:db8:abcd:12:ffff:ffff:ffff:ffff', '2001:db8:abcd:12::/64'],
    ['2001:DB8:ABCD:0012::1', '2001:db8:abcd:12::/64'],
    ['2001:db8:abcd:12::', '2001:db8:abcd:12::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['::', '0:0:0:0::/64'],
    ['fe80::1234:5678:9abc:def0', 'fe80:0:0:0::/64'],
    ['64:ff9b::203.0.113.5', '64:ff9b:0:0::/64'],
  ])('counts the IPv6 address %p under its /64 prefix', (raw, expected) => {
    expect(normalizeClientIp(raw)).toBe(expected);
  });

  it('gives every address inside one /64 the same key, and another /64 another key', () => {
    const keys = new Set<string | null>();
    for (let i = 0; i < 500; i++) {
      const tail = randomBytes(8).toString('hex').match(/.{4}/g)!.join(':');
      keys.add(normalizeClientIp(`2001:db8:abcd:12:${tail}`));
    }
    expect([...keys]).toEqual(['2001:db8:abcd:12::/64']);

    expect(normalizeClientIp('2001:db8:abcd:13::1')).toBe(
      '2001:db8:abcd:13::/64'
    );
  });

  it.each([
    [undefined],
    [null],
    [123],
    [{}],
    [['203.0.113.50']],
    [''],
    ['   '],
    ['not-an-ip'],
    ['client-supplied-text'],
    ['999.1.1.1'],
    ['1.2.3'],
    ['01.2.3.4'],
    ['203.0.113.50, 198.51.100.7'],
    ['203.0.113.50:8080'],
    ['[2001:db8::1]'],
    ['fe80::1%eth0'],
    ['2001:db8:::1'],
    ['1:2:3:4:5:6:7:8:9'],
    ['x'.repeat(100)],
  ])('rejects %p', (raw) => {
    expect(normalizeClientIp(raw)).toBeNull();
  });
});

describe('getClientIp', () => {
  it('takes the address Nginx set in X-Real-IP', () => {
    expect(
      getClientIp(socketWith({ 'x-real-ip': '203.0.113.50' }, '127.0.0.1'))
    ).toBe('203.0.113.50');
  });

  it('never reads X-Forwarded-For, whatever it contains', () => {
    const clientSupplied = '198.51.100.7, client-supplied-text, 192.0.2.1';
    expect(
      getClientIp(
        socketWith(
          { 'x-real-ip': '203.0.113.50', 'x-forwarded-for': clientSupplied },
          '127.0.0.1'
        )
      )
    ).toBe('203.0.113.50');

    // with no X-Real-IP the connection's own address is used, not the header
    expect(
      getClientIp(
        socketWith({ 'x-forwarded-for': clientSupplied }, '::ffff:127.0.0.1')
      )
    ).toBe('127.0.0.1');
    expect(
      getClientIp(
        socketWith({ 'x-forwarded-for': '198.51.100.7' }, '192.0.2.44')
      )
    ).toBe('192.0.2.44');
  });

  it('never turns text a client chose into a key', () => {
    const keys = new Set<string>();
    for (const forwarded of ['a', 'b', 'client-supplied-text', '1.2.3.4', '']) {
      keys.add(
        getClientIp(
          socketWith(
            { 'x-forwarded-for': forwarded, 'x-real-ip': forwarded },
            '127.0.0.1'
          )
        )
      );
    }
    // "1.2.3.4" is a literal address, so it is its own key; the text is not
    expect([...keys].sort()).toEqual(['1.2.3.4', '127.0.0.1']);
  });

  it('falls back to the connection address when X-Real-IP is not an IP address', () => {
    expect(
      getClientIp(socketWith({ 'x-real-ip': 'not-an-ip' }, '192.0.2.10'))
    ).toBe('192.0.2.10');
    expect(getClientIp(socketWith({ 'x-real-ip': '' }, '192.0.2.10'))).toBe(
      '192.0.2.10'
    );
  });

  it('uses the first value when the header arrives more than once', () => {
    expect(
      getClientIp(
        socketWith(
          { 'x-real-ip': ['203.0.113.50', '198.51.100.7'] },
          '127.0.0.1'
        )
      )
    ).toBe('203.0.113.50');
  });

  it('buckets IPv6 clients by /64, from either source', () => {
    expect(
      getClientIp(
        socketWith({ 'x-real-ip': '2001:db8:abcd:12::99' }, '127.0.0.1')
      )
    ).toBe('2001:db8:abcd:12::/64');
    expect(
      getClientIp(socketWith({}, '2001:db8:abcd:12:aaaa:bbbb:cccc:dddd'))
    ).toBe('2001:db8:abcd:12::/64');
  });

  it('has a fixed bucket when no usable address exists at all', () => {
    expect(getClientIp(socketWith({}, undefined))).toBe(UNKNOWN_CLIENT);
    expect(
      getClientIp(socketWith({ 'x-real-ip': 'x' }, 'also-not-an-ip'))
    ).toBe(UNKNOWN_CLIENT);
  });
});

describe('isValidClientMessagePayload', () => {
  const valid = (overrides: Record<string, unknown> = {}) => ({
    id: 'usr-1730000000000-a1b2',
    text: 'How much is PRO?',
    topic: 'Product Info',
    timestamp: '2026-11-01T12:34:56.789Z',
    ...overrides,
  });

  it('accepts what lib/socket-client.ts sends', () => {
    expect(isValidClientMessagePayload(valid())).toBe(true);
  });

  it.each(CLIENT_MESSAGE_TOPICS)('accepts the %s topic', (topic) => {
    expect(isValidClientMessagePayload(valid({ topic }))).toBe(true);
  });

  it('accepts a message with no topic', () => {
    const { topic: _topic, ...withoutTopic } = valid();
    expect(isValidClientMessagePayload(withoutTopic)).toBe(true);
    expect(isValidClientMessagePayload(valid({ topic: undefined }))).toBe(true);
  });

  it('accepts text up to the limit and refuses one character more', () => {
    expect(
      isValidClientMessagePayload(
        valid({ text: 'a'.repeat(MAX_CLIENT_MESSAGE_LENGTH) })
      )
    ).toBe(true);
    expect(
      isValidClientMessagePayload(
        valid({ text: 'a'.repeat(MAX_CLIENT_MESSAGE_LENGTH + 1) })
      )
    ).toBe(false);
  });

  it('measures the limit on the text as sent, so padding cannot exceed it', () => {
    expect(
      isValidClientMessagePayload(
        valid({ text: `${'a'.repeat(MAX_CLIENT_MESSAGE_LENGTH)} ` })
      )
    ).toBe(false);
    expect(
      isValidClientMessagePayload(valid({ text: ' '.repeat(5000) + 'hello' }))
    ).toBe(false);
  });

  it('accepts timestamps with or without milliseconds and with an offset', () => {
    for (const timestamp of [
      '2026-11-01T12:34:56Z',
      '2026-11-01T12:34:56.789Z',
      '2026-11-01T19:34:56.789+07:00',
    ]) {
      expect(isValidClientMessagePayload(valid({ timestamp }))).toBe(true);
    }
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'hello'],
    ['a number', 42],
    ['an array', [valid()]],
    ['an empty object', {}],
  ])('rejects %s instead of a payload', (_label, payload) => {
    expect(isValidClientMessagePayload(payload)).toBe(false);
  });

  it.each([
    ['a missing id', { id: undefined }],
    ['an empty id', { id: '' }],
    ['a numeric id', { id: 12345 }],
    ['an id of 65 characters', { id: 'a'.repeat(65) }],
    ['an id with a space', { id: 'usr 1' }],
    ['an id with a colon', { id: 'usr:1' }],
    ['an id with a path', { id: '../../etc/passwd' }],
    ['an id with a newline', { id: 'usr-1\nx' }],
    ['a missing text', { text: undefined }],
    ['a numeric text', { text: 42 }],
    ['an object text', { text: { toString: 'x' } }],
    ['an empty text', { text: '' }],
    ['a blank text', { text: ' \n\t ' }],
    ['a missing timestamp', { timestamp: undefined }],
    ['a numeric timestamp', { timestamp: 1730000000000 }],
    ['a timestamp that is not ISO-8601', { timestamp: 'yesterday' }],
    ['a date without a time', { timestamp: '2026-11-01' }],
    [
      'a timestamp with an impossible month',
      { timestamp: '2026-13-45T00:00:00Z' },
    ],
    [
      'a timestamp over 64 characters',
      { timestamp: `2026-11-01T12:34:56.${'7'.repeat(60)}Z` },
    ],
    ['a topic outside the four chips', { topic: 'Something else' }],
    ['a topic in a different case', { topic: 'billing' }],
    ['a null topic', { topic: null }],
    ['a numeric topic', { topic: 7 }],
    ['an array topic', { topic: ['Billing'] }],
  ])('rejects %s', (_label, overrides) => {
    expect(isValidClientMessagePayload(valid(overrides))).toBe(false);
  });
});

describe('pickClientMessage', () => {
  it('keeps the contract fields and drops everything else', () => {
    const parsed = JSON.parse(
      '{"id":"usr-1","text":"hi","timestamp":"2026-11-01T00:00:00Z","topic":"Billing","extra":"x","__proto__":{"polluted":true},"junk":[1,2,3]}'
    );
    expect(Object.keys(parsed)).toContain('__proto__');
    expect(isValidClientMessagePayload(parsed)).toBe(true);

    const picked = pickClientMessage(parsed);

    expect(picked).toEqual({
      id: 'usr-1',
      text: 'hi',
      timestamp: '2026-11-01T00:00:00Z',
      topic: 'Billing',
    });
    expect(Object.keys(picked).sort()).toEqual([
      'id',
      'text',
      'timestamp',
      'topic',
    ]);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('leaves the topic out when there is none', () => {
    const picked = pickClientMessage({
      id: 'usr-1',
      text: 'hi',
      timestamp: '2026-11-01T00:00:00Z',
    });
    expect(Object.keys(picked).sort()).toEqual(['id', 'text', 'timestamp']);
  });
});

describe('chatJobId', () => {
  it('is scoped to the socket, so two sockets reusing one client id do not collide', () => {
    expect(chatJobId('sockA', 'usr-1')).not.toBe(chatJobId('sockB', 'usr-1'));
  });

  it('is the same for the same socket and client id (the queue still de-duplicates a resend)', () => {
    expect(chatJobId('sockA', 'usr-1')).toBe(chatJobId('sockA', 'usr-1'));
  });

  it('keeps an ambiguous-looking pair apart', () => {
    expect(chatJobId('ab', 'c-d')).not.toBe(chatJobId('ab-c', 'd'));
    expect(chatJobId('ab', 'c_d')).not.toBe(chatJobId('ab_c', 'd'));
  });

  it("meets BullMQ's rules for a custom id: no ':' and not an integer", () => {
    const id = chatJobId('XyZ_-0123456789abcdef', 'usr-1730000000000-a1b2');
    expect(id).not.toContain(':');
    expect(`${parseInt(id, 10)}`).not.toBe(id);
    expect(id).toMatch(/^[A-Za-z0-9_.-]+$/);
  });
});

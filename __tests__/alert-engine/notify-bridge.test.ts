/**
 * Tests for the cross-process notify bridge: message build / parse and the
 * subscribe-and-deliver loop (with a fake publisher).
 */

import {
  buildAlertFiredMessage,
  parseAlertFired,
  publishAlertFired,
  type AlertFiredMessage,
} from '@/lib/alert-engine/notify-bridge';
import type { FireEvent } from '@/lib/alert-engine/types';

const fire: FireEvent = {
  alertId: 'a1',
  userId: 'u1',
  symbol: 'XAUUSD',
  timeframe: 'M10',
  levelId: 'channel_top',
  levelPrice: 2050,
  touchPrice: 2050.4,
  time: 1717000000,
  oneShot: false,
};

describe('notify-bridge messages', () => {
  it('builds a fired message with notification + marker', () => {
    const msg = buildAlertFiredMessage(fire, '2026-06-27T00:00:00.000Z');
    expect(msg.userId).toBe('u1');
    expect(msg.notification.type).toBe('ALERT');
    expect(msg.notification.id).toBe('alert_a1_1717000000');
    expect(msg.marker).toMatchObject({
      symbol: 'XAUUSD',
      timeframe: 'M10',
      levelId: 'channel_top',
      touchPrice: 2050.4,
      time: 1717000000,
    });
  });

  it('round-trips through publish + parse', async () => {
    const msg = buildAlertFiredMessage(fire, '2026-06-27T00:00:00.000Z');
    let published: { channel: string; payload: string } | null = null;
    const redis = {
      publish: async (channel: string, payload: string): Promise<number> => {
        published = { channel, payload };
        return 1;
      },
    };

    await publishAlertFired(redis, msg);
    expect(published).not.toBeNull();
    const parsed = parseAlertFired(
      (published as unknown as { payload: string }).payload
    );
    expect(parsed).toEqual<AlertFiredMessage>(msg);
  });

  it('parse returns null on garbage / incomplete payloads', () => {
    expect(parseAlertFired('not json')).toBeNull();
    expect(parseAlertFired(JSON.stringify({ userId: 'u1' }))).toBeNull();
    expect(
      parseAlertFired(JSON.stringify({ notification: {}, marker: {} }))
    ).toBeNull();
  });
});

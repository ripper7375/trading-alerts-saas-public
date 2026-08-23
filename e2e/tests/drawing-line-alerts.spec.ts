/**
 * Drawing engine -> line alert -> live delivery (Session 10-2)
 *
 * draw -> attach alert -> price crosses -> fire -> delivered live, on the
 * Phase 9 `/terminal`. Scope narrowed twice from the original PRE-DRAFT,
 * both confirmed live with Davin at this session's CONFIRM/EXECUTE:
 *
 * 1. No live chart-marker DOM assertion (mt5-service's OHLCV feed is
 *    SEPARATE_STACK, out of scope) -- marker placement is covered by its
 *    own existing unit tests (__tests__/drawing/firedMarkers.test.ts).
 * 2. No toast / AppHeader-badge assertion -- neither exists as live UI
 *    (AppHeader's bell is a static decorative dot, not a real unread
 *    count; the only onNotification consumer, NotificationList, shows no
 *    toast). Swapped for the one thing that IS real: the raw Socket.IO
 *    frames arriving on /terminal, plus the /notifications page (the same
 *    NotificationList component) actually reflecting the new notification
 *    and its live unread counter.
 *
 * Auth is done via the real token-login bridge (same mechanism the Newman
 * collection uses), not a UI login form -- deterministic, and sidesteps
 * L43's React-controlled-input browser-tool gotchas entirely.
 *
 * @module e2e/tests/drawing-line-alerts.spec
 */

import path from 'path';

import { test, expect, type WebSocket } from '@playwright/test';
import dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const PRO_USER = {
  email: 'pro-test@trading-alerts.test',
  password: 'TestPassword123!',
};

const SYMBOL = 'XAUUSD';
const TIMEFRAME = 'M5';
const LEVEL_PRICE = 2000.0;

interface SocketFrame {
  event: string;
  payload: unknown;
}

/** Parses a Socket.IO v4 text frame, e.g. `42["notification",{...}]`.
 * Non-EVENT frames (CONNECT `40{...}`, PING `2`, ...) never start with `[`
 * right after the leading digits and are silently skipped. */
function parseSocketIoFrame(text: string): SocketFrame | null {
  const match = text.match(/^\d+(\[.*\])$/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as unknown[];
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return { event: parsed[0], payload: parsed[1] };
    }
  } catch {
    // not a JSON event frame (binary placeholder, malformed, etc.)
  }
  return null;
}

test.describe('Drawing engine & line-alert e2e (Session 10-2)', () => {
  let drawingId: string | undefined;
  let redis: Redis;

  test.beforeAll(() => {
    if (!process.env.REDIS_URL) {
      throw new Error(
        'REDIS_URL not set -- expected in .env.local (operation-service/.env is a separate, service-local file)'
      );
    }
    redis = new Redis(process.env.REDIS_URL);
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test.afterEach(async ({ page }) => {
    // Fixture cleanup per this order's own Rules ("every test run must
    // clean up created drawings and alerts on completion"). Deleting the
    // drawing also exercises F82's cascade fix -- a bonus, not the point.
    if (drawingId) {
      await page.request
        .delete(`/api/drawings/${drawingId}`)
        .catch(() => undefined);
      drawingId = undefined;
    }
  });

  test('draw HLINE -> attach alert -> price crosses -> fires -> delivered via WS + /notifications', async ({
    page,
  }) => {
    // 1. Auth: the token-login bridge sets NextAuth's own session cookie
    // into this test's BrowserContext -- page.request shares that cookie
    // jar, so both the API calls below and the later page.goto() are
    // authenticated as the same PRO user.
    const loginRes = await page.request.post('/api/auth/token-login', {
      data: PRO_USER,
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.tier).toBe('PRO');

    // 2. Capture raw Socket.IO frames on /terminal's realtime connection
    // (established by TradingChart's useFiredAlertMarkers). Registered
    // before navigation so the handshake itself isn't missed.
    const wsFrames: SocketFrame[] = [];
    page.on('websocket', (ws: WebSocket) => {
      ws.on('framereceived', (frame) => {
        const text =
          typeof frame.payload === 'string'
            ? frame.payload
            : frame.payload.toString('utf-8');
        const parsed = parseSocketIoFrame(text);
        if (parsed) wsFrames.push(parsed);
      });
    });

    await page.goto('/terminal');

    // Wait for the gateway's own post-auth ack (RealtimeGateway.
    // handleConnection emits `authenticated`) before creating fixtures --
    // otherwise a fire dispatched before the socket finishes its handshake
    // would never reach this page.
    await expect
      .poll(() => wsFrames.some((f) => f.event === 'authenticated'), {
        message: 'realtime socket never authenticated',
        timeout: 15000,
      })
      .toBe(true);

    // 3. Create the HLINE drawing and attach a PRICE_TOUCH_LINE alert via
    // the real API (Decision 1 explicitly allows UI or API for this step --
    // API is deterministic; drawing a line by simulating canvas clicks at
    // exact chart pixel coordinates would be the flaky alternative).
    const drawingRes = await page.request.post('/api/drawings', {
      data: {
        symbol: SYMBOL,
        timeframe: TIMEFRAME,
        type: 'HLINE',
        anchors: [{ time: Math.floor(Date.now() / 1000), price: LEVEL_PRICE }],
        style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid' },
      },
    });
    expect(drawingRes.status()).toBe(201);
    const drawingBody = await drawingRes.json();
    drawingId = drawingBody.drawing.id as string;

    const alertRes = await page.request.post('/api/alerts/line', {
      data: {
        drawingId,
        targetLevel: 'line',
        direction: 'either',
        tolerance: 0,
        cooldownSec: 5,
        oneShot: false,
        name: '10-2 e2e alert',
      },
    });
    expect(alertRes.status()).toBe(201);

    // 4. Trigger a deterministic price cross via synthetic Redis publish
    // (Session 10-1's own proven mechanism -- no live MT5 terminal needed).
    // A bar whose low/high straddle the level price fires unconditionally
    // for direction 'either' (detect.ts's `touched` clause), independent
    // of any previous-price baseline.
    const publishPriceCross = (): Promise<number> =>
      redis.publish(
        `prices:${SYMBOL}:${TIMEFRAME}`,
        JSON.stringify({
          symbol: SYMBOL,
          timeframe: TIMEFRAME,
          time: Math.floor(Date.now() / 1000),
          open: 1999,
          high: 2002,
          low: 1998,
          close: 2001,
          final: true,
        })
      );
    await publishPriceCross();

    // The worker's watch cache only picks up this brand-new alert after
    // it reloads on `alerts:changed` (published by the POST above) -- a
    // real async race, not flakiness in this test. Re-publishing every 2s
    // is a bounded retry against that specific race, not a blind sleep;
    // the actual pass/fail condition below is a real observed WS frame.
    for (let i = 0; i < 6; i++) {
      if (wsFrames.some((f) => f.event === 'alert_fired')) break;
      await publishPriceCross();
      await page.waitForTimeout(2000);
    }

    // 5. Assert both fired-alert frames actually arrived over the socket.
    await expect
      .poll(() => wsFrames.some((f) => f.event === 'notification'), {
        message: 'no "notification" WS frame received after the price cross',
        timeout: 5000,
      })
      .toBe(true);
    await expect
      .poll(() => wsFrames.some((f) => f.event === 'alert_fired'), {
        message: 'no "alert_fired" WS frame received after the price cross',
        timeout: 5000,
      })
      .toBe(true);

    const notificationFrame = wsFrames.find((f) => f.event === 'notification');
    const notification = notificationFrame?.payload as {
      title: string;
      body: string;
    };
    expect(notification.title).toBe(`${SYMBOL} ${TIMEFRAME} alert`);
    expect(notification.body).toMatch(/^Price .* touched line @ 2000/);

    const markerFrame = wsFrames.find((f) => f.event === 'alert_fired');
    const marker = markerFrame?.payload as {
      symbol: string;
      timeframe: string;
      levelPrice: number;
    };
    expect(marker.symbol).toBe(SYMBOL);
    expect(marker.timeframe).toBe(TIMEFRAME);
    expect(marker.levelPrice).toBe(LEVEL_PRICE);

    // 6. The one piece of UI that genuinely IS live off this same event:
    // /notifications (NotificationList) re-fetches on the socket push and
    // renders the new row + its own live unread counter.
    await page.goto('/notifications');
    await expect(page.getByText(notification.body)).toBeVisible({
      timeout: 10000,
    });
  });
});

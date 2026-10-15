/**
 * @jest-environment node
 */

/**
 * The four route files (build step 7 part 7b): what each exports, what it passes to the handler, and
 * that nothing in them decides anything. The handlers are mocked; their own tests are beside this one.
 * Also: the throwaway metering route of step 6 is gone (decision D8).
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

const after = jest.fn();
jest.mock('next/server', () => ({ after: (fn: unknown) => after(fn) }));

const runMessageRoute = jest.fn(async () => new Response('message'));
jest.mock('@/lib/reply/server/respond', () => ({
  runMessageRoute: (...args: unknown[]) =>
    (runMessageRoute as jest.Mock)(...args),
}));

const auth = { enabled: () => true };
const handlers = {
  handleThreadsList: jest.fn(async () => new Response('list')),
  handleThreadGet: jest.fn(async () => new Response('get')),
  handleThreadRename: jest.fn(async () => new Response('rename')),
  handleThreadDelete: jest.fn(async () => new Response('delete')),
};
jest.mock('@/lib/reply/server/threads-api', () => ({
  createChatAuth: () => auth,
  handleThreadsList: (...args: unknown[]) =>
    (handlers.handleThreadsList as jest.Mock)(...args),
  handleThreadGet: (...args: unknown[]) =>
    (handlers.handleThreadGet as jest.Mock)(...args),
  handleThreadRename: (...args: unknown[]) =>
    (handlers.handleThreadRename as jest.Mock)(...args),
  handleThreadDelete: (...args: unknown[]) =>
    (handlers.handleThreadDelete as jest.Mock)(...args),
}));

const stateDeps = { marker: 'state-deps' };
const handleState = jest.fn(async () => new Response('state'));
jest.mock('@/lib/reply/server/state-api', () => ({
  createStateApiDeps: () => stateDeps,
  handleState: (...args: unknown[]) => (handleState as jest.Mock)(...args),
}));

import * as messageRoute from '@/app/api/chat/message/route';
import * as threadsRoute from '@/app/api/chat/threads/route';
import * as threadRoute from '@/app/api/chat/threads/[id]/route';
import * as stateRoute from '@/app/api/chat/state/route';

const request = (path: string, method = 'GET') =>
  new Request(`http://localhost${path}`, { method });

beforeEach(() => {
  after.mockReset();
  runMessageRoute.mockClear();
  handleState.mockClear();
  for (const fn of Object.values(handlers)) fn.mockClear();
});

describe('every route is dynamic, and the message route may run a minute', () => {
  it.each([
    ['message', messageRoute],
    ['threads', threadsRoute],
    ['thread', threadRoute],
    ['state', stateRoute],
  ])('%s is never cached', (_name, route) => {
    expect(route.dynamic).toBe('force-dynamic');
  });

  it('the message route is allowed 60 seconds; its own deadline is 55', () => {
    expect(messageRoute.maxDuration).toBe(60);
  });
});

describe('the message route', () => {
  it('hands the request to the route body and asks the platform to keep the run alive', async () => {
    const req = request('/api/chat/message', 'POST');
    const response = await messageRoute.POST(req);
    expect(await response.text()).toBe('message');
    expect(runMessageRoute).toHaveBeenCalledTimes(1);
    const [given, options] = runMessageRoute.mock.calls[0] as unknown as [
      Request,
      { keepAlive: (t: Promise<unknown>) => void },
    ];
    expect(given).toBe(req);
    const task = Promise.resolve('run');
    options.keepAlive(task);
    expect(after).toHaveBeenCalledTimes(1);
    const scheduled = after.mock.calls[0]![0] as () => Promise<unknown>;
    await expect(scheduled()).resolves.toBe('run');
  });

  it('exports POST and nothing else that answers', () => {
    expect(Object.keys(messageRoute).sort()).toEqual([
      'POST',
      'dynamic',
      'maxDuration',
    ]);
  });
});

describe('the threads routes', () => {
  it('the list passes the request and the production auth', async () => {
    const req = request('/api/chat/threads');
    expect(await (await threadsRoute.GET(req)).text()).toBe('list');
    expect(handlers.handleThreadsList).toHaveBeenCalledWith(req, { auth });
    expect(Object.keys(threadsRoute).sort()).toEqual(['GET', 'dynamic']);
  });

  it('one thread: the id comes from the path, awaited, and goes to the right handler', async () => {
    const context = { params: Promise.resolve({ id: 'th-77' }) };
    const req = request('/api/chat/threads/th-77');
    expect(await (await threadRoute.GET(req, context)).text()).toBe('get');
    expect(handlers.handleThreadGet).toHaveBeenCalledWith(req, 'th-77', {
      auth,
    });
    expect(await (await threadRoute.PATCH(req, context)).text()).toBe('rename');
    expect(handlers.handleThreadRename).toHaveBeenCalledWith(req, 'th-77', {
      auth,
    });
    expect(await (await threadRoute.DELETE(req, context)).text()).toBe(
      'delete'
    );
    expect(handlers.handleThreadDelete).toHaveBeenCalledWith(req, 'th-77', {
      auth,
    });
    expect(Object.keys(threadRoute).sort()).toEqual([
      'DELETE',
      'GET',
      'PATCH',
      'dynamic',
    ]);
  });
});

describe('the state route', () => {
  it('passes the request and the production dependencies', async () => {
    const req = request('/api/chat/state');
    expect(await (await stateRoute.GET(req)).text()).toBe('state');
    expect(handleState).toHaveBeenCalledWith(req, stateDeps);
    expect(Object.keys(stateRoute).sort()).toEqual(['GET', 'dynamic']);
  });
});

describe('the throwaway metering route is gone (decision D8)', () => {
  it('has no file, no test and no folder', () => {
    const root = resolve(__dirname, '..', '..', '..');
    expect(existsSync(resolve(root, 'app/api/test/ai-metering/route.ts'))).toBe(
      false
    );
    expect(existsSync(resolve(root, 'app/api/test/ai-metering'))).toBe(false);
    expect(
      existsSync(resolve(root, '__tests__/api/test-ai-metering.test.ts'))
    ).toBe(false);
  });
});

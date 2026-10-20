/**
 * @jest-environment node
 */
/**
 * POST /api/auth/track-login: records a sign-in, starts the account's saved
 * language from the browser's when it has none, and sends the new-device alert.
 */
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));

const order: string[] = [];
const mockRecordLoginAttempt = jest.fn();
const mockSendNewDeviceAlert = jest.fn();
jest.mock('@/lib/security/device-detection', () => ({
  getLoginContext: jest.fn().mockResolvedValue({
    device: { deviceType: 'desktop' },
    location: { city: 'Bangkok', country: 'Thailand' },
  }),
  recordLoginAttempt: (...args: unknown[]) => mockRecordLoginAttempt(...args),
  sendNewDeviceAlert: (...args: unknown[]) => mockSendNewDeviceAlert(...args),
}));

const mockRemember = jest.fn();
jest.mock('@/lib/email/recipient-locale', () => ({
  rememberAccountLocaleIfAbsent: (...args: unknown[]) => mockRemember(...args),
}));

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/auth/track-login/route';

const post = (): NextRequest =>
  new NextRequest('http://localhost/api/auth/track-login', {
    method: 'POST',
    body: JSON.stringify({ provider: 'credentials' }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
  mockRecordLoginAttempt.mockResolvedValue({ isNewDevice: true });
  mockRemember.mockImplementation(async () => {
    order.push('remember');
  });
  mockSendNewDeviceAlert.mockImplementation(async () => {
    order.push('alert');
  });
});

describe('POST /api/auth/track-login', () => {
  it("starts the saved language from the browser's, then sends the alert", async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(mockRemember).toHaveBeenCalledWith('u1');
    expect(order).toEqual(['remember', 'alert']);
  });

  it('remembers the language on a known device too', async () => {
    mockRecordLoginAttempt.mockResolvedValue({ isNewDevice: false });
    await POST(post());
    expect(mockRemember).toHaveBeenCalledWith('u1');
    expect(mockSendNewDeviceAlert).not.toHaveBeenCalled();
  });

  it('does nothing for a visitor who is not signed in', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const response = await POST(post());
    expect(response.status).toBe(401);
    expect(mockRemember).not.toHaveBeenCalled();
    expect(mockSendNewDeviceAlert).not.toHaveBeenCalled();
  });
});

/**
 * User Settings API Tests
 *
 * Tests for user profile, preferences, and password management routes.
 * Part 13: Settings System
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock Prisma - use factory function to avoid hoisting issues
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockPreferencesFindUnique = jest.fn();
const mockPreferencesUpsert = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    userPreferences: {
      findUnique: (...args: unknown[]) => mockPreferencesFindUnique(...args),
      upsert: (...args: unknown[]) => mockPreferencesUpsert(...args),
    },
  },
}));

// Mock next-auth
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: () => mockGetServerSession(),
}));

// Mock auth-options
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock preferences defaults
jest.mock('@/lib/preferences/defaults', () => ({
  DEFAULT_PREFERENCES: {
    theme: 'system',
    countryCode: 'US',
    language: 'en',
    timezone: 'UTC',
    emailNotifications: true,
  },
  SUPPORTED_COUNTRY_CODES: [
    'GB',
    'IN',
    'NG',
    'PK',
    'VN',
    'ID',
    'TH',
    'ZA',
    'TR',
    'US',
    'EU',
    'JP',
    'AE',
    'FR',
    'KR',
  ],
  mergePreferences: (
    defaults: Record<string, unknown>,
    stored: Record<string, unknown>
  ) => ({
    ...defaults,
    ...stored,
  }),
}));

// Mock email module to prevent MessageChannel error from Resend/React Email
jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Helper to create mock request
function createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): Request {
  const url = 'http://localhost:3000/api/user/profile';
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

// GET /api/user/preferences reads GeoIP headers off the request even when
// no body is sent — a bare `new Request(url)` (no init) still supports
// `.headers.get()`, matching what `getPreferences()` needs.
function createMockGetRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/user/preferences', {
    headers: headers || {},
  });
}

// Import routes after mocks
import { POST as changePassword } from '@/app/api/user/password/route';
import {
  GET as getPreferences,
  PUT as putPreferences,
} from '@/app/api/user/preferences/route';
import {
  GET as getProfile,
  PATCH as patchProfile,
} from '@/app/api/user/profile/route';

describe('User Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Profile API Tests - /api/user/profile
  // ============================================================================
  describe('GET /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await getProfile();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user profile when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        image: null,
        tier: 'FREE',
        role: 'USER',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      const response = await getProfile();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.id).toBe('user-123');
      expect(data.user.name).toBe('Test User');
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.emailVerified).toBe(true);
    });

    it('should return 404 when user not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'nonexistent-user' },
      });

      mockUserFindUnique.mockResolvedValue(null);

      const response = await getProfile();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });
  });

  describe('PATCH /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest('PATCH', { name: 'New Name' });
      const response = await patchProfile(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should update user name', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      const updatedUser = {
        id: 'user-123',
        name: 'Updated Name',
        email: 'test@example.com',
        image: null,
        tier: 'FREE',
        role: 'USER',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserUpdate.mockResolvedValue(updatedUser);

      const request = createMockRequest('PATCH', { name: 'Updated Name' });
      const response = await patchProfile(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.name).toBe('Updated Name');
      expect(data.message).toBe('Profile updated successfully');
    });

    it('should return 400 for invalid input', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      const request = createMockRequest('PATCH', { name: 'A' }); // Too short
      const response = await patchProfile(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });

    it('should return 409 when email already exists', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      mockUserFindUnique.mockResolvedValue({ id: 'other-user' });

      const request = createMockRequest('PATCH', {
        email: 'existing@example.com',
      });
      const response = await patchProfile(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Email already in use');
    });
  });

  // ============================================================================
  // Preferences API Tests - /api/user/preferences
  // ============================================================================
  describe('GET /api/user/preferences', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await getPreferences(createMockGetRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return merged preferences when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue({
        userId: 'user-123',
        preferences: { theme: 'dark' },
      });

      const response = await getPreferences(createMockGetRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toBeDefined();
      expect(data.preferences.theme).toBe('dark');
    });

    it('should return defaults when no preferences stored and no GeoIP header', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue(null);

      const response = await getPreferences(createMockGetRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences).toBeDefined();
      expect(data.preferences.theme).toBe('system');
      expect(data.preferences.countryCode).toBe('US');
    });

    it('should resolve locale from cf-ipcountry when no preferences are stored yet', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue(null);

      const response = await getPreferences(
        createMockGetRequest({ 'cf-ipcountry': 'TH' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.countryCode).toBe('TH');
      expect(data.preferences.language).toBe('th');
      expect(data.preferences.currency).toBe('THB');
      expect(data.preferences.timezone).toBe('Asia/Bangkok');
    });

    it('should fall back to x-vercel-ip-country when cf-ipcountry is absent', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue(null);

      const response = await getPreferences(
        createMockGetRequest({ 'x-vercel-ip-country': 'DE' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.countryCode).toBe('EU');
      expect(data.preferences.currency).toBe('EUR');
    });

    it('should ignore an unsupported GeoIP country and fall back to defaults', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue(null);

      const response = await getPreferences(
        createMockGetRequest({ 'cf-ipcountry': 'XX' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.countryCode).toBe('US');
    });

    it('should NOT apply GeoIP resolution when the user already has stored preferences', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue({
        userId: 'user-123',
        preferences: { theme: 'dark' },
      });

      const response = await getPreferences(
        createMockGetRequest({ 'cf-ipcountry': 'TH' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      // Explicit stored row wins over GeoIP even though it never set
      // countryCode itself -- matches the "explicit preference wins"
      // precedence, treating any stored row as the user's own choice.
      expect(data.preferences.countryCode).toBe('US');
    });
  });

  describe('PUT /api/user/preferences', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest('PUT', { theme: 'dark' });
      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should update user preferences', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue(null);
      mockPreferencesUpsert.mockResolvedValue({
        userId: 'user-123',
        preferences: { theme: 'dark' },
      });

      const request = createMockRequest('PUT', { theme: 'dark' });
      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Preferences updated successfully');
    });

    it('should return 400 for invalid preference value', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      const request = createMockRequest('PUT', { theme: 'invalid-theme' });
      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });

    it('should accept and persist a supported countryCode', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockPreferencesFindUnique.mockResolvedValue(null);
      mockPreferencesUpsert.mockResolvedValue({
        userId: 'user-123',
        preferences: { countryCode: 'JP' },
      });

      const request = createMockRequest('PUT', { countryCode: 'JP' });
      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preferences.countryCode).toBe('JP');
      expect(mockPreferencesUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            preferences: expect.objectContaining({ countryCode: 'JP' }),
          }),
        })
      );
    });

    it('should return 400 for an unsupported countryCode', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      const request = createMockRequest('PUT', { countryCode: 'XX' });
      const response = await putPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });
  });

  // ============================================================================
  // Password API Tests - /api/user/password
  // ============================================================================
  describe('POST /api/user/password', () => {
    const { compare } = require('bcryptjs');

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest('POST', {
        currentPassword: 'oldpass',
        newPassword: 'NewPass123',
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should change password successfully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-old-password',
      });

      // First compare (current password) returns true, second (same password check) returns false
      compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      mockUserUpdate.mockResolvedValue({});

      const request = createMockRequest('POST', {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password changed successfully');
    });

    it('should return 404 when user not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockUserFindUnique.mockResolvedValue(null);

      const request = createMockRequest('POST', {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 400 for OAuth-only users', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password: null, // OAuth user has no password
      });

      const request = createMockRequest('POST', {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot change password');
    });

    it('should return 401 for incorrect current password', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
      });

      compare.mockResolvedValueOnce(false);

      const request = createMockRequest('POST', {
        currentPassword: 'WrongPass123',
        newPassword: 'NewPass123',
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Current password is incorrect');
    });

    it('should return 400 for weak password', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      const request = createMockRequest('POST', {
        currentPassword: 'OldPass123',
        newPassword: 'weak', // Too short, no uppercase, no number
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when new password same as current', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
      });

      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
      });

      // Both comparisons return true (same password)
      compare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      const request = createMockRequest('POST', {
        currentPassword: 'SamePass123',
        newPassword: 'SamePass123',
      });
      const response = await changePassword(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        'New password must be different from current password'
      );
    });
  });
});

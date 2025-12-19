/**
 * Affiliate Registration API Route Tests
 *
 * Tests for POST /api/affiliate/auth/register and POST /api/affiliate/auth/verify-email
 *
 * @module __tests__/api/affiliate-registration.test
 */

// Mock Next.js server globals
class MockHeaders {
  private headers: Map<string, string> = new Map();
  constructor(init?: Record<string, string>) {
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }
  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }
  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }
}

class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;
  private bodyContent: string | null = null;

  constructor(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
    this.bodyContent = init?.body || null;
  }

  async json(): Promise<unknown> {
    if (!this.bodyContent) throw new Error('No body');
    return JSON.parse(this.bodyContent);
  }
}

global.Headers = MockHeaders as unknown as typeof Headers;
global.Request = MockRequest as unknown as typeof Request;

// Mock NextResponse
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// Mock session
const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAuth: () => mockRequireAuth(),
}));

// Mock registration functions
const mockRegisterAffiliate = jest.fn();
const mockVerifyAffiliateEmail = jest.fn();
jest.mock('@/lib/affiliate/registration', () => ({
  __esModule: true,
  registerAffiliate: (data: unknown) => mockRegisterAffiliate(data),
  verifyAffiliateEmail: (token: string) => mockVerifyAffiliateEmail(token),
}));

// Mock Prisma
const mockAffiliateProfileFindUnique = jest.fn();
const mockAffiliateProfileUpdate = jest.fn();
const mockUserUpdate = jest.fn();
const mockAffiliateCodeCreateMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateProfile: {
      findUnique: (...args: unknown[]) => mockAffiliateProfileFindUnique(...args),
      update: (...args: unknown[]) => mockAffiliateProfileUpdate(...args),
    },
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    affiliateCode: {
      createMany: (...args: unknown[]) => mockAffiliateCodeCreateMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        affiliateProfile: {
          update: mockAffiliateProfileUpdate,
        },
        user: {
          update: mockUserUpdate,
        },
        affiliateCode: {
          createMany: mockAffiliateCodeCreateMany,
        },
      });
    },
  },
}));

describe('Affiliate Registration API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/affiliate/auth/register', () => {
    const validRegistrationData = {
      fullName: 'John Doe',
      country: 'US',
      paymentMethod: 'PAYPAL',
      paymentDetails: { email: 'john@paypal.com' },
      terms: true,
    };

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Unauthorized'));

      const { POST } = await import('@/app/api/affiliate/auth/register/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/register', {
        method: 'POST',
        body: JSON.stringify(validRegistrationData),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 409 if user is already an affiliate', async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', isAffiliate: true },
      });

      const { POST } = await import('@/app/api/affiliate/auth/register/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/register', {
        method: 'POST',
        body: JSON.stringify(validRegistrationData),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('ALREADY_AFFILIATE');
    });

    it('should return 400 for invalid input data', async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', isAffiliate: false },
      });

      const { POST } = await import('@/app/api/affiliate/auth/register/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'J', // Too short
          country: 'USA', // Should be 2 chars
          paymentMethod: 'INVALID',
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should register affiliate successfully', async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', isAffiliate: false },
      });

      mockRegisterAffiliate.mockResolvedValue({
        success: true,
        message: 'Please verify your email to complete registration',
        profileId: 'aff-profile-123',
      });

      const { POST } = await import('@/app/api/affiliate/auth/register/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/register', {
        method: 'POST',
        body: JSON.stringify(validRegistrationData),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.profileId).toBe('aff-profile-123');
      expect(mockRegisterAffiliate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          fullName: 'John Doe',
          country: 'US',
          paymentMethod: 'PAYPAL',
        })
      );
    });

    it('should include social URLs if provided', async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', isAffiliate: false },
      });

      mockRegisterAffiliate.mockResolvedValue({
        success: true,
        message: 'Please verify your email',
        profileId: 'aff-profile-123',
      });

      const dataWithSocials = {
        ...validRegistrationData,
        twitterUrl: 'https://twitter.com/johndoe',
        youtubeUrl: 'https://youtube.com/@johndoe',
      };

      const { POST } = await import('@/app/api/affiliate/auth/register/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/register', {
        method: 'POST',
        body: JSON.stringify(dataWithSocials),
      });
      await POST(request as unknown as Request);

      expect(mockRegisterAffiliate).toHaveBeenCalledWith(
        expect.objectContaining({
          twitterUrl: 'https://twitter.com/johndoe',
          youtubeUrl: 'https://youtube.com/@johndoe',
        })
      );
    });

    it('should handle registration errors gracefully', async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', isAffiliate: false },
      });

      mockRegisterAffiliate.mockRejectedValue(new Error('Database connection error'));

      const { POST } = await import('@/app/api/affiliate/auth/register/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/register', {
        method: 'POST',
        body: JSON.stringify(validRegistrationData),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('REGISTRATION_ERROR');
    });
  });

  describe('POST /api/affiliate/auth/verify-email', () => {
    it('should return 400 for missing token', async () => {
      const { POST } = await import('@/app/api/affiliate/auth/verify-email/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('token');
    });

    it('should return 400 for invalid/expired token', async () => {
      mockVerifyAffiliateEmail.mockRejectedValue(new Error('Invalid verification token'));

      const { POST } = await import('@/app/api/affiliate/auth/verify-email/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid-token-1234567890123456789012' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_TOKEN');
    });

    it('should verify email and activate affiliate successfully', async () => {
      mockVerifyAffiliateEmail.mockResolvedValue({
        success: true,
        message: 'Email verified successfully',
        codesDistributed: 15,
      });

      const { POST } = await import('@/app/api/affiliate/auth/verify-email/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token-12345678901234567890123' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('verified');
    });

    it('should handle verification errors gracefully', async () => {
      mockVerifyAffiliateEmail.mockRejectedValue(new Error('Database connection failed'));

      const { POST } = await import('@/app/api/affiliate/auth/verify-email/route');
      const request = new MockRequest('http://localhost/api/affiliate/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: 'some-token-with-32-characters-min' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});

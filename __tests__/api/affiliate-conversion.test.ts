/**
 * Affiliate Conversion Flow API Route Tests
 *
 * Tests for affiliate code validation and checkout integration
 * POST /api/checkout/validate-code
 *
 * @module __tests__/api/affiliate-conversion.test
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

// Mock Prisma
const mockAffiliateCodeFindUnique = jest.fn();
const mockAffiliateCodeUpdate = jest.fn();
const mockAffiliateProfileUpdate = jest.fn();
const mockCommissionCreate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateCode: {
      findUnique: (...args: unknown[]) => mockAffiliateCodeFindUnique(...args),
      update: (...args: unknown[]) => mockAffiliateCodeUpdate(...args),
    },
    affiliateProfile: {
      update: (...args: unknown[]) => mockAffiliateProfileUpdate(...args),
    },
    commission: {
      create: (...args: unknown[]) => mockCommissionCreate(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        affiliateCode: {
          update: mockAffiliateCodeUpdate,
        },
        affiliateProfile: {
          update: mockAffiliateProfileUpdate,
        },
        commission: {
          create: mockCommissionCreate,
        },
      });
    },
  },
}));

// Mock AFFILIATE_CONFIG and CODE_GENERATION
jest.mock('@/lib/affiliate/constants', () => ({
  __esModule: true,
  AFFILIATE_CONFIG: {
    DISCOUNT_PERCENT: 20.0,
    COMMISSION_PERCENT: 20.0,
    BASE_PRICE_USD: 29.0,
    CODES_PER_MONTH: 15,
    MINIMUM_PAYOUT: 50.0,
    CODE_EXPIRY_DAYS: 30,
    PAYMENT_METHODS: ['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'],
    PAYMENT_FREQUENCY: 'MONTHLY',
  },
  CODE_GENERATION: {
    CODE_LENGTH: 8,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  },
}));

describe('Affiliate Conversion Flow API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/checkout/validate-code', () => {
    it('should return 400 when no code provided', async () => {
      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('CODE_REQUIRED');
    });

    it('should return 400 for invalid code format', async () => {
      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'short' }), // Less than 8 chars
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('INVALID_FORMAT');
    });

    it('should return 404 when code does not exist', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue(null);

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'NOTFOUND' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('CODE_NOT_FOUND');
    });

    it('should return 400 when code is already used', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'USED1234',
        status: 'USED',
        discountPercent: 20,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'USED1234' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('CODE_NOT_ACTIVE');
      expect(data.message).toContain('already been used');
    });

    it('should return 400 when code is expired', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'EXPIRED1',
        status: 'ACTIVE',
        discountPercent: 20,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'EXPIRED1' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('CODE_EXPIRED');
    });

    it('should return 400 when affiliate is inactive', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'INACTIVE',
        status: 'ACTIVE',
        discountPercent: 20,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'SUSPENDED', // Inactive affiliate
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'INACTIVE' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('AFFILIATE_INACTIVE');
    });

    it('should validate code successfully and return discount info', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'VALID123',
        status: 'ACTIVE',
        discountPercent: 20,
        affiliateProfileId: 'aff-profile-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'VALID123' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.code).toBe('VALID123');
      expect(data.affiliateId).toBe('aff-profile-1');
      expect(data.discount).toEqual({
        percent: 20,
        amount: 5.8, // 20% of $29
        regularPrice: 29.0,
        finalPrice: 23.2, // $29 - $5.80
      });
      expect(data.message).toContain('20% discount');
    });

    it('should normalize code to uppercase', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'LOWER123',
        status: 'ACTIVE',
        discountPercent: 20,
        affiliateProfileId: 'aff-profile-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'lower123' }), // Lowercase input
        }
      );
      await POST(request as unknown as Request);

      expect(mockAffiliateCodeFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'LOWER123' }, // Should be uppercase
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockAffiliateCodeFindUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'DBERROR1' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.valid).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Commission Calculation Verification', () => {
    it('should calculate correct discount for 20% off', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'CALC2020',
        status: 'ACTIVE',
        discountPercent: 20,
        affiliateProfileId: 'aff-profile-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'CALC2020' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.discount.percent).toBe(20);
      expect(data.discount.regularPrice).toBe(29.0);
      expect(data.discount.amount).toBe(5.8);
      expect(data.discount.finalPrice).toBe(23.2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle code exactly at expiry boundary', async () => {
      const exactlyNow = new Date();
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'BOUNDARY',
        status: 'ACTIVE',
        discountPercent: 20,
        expiresAt: exactlyNow, // Expires right now
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'BOUNDARY' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      // Should be expired since expiresAt < new Date()
      expect(response.status).toBe(400);
      expect(data.code).toBe('CODE_EXPIRED');
    });

    it('should handle CANCELLED code status', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'CANCELD1',
        status: 'CANCELLED',
        discountPercent: 20,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'CANCELD1' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('CODE_NOT_ACTIVE');
      expect(data.message).toContain('cancelled');
    });

    it('should handle EXPIRED code status', async () => {
      mockAffiliateCodeFindUnique.mockResolvedValue({
        id: 'code-1',
        code: 'EXPSTAT1',
        status: 'EXPIRED',
        discountPercent: 20,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        affiliateProfile: {
          id: 'aff-profile-1',
          status: 'ACTIVE',
          fullName: 'John Doe',
        },
      });

      const { POST } = await import('@/app/api/checkout/validate-code/route');
      const request = new MockRequest(
        'http://localhost/api/checkout/validate-code',
        {
          method: 'POST',
          body: JSON.stringify({ code: 'EXPSTAT1' }),
        }
      );
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('CODE_NOT_ACTIVE');
      expect(data.message).toContain('expired');
    });
  });
});

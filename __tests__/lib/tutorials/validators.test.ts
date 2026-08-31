/**
 * Academy Tutorials Validators Tests
 */

import {
  TUTORIAL_CATEGORIES,
  TUTORIAL_STATUSES,
  adminTutorialListQuerySchema,
  createTutorialFieldsSchema,
  updateTutorialFieldsSchema,
  publicTutorialListQuerySchema,
} from '@/lib/tutorials/validators';

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('adminTutorialListQuerySchema', () => {
  it('defaults page/limit when omitted', () => {
    const result = adminTutorialListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('coerces string page/limit from query params', () => {
    const result = adminTutorialListQuerySchema.parse({
      page: '2',
      limit: '10',
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('rejects a limit above 100', () => {
    expect(
      adminTutorialListQuerySchema.safeParse({ limit: '101' }).success
    ).toBe(false);
  });

  it('rejects an invalid category', () => {
    expect(
      adminTutorialListQuerySchema.safeParse({ category: 'NOT_REAL' }).success
    ).toBe(false);
  });

  it('accepts every real category and status value', () => {
    for (const category of TUTORIAL_CATEGORIES) {
      expect(adminTutorialListQuerySchema.safeParse({ category }).success).toBe(
        true
      );
    }
    for (const status of TUTORIAL_STATUSES) {
      expect(adminTutorialListQuerySchema.safeParse({ status }).success).toBe(
        true
      );
    }
  });
});

describe('createTutorialFieldsSchema', () => {
  const base = {
    title: 'Reading the Order Book',
    description: 'A walkthrough of order-book depth and liquidity sweeps.',
    youtubeUrl: VALID_URL,
    category: 'TRADING_STRATEGIES' as const,
  };

  it('accepts a fully valid payload', () => {
    expect(createTutorialFieldsSchema.safeParse(base).success).toBe(true);
  });

  it('defaults featured to false when omitted', () => {
    const result = createTutorialFieldsSchema.parse(base);
    expect(result.featured).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(
      createTutorialFieldsSchema.safeParse({ ...base, title: '' }).success
    ).toBe(false);
  });

  it('rejects an empty description', () => {
    expect(
      createTutorialFieldsSchema.safeParse({ ...base, description: '' }).success
    ).toBe(false);
  });

  it('rejects a non-YouTube URL', () => {
    expect(
      createTutorialFieldsSchema.safeParse({
        ...base,
        youtubeUrl: 'https://vimeo.com/123456789',
      }).success
    ).toBe(false);
  });

  it('rejects a malformed URL string', () => {
    expect(
      createTutorialFieldsSchema.safeParse({
        ...base,
        youtubeUrl: 'not-a-url',
      }).success
    ).toBe(false);
  });

  it('rejects an invalid category', () => {
    expect(
      createTutorialFieldsSchema.safeParse({ ...base, category: 'BOGUS' })
        .success
    ).toBe(false);
  });
});

describe('updateTutorialFieldsSchema', () => {
  it('accepts a partial payload with only status', () => {
    expect(
      updateTutorialFieldsSchema.safeParse({ status: 'ARCHIVED' }).success
    ).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    expect(updateTutorialFieldsSchema.safeParse({}).success).toBe(true);
  });

  it('still validates youtubeUrl when provided', () => {
    expect(
      updateTutorialFieldsSchema.safeParse({ youtubeUrl: 'not-a-url' }).success
    ).toBe(false);
  });

  it('rejects an invalid status', () => {
    expect(
      updateTutorialFieldsSchema.safeParse({ status: 'PUBLISHED' }).success
    ).toBe(false);
  });
});

describe('publicTutorialListQuerySchema', () => {
  it('accepts an empty object', () => {
    expect(publicTutorialListQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid category filter', () => {
    expect(
      publicTutorialListQuerySchema.safeParse({ category: 'RISK_MANAGEMENT' })
        .success
    ).toBe(true);
  });

  it('rejects an invalid category filter', () => {
    expect(
      publicTutorialListQuerySchema.safeParse({ category: 'BOGUS' }).success
    ).toBe(false);
  });
});

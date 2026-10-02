/**
 * getChartStamp (lib/storage/r2.ts): the stamp of the render stored for a variant,
 * read from the R2 object's metadata with a HEAD request.
 *
 * The AWS SDK is replaced by factories (it ships ESM Jest will not parse, and the
 * real thing would need a bucket), so what is tested is what this code asks of the
 * SDK and what it does with the answers: which command, for which key; a stamp when
 * the metadata is good; `null` when there is no object or no usable stamp; and an
 * error, not a quiet `null`, when it simply could not look.
 */

import { chartObjectKey } from '@/lib/storage/chart-keys';

const mockSend = jest.fn();
const mockS3ClientConstructor = jest.fn();

class MockHeadObjectCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}
class MockGetObjectCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}

jest.mock('@aws-sdk/client-s3', () => ({
  __esModule: true,
  S3Client: function MockS3Client(this: unknown, config: unknown) {
    mockS3ClientConstructor(config);
    return { send: (...args: unknown[]) => mockSend(...args) };
  },
  HeadObjectCommand: MockHeadObjectCommand,
  GetObjectCommand: MockGetObjectCommand,
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  __esModule: true,
  getSignedUrl: jest.fn(),
}));

const SLOT = 1789764900;
const metadata = (overrides: Record<string, string> = {}) => ({
  'cycle-slot': String(SLOT),
  'last-closed-bar': String(SLOT - 300),
  overlay: 'best_fit_a',
  variant: 'overlay',
  'rendered-at': String(SLOT + 70),
  'overlay-m15': 'non_b',
  'overlay-source': 'setting',
  ...overrides,
});

const ORIGINAL_ENV = { ...process.env };

async function load() {
  jest.resetModules(); // a fresh module: the SDK client is cached per module
  return import('@/lib/storage/r2');
}

describe('getChartStamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
    process.env['R2_ACCOUNT_ID'] = 'acct';
    process.env['R2_ACCESS_KEY_ID'] = 'key-id';
    process.env['R2_SECRET_ACCESS_KEY'] = 'not-a-real-secret';
    process.env['R2_BUCKET'] = 'test-bucket';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it.each(['overlay', 'standard'] as const)(
    'asks HeadObject for the %s object in the private bucket, and moves no image bytes',
    async (variant) => {
      mockSend.mockResolvedValue({ Metadata: metadata({ variant }) });
      const { getChartStamp } = await load();

      await getChartStamp(variant);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(MockHeadObjectCommand); // never GetObject
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: chartObjectKey(variant),
      });
    }
  );

  it('returns the stamp when the metadata is good', async () => {
    mockSend.mockResolvedValue({ Metadata: metadata() });
    const { getChartStamp } = await load();
    expect(await getChartStamp('overlay')).toEqual({
      slot: SLOT,
      lastClosedBar: SLOT - 300,
      overlay: 'best_fit_a',
      variant: 'overlay',
      renderedAt: SLOT + 70,
      overlayM15: 'non_b',
      overlaySource: 'setting',
    });
  });

  it('returns the stamp for the standard variant under its own key', async () => {
    mockSend.mockResolvedValue({ Metadata: metadata({ variant: 'standard' }) });
    const { getChartStamp } = await load();
    expect((await getChartStamp('standard'))?.variant).toBe('standard');
  });

  describe('no stamp, but the image is there (the caller still serves it)', () => {
    it('an object without metadata (an image from before stamping)', async () => {
      mockSend.mockResolvedValue({});
      const { getChartStamp } = await load();
      expect(await getChartStamp('overlay')).toBeNull();
      mockSend.mockResolvedValue({ Metadata: {} });
      expect(await getChartStamp('overlay')).toBeNull();
    });

    it('metadata with a required field missing', async () => {
      const partial = metadata();
      delete (partial as Record<string, unknown>)['cycle-slot'];
      mockSend.mockResolvedValue({ Metadata: partial });
      const { getChartStamp } = await load();
      expect(await getChartStamp('overlay')).toBeNull();
    });

    it.each([
      ['a slot that is text', { 'cycle-slot': 'soon' }],
      [
        'a slot off the boundary',
        {
          'cycle-slot': String(SLOT + 7),
          'last-closed-bar': String(SLOT + 7 - 300),
        },
      ],
      [
        'a last closed bar that is not slot - 300',
        { 'last-closed-bar': String(SLOT) },
      ],
      [
        'an overlay that is not a list of indicator names',
        { overlay: 'Best Fit A' },
      ],
      ['a variant that is not this object’s', { variant: 'standard' }],
    ])('metadata with %s', async (_label, overrides) => {
      mockSend.mockResolvedValue({ Metadata: metadata(overrides) });
      const { getChartStamp } = await load();
      expect(await getChartStamp('overlay')).toBeNull();
    });
  });

  describe('no object: null, not an error (the renderer may not have run yet)', () => {
    it.each([
      [
        'a NotFound error (what HeadObject throws)',
        { name: 'NotFound', $metadata: { httpStatusCode: 404 } },
      ],
      ['a NotFound name alone', { name: 'NotFound' }],
      ['NoSuchKey', { name: 'NoSuchKey' }],
      ['a Code of NoSuchKey', { name: 'Error', Code: 'NoSuchKey' }],
      [
        'a bare 404',
        { name: 'UnknownError', $metadata: { httpStatusCode: 404 } },
      ],
    ])('%s', async (_label, error) => {
      mockSend.mockRejectedValue(Object.assign(new Error('not found'), error));
      const { getChartStamp } = await load();
      expect(await getChartStamp('overlay')).toBeNull();
    });
  });

  describe('could not look: an error, never a quiet null', () => {
    it.each([
      [
        'credentials rejected',
        { name: 'Forbidden', $metadata: { httpStatusCode: 403 } },
      ],
      [
        'R2 failing',
        { name: 'InternalError', $metadata: { httpStatusCode: 500 } },
      ],
      ['throttled', { name: 'SlowDown', $metadata: { httpStatusCode: 503 } }],
      ['a network failure', { name: 'Error', code: 'ECONNRESET' }],
    ])('%s', async (_label, error) => {
      const thrown = Object.assign(new Error('cannot look'), error);
      mockSend.mockRejectedValue(thrown);
      const { getChartStamp } = await load();
      await expect(getChartStamp('overlay')).rejects.toBe(thrown);
    });

    it('something that is not even an Error', async () => {
      mockSend.mockRejectedValue('boom');
      const { getChartStamp } = await load();
      await expect(getChartStamp('overlay')).rejects.toBe('boom');
    });

    it('a rejection with nothing in it is rethrown as it is, not turned into a TypeError', async () => {
      mockSend.mockRejectedValue(null);
      const { getChartStamp } = await load();
      await expect(getChartStamp('overlay')).rejects.toBeNull();
    });
  });

  describe('configuration', () => {
    it.each([
      'R2_BUCKET',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ])(
      'a missing %s is reported as "is not set", the same way signing reports it, and nothing is sent',
      async (name) => {
        delete process.env[name];
        mockSend.mockResolvedValue({ Metadata: metadata() });
        const { getChartStamp } = await load();
        await expect(getChartStamp('overlay')).rejects.toThrow(/is not set/);
        expect(mockSend).not.toHaveBeenCalled();
      }
    );

    it('builds the SDK client once and reuses it, against the R2 endpoint', async () => {
      mockSend.mockResolvedValue({ Metadata: metadata() });
      const { getChartStamp } = await load();
      await getChartStamp('overlay');
      await getChartStamp('overlay');
      expect(mockS3ClientConstructor).toHaveBeenCalledTimes(1);
      expect(mockS3ClientConstructor.mock.calls[0][0]).toMatchObject({
        region: 'auto',
        endpoint: 'https://acct.r2.cloudflarestorage.com',
      });
    });
  });
});

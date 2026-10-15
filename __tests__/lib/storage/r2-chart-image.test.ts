/**
 * getChartImage (lib/storage/r2.ts): the bytes of the render stored for a variant, read for the
 * reply path (build step 7 part 5; finding S7-F8), with the stamp of the object it downloaded.
 *
 * Like the stamp test, the AWS SDK is replaced by factories: what is tested is what this code
 * asks of the SDK and what it does with the answers.
 */

import { chartObjectKey } from '@/lib/storage/chart-keys';

const mockSend = jest.fn();

class MockHeadObjectCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}
class MockGetObjectCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}

jest.mock('@aws-sdk/client-s3', () => ({
  __esModule: true,
  S3Client: function MockS3Client() {
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
  ...overrides,
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const body = (bytes: Uint8Array = PNG) => ({
  transformToByteArray: async () => bytes,
});

const ORIGINAL_ENV = { ...process.env };

async function load() {
  jest.resetModules();
  return import('@/lib/storage/r2');
}

describe('getChartImage', () => {
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
    'asks GetObject for the %s object in the private bucket',
    async (variant) => {
      mockSend.mockResolvedValue({
        Body: body(),
        ContentType: 'image/png',
        Metadata: metadata({ variant }),
      });
      const { getChartImage } = await load();

      await getChartImage(variant);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(MockGetObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: chartObjectKey(variant),
      });
    }
  );

  it('returns the bytes, the type and the stamp of the object it downloaded', async () => {
    mockSend.mockResolvedValue({
      Body: body(),
      ContentType: 'image/png',
      ContentLength: PNG.byteLength,
      Metadata: metadata(),
    });
    const { getChartImage } = await load();

    const image = await getChartImage('overlay');

    expect(image).not.toBeNull();
    expect(Array.from(image?.bytes ?? [])).toEqual(Array.from(PNG));
    expect(image?.contentType).toBe('image/png');
    expect(image?.stamp).toEqual({
      slot: SLOT,
      lastClosedBar: SLOT - 300,
      overlay: 'best_fit_a',
      variant: 'overlay',
    });
  });

  it('says the image has no stamp when its metadata is missing or corrupt, and still returns the bytes', async () => {
    mockSend.mockResolvedValue({ Body: body() });
    const { getChartImage } = await load();
    const unstamped = await getChartImage('overlay');
    expect(unstamped?.stamp).toBeNull();
    expect(unstamped?.contentType).toBe('image/png');

    mockSend.mockResolvedValue({
      Body: body(),
      Metadata: metadata({ 'cycle-slot': '123' }),
    });
    expect((await getChartImage('overlay'))?.stamp).toBeNull();

    // a stamp for the other variant is a corrupt pair, not a stamp
    mockSend.mockResolvedValue({
      Body: body(),
      Metadata: metadata({ variant: 'standard' }),
    });
    expect((await getChartImage('overlay'))?.stamp).toBeNull();
  });

  it('returns null when there is no such object, in every shape the SDK reports it', async () => {
    const { getChartImage } = await load();
    for (const error of [
      Object.assign(new Error('x'), { name: 'NoSuchKey' }),
      Object.assign(new Error('x'), { name: 'NotFound' }),
      Object.assign(new Error('x'), { Code: 'NoSuchKey' }),
      Object.assign(new Error('x'), { $metadata: { httpStatusCode: 404 } }),
    ]) {
      mockSend.mockRejectedValueOnce(error);
      await expect(getChartImage('overlay')).resolves.toBeNull();
    }
  });

  it('throws, and does not hide it as "no chart", when it simply could not look', async () => {
    const { getChartImage } = await load();
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('denied'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      })
    );
    await expect(getChartImage('overlay')).rejects.toThrow('denied');
    mockSend.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(getChartImage('overlay')).rejects.toThrow('socket hang up');
  });

  it('refuses an object over the size limit, by its declared length and by its real one', async () => {
    const { getChartImage, MAX_CHART_IMAGE_BYTES } = await load();
    expect(MAX_CHART_IMAGE_BYTES).toBe(8 * 1024 * 1024);

    const readBody = jest.fn(async () => PNG);
    mockSend.mockResolvedValueOnce({
      Body: { transformToByteArray: readBody },
      ContentLength: MAX_CHART_IMAGE_BYTES + 1,
      Metadata: metadata(),
    });
    await expect(getChartImage('overlay')).rejects.toThrow(/the most read is/);
    expect(readBody).not.toHaveBeenCalled(); // never buffered

    // exactly the limit is allowed
    mockSend.mockResolvedValueOnce({
      Body: body(),
      ContentLength: MAX_CHART_IMAGE_BYTES,
      Metadata: metadata(),
    });
    await expect(getChartImage('overlay')).resolves.not.toBeNull();

    // no declared length: the bytes themselves are counted, and exactly the limit is allowed
    mockSend.mockResolvedValueOnce({
      Body: body(new Uint8Array(MAX_CHART_IMAGE_BYTES)),
      Metadata: metadata(),
    });
    await expect(getChartImage('overlay')).resolves.not.toBeNull();
    mockSend.mockResolvedValueOnce({
      Body: body(new Uint8Array(MAX_CHART_IMAGE_BYTES + 1)),
      Metadata: metadata(),
    });
    await expect(getChartImage('overlay')).rejects.toThrow(/the most read is/);
  });

  it('throws when the object has no body', async () => {
    mockSend.mockResolvedValue({ Metadata: metadata() });
    const { getChartImage } = await load();
    await expect(getChartImage('overlay')).rejects.toThrow('no body');
  });

  it('needs the bucket to be configured', async () => {
    delete process.env['R2_BUCKET'];
    const { getChartImage } = await load();
    await expect(getChartImage('overlay')).rejects.toThrow('R2_BUCKET');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

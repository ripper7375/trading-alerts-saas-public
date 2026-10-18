/**
 * @jest-environment node
 *
 * The R2 S3Client's socket timeouts (Next.js remediation T1-a).
 *
 * A short wall-clock AbortSignal on send() would cut getChartImage's
 * transformToByteArray() stream mid-download, so the client is given a
 * connection timeout and a socket-inactivity timeout through `requestHandler`
 * instead. The AWS SDK is replaced by a factory: what is tested is what this
 * code asks of it.
 */

const mockS3ClientConfigs: Array<Record<string, unknown>> = [];

jest.mock('@aws-sdk/client-s3', () => ({
  __esModule: true,
  S3Client: function MockS3Client(config: Record<string, unknown>) {
    mockS3ClientConfigs.push(config);
    return { send: jest.fn().mockResolvedValue({}) };
  },
  HeadObjectCommand: class {},
  GetObjectCommand: class {},
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  __esModule: true,
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/url'),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockS3ClientConfigs.length = 0;
  jest.resetModules();
  process.env['R2_ACCOUNT_ID'] = 'acct';
  process.env['R2_ACCESS_KEY_ID'] = 'key-id';
  process.env['R2_SECRET_ACCESS_KEY'] = 'not-a-real-secret';
  process.env['R2_BUCKET'] = 'bucket';
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('R2 S3Client configuration', () => {
  it('sets a 3 s connection timeout and a 10 s socket-inactivity timeout', async () => {
    const { getSignedChartUrl } = await import('@/lib/storage/r2');

    await getSignedChartUrl('overlay');

    expect(mockS3ClientConfigs).toHaveLength(1);
    expect(mockS3ClientConfigs[0]?.['requestHandler']).toEqual({
      connectionTimeout: 3_000,
      requestTimeout: 10_000,
    });
  });

  it('keeps the endpoint, region and credentials it had', async () => {
    const { getSignedChartUrl } = await import('@/lib/storage/r2');

    await getSignedChartUrl('overlay');

    expect(mockS3ClientConfigs[0]).toMatchObject({
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'key-id',
        secretAccessKey: 'not-a-real-secret',
      },
    });
  });
});

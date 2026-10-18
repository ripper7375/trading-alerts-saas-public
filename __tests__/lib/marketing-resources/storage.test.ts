/**
 * @jest-environment node
 *
 * T2-e / INP-04: what an admin upload may name its blob, and what content type
 * the blob is served with.
 */

const mockPut = jest.fn();
const mockDel = jest.fn();
jest.mock('@vercel/blob', () => ({
  __esModule: true,
  put: (...a: unknown[]) => mockPut(...a),
  del: (...a: unknown[]) => mockDel(...a),
}));

import {
  deleteAssetFile,
  sanitizeAssetFilename,
  uploadAssetFile,
} from '@/lib/marketing-resources/storage';

beforeEach(() => {
  jest.resetAllMocks();
  mockPut.mockResolvedValue({
    url: 'https://x.public.blob.vercel-storage.com/marketing-resources/logo-abc.png',
  });
});

describe('sanitizeAssetFilename', () => {
  it.each([
    ['logo.png', 'logo.png'],
    ['brand_kit-v2.final.pdf', 'brand_kit-v2.final.pdf'],
    ['my logo (1).png', 'my_logo__1_.png'],
    ['../../etc/passwd', '_.._etc_passwd'],
    ['..\\..\\boot.ini', '_.._boot.ini'],
    ['a/b/c.png', 'a_b_c.png'],
    ['<script>alert(1)</script>.svg', '_script_alert_1___script_.svg'],
    ['ธง.png', '__.png'], // one `_` for each non-ASCII character
    ['line\nbreak\u0000.png', 'line_break_.png'],
    ['.htaccess', 'htaccess'],
    ['..', 'file'],
    ['...', 'file'],
    ['', 'file'],
  ])('%j -> %j', (input, expected) => {
    expect(sanitizeAssetFilename(input)).toBe(expected);
  });

  it('never returns a path separator or a leading dot', () => {
    for (const input of [
      '/abs',
      '\\abs',
      './x',
      '.\\x',
      '%2e%2e%2fx',
      'a\\..\\b',
    ]) {
      const safe = sanitizeAssetFilename(input);
      expect(safe).not.toMatch(/[\\/]/);
      expect(safe.startsWith('.')).toBe(false);
      expect(safe).toMatch(/^[a-zA-Z0-9._-]+$/);
    }
  });
});

describe('uploadAssetFile', () => {
  it('puts the blob under the prefix with a sanitized name', async () => {
    const file = new File(['png'], '../../logo (final).png', {
      type: 'image/png',
    });

    const result = await uploadAssetFile(file);

    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0]?.[0]).toBe(
      'marketing-resources/_.._logo__final_.png'
    );
    expect(mockPut.mock.calls[0]?.[1]).toBe(file);
    expect(result).toEqual({
      url: 'https://x.public.blob.vercel-storage.com/marketing-resources/logo-abc.png',
      size: file.size,
    });
  });

  it('keeps the public access and the random suffix', async () => {
    await uploadAssetFile(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(mockPut.mock.calls[0]?.[2]).toMatchObject({
      access: 'public',
      addRandomSuffix: true,
    });
  });

  it('serves the blob with the validated type, not one guessed from the name', async () => {
    // An HTML payload that claims to be a PNG (the route's allow-list checks
    // the claimed type): the blob is stored as image/png, whatever the name says.
    await uploadAssetFile(
      new File(['<script>1</script>'], 'evil.html', { type: 'image/png' })
    );

    expect(mockPut.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/png',
    });
  });

  it('passes no contentType when the file has none (Blob then decides)', async () => {
    await uploadAssetFile(new File(['x'], 'a.bin'));

    expect(mockPut.mock.calls[0]?.[2]).not.toHaveProperty('contentType');
  });

  it('passes no option that @vercel/blob does not know (contentDisposition is not a put() option)', async () => {
    await uploadAssetFile(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(Object.keys(mockPut.mock.calls[0]?.[2] as object).sort()).toEqual([
      'access',
      'addRandomSuffix',
      'contentType',
    ]);
  });

  it('a Blob failure propagates (the route answers 500)', async () => {
    mockPut.mockRejectedValue(new Error('blob down'));

    await expect(
      uploadAssetFile(new File(['x'], 'a.png', { type: 'image/png' }))
    ).rejects.toThrow('blob down');
  });
});

describe('deleteAssetFile (unchanged)', () => {
  it('deletes only URLs under its own prefix', async () => {
    mockDel.mockResolvedValue(undefined);

    await deleteAssetFile(
      'https://x.public.blob.vercel-storage.com/marketing-resources/logo-abc.png'
    );
    await deleteAssetFile('/brand/seeded.png');

    expect(mockDel).toHaveBeenCalledTimes(1);
  });
});

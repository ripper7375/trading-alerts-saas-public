/**
 * @jest-environment node
 *
 * T2-e / INP-04: what an admin upload may name its blob, and what content type
 * the blob is served with.
 *
 * CODE-12: the type is read from the file's first bytes (never from the
 * browser's Content-Type or the file name), and a file that is not PNG, JPEG,
 * PDF or MP4 by content (an SVG, an HTML page) is refused before Blob is called.
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
import { AssetContentTypeError } from '@/lib/marketing-resources/validators';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PDF = Array.from('%PDF-1.7', (ch) => ch.charCodeAt(0));
const MP4 = [
  0,
  0,
  0,
  0x18,
  ...Array.from('ftypmp42', (ch) => ch.charCodeAt(0)),
];

function fileOf(content: number[] | string, name: string, type?: string): File {
  const part = typeof content === 'string' ? content : Uint8Array.from(content);
  return new File([part], name, type === undefined ? undefined : { type });
}

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
    const file = fileOf(PNG, '../../logo (final).png', 'image/png');

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
    await uploadAssetFile(fileOf(PNG, 'a.png', 'image/png'));

    expect(mockPut.mock.calls[0]?.[2]).toMatchObject({
      access: 'public',
      addRandomSuffix: true,
    });
  });

  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['PDF', PDF, 'application/pdf'],
    ['MP4', MP4, 'video/mp4'],
  ])(
    'serves a %s with the type its first bytes show',
    async (_l, bytes, type) => {
      await uploadAssetFile(fileOf(bytes, 'asset.bin', type));

      expect(mockPut.mock.calls[0]?.[2]).toMatchObject({ contentType: type });
    }
  );

  it('serves the type the content shows, not the one the browser claimed', async () => {
    // A JPEG that the browser reported as a PNG (a wrong extension): the first
    // bytes decide.
    await uploadAssetFile(fileOf(JPEG, 'photo.png', 'image/png'));

    expect(mockPut.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/jpeg',
    });
  });

  it('serves the type of the content when the browser reported none', async () => {
    await uploadAssetFile(fileOf(PNG, 'a.bin'));

    expect(mockPut.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/png',
    });
  });

  it.each([
    [
      'an SVG that claims image/svg+xml',
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      'logo.svg',
      'image/svg+xml',
    ],
    [
      'an SVG that claims image/png',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
      'logo.png',
      'image/png',
    ],
    [
      'an SVG with an XML prolog that claims image/jpeg',
      '<?xml version="1.0"?><svg onload="alert(1)"/>',
      'logo.jpg',
      'image/jpeg',
    ],
    [
      'an HTML page that claims image/png',
      '<script>1</script>',
      'evil.html',
      'image/png',
    ],
    [
      'a text file that claims application/pdf',
      'hello',
      'a.pdf',
      'application/pdf',
    ],
    ['a file with no claimed type', '<svg/>', 'a.bin', ''],
  ])('refuses %s and never calls Blob', async (_l, content, name, type) => {
    await expect(
      uploadAssetFile(fileOf(content, name, type))
    ).rejects.toBeInstanceOf(AssetContentTypeError);

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('reads the type from the start of a file that is longer than the sniffed head', async () => {
    // Only the first bytes decide: a PNG signature followed by a long body is a
    // PNG (and is stored as image/png whatever the body holds) ...
    await uploadAssetFile(
      fileOf(
        [
          ...PNG,
          ...Array.from('<svg onload="1"/>'.repeat(40), (c) => c.charCodeAt(0)),
        ],
        'a.png',
        'image/png'
      )
    );
    expect(mockPut.mock.calls[0]?.[2]).toMatchObject({
      contentType: 'image/png',
    });

    // ... and a signature at the END of a file does not make it one.
    mockPut.mockClear();
    await expect(
      uploadAssetFile(
        fileOf(
          [
            ...Array.from('<svg onload="1"/>'.repeat(40), (c) =>
              c.charCodeAt(0)
            ),
            ...PNG,
          ],
          'a.png',
          'image/png'
        )
      )
    ).rejects.toBeInstanceOf(AssetContentTypeError);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('does not read the whole file to find its type (50MB allowed)', async () => {
    const file = fileOf(PNG, 'a.png', 'image/png');
    const readAll = jest.spyOn(file, 'arrayBuffer');

    await uploadAssetFile(file);

    expect(readAll).not.toHaveBeenCalled();
    expect(mockPut.mock.calls[0]?.[1]).toBe(file);
  });

  it('refuses an empty file', async () => {
    await expect(
      uploadAssetFile(fileOf([], 'a.png', 'image/png'))
    ).rejects.toBeInstanceOf(AssetContentTypeError);

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('refuses a file whose signature is not at the very start', async () => {
    await expect(
      uploadAssetFile(fileOf([0x20, ...PNG], 'a.png', 'image/png'))
    ).rejects.toBeInstanceOf(AssetContentTypeError);

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('passes no option that @vercel/blob does not know (contentDisposition is not a put() option)', async () => {
    await uploadAssetFile(fileOf(PNG, 'a.png', 'image/png'));

    expect(Object.keys(mockPut.mock.calls[0]?.[2] as object).sort()).toEqual([
      'access',
      'addRandomSuffix',
      'contentType',
    ]);
  });

  it('a Blob failure propagates (the route answers 500)', async () => {
    mockPut.mockRejectedValue(new Error('blob down'));

    await expect(
      uploadAssetFile(fileOf(PNG, 'a.png', 'image/png'))
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

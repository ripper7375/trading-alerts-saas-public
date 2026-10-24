/**
 * Marketing Resources Validators Tests
 *
 * CODE-12: the Media Kit accepts PNG, JPG, MP4 and PDF only (no SVG: an SVG
 * served from the Blob origin can run script), and the type of an upload is
 * decided by the file's first bytes, not by the browser's Content-Type.
 */

import {
  ACCEPTED_ASSET_MIME_TYPES,
  ASSET_SNIFF_BYTES,
  detectAssetMimeType,
  isAcceptedAssetMimeType,
} from '@/lib/marketing-resources/validators';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const ascii = (text: string): Uint8Array =>
  Uint8Array.from(Array.from(text, (ch) => ch.charCodeAt(0)));
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const PNG_SIGNATURE = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

describe('isAcceptedAssetMimeType', () => {
  it('accepts every type in the allowlist (PNG, JPG, MP4, PDF)', () => {
    for (const mimeType of Object.keys(ACCEPTED_ASSET_MIME_TYPES)) {
      expect(isAcceptedAssetMimeType(mimeType)).toBe(true);
    }
  });

  it('lists exactly PNG, JPG, MP4 and PDF', () => {
    expect(ACCEPTED_ASSET_MIME_TYPES).toEqual({
      'image/png': 'PNG',
      'image/jpeg': 'JPG',
      'video/mp4': 'MP4',
      'application/pdf': 'PDF',
    });
  });

  it('rejects SVG (CODE-12: it can carry script)', () => {
    expect(isAcceptedAssetMimeType('image/svg+xml')).toBe(false);
    expect(Object.values(ACCEPTED_ASSET_MIME_TYPES)).not.toContain('SVG');
  });

  it('rejects an arbitrary/unadvertised type', () => {
    expect(isAcceptedAssetMimeType('application/zip')).toBe(false);
    expect(isAcceptedAssetMimeType('text/html')).toBe(false);
    expect(isAcceptedAssetMimeType('application/x-msdownload')).toBe(false);
  });

  it('rejects an empty string (no type reported by the browser)', () => {
    expect(isAcceptedAssetMimeType('')).toBe(false);
  });

  it('is not fooled by prototype-chain properties', () => {
    expect(isAcceptedAssetMimeType('toString')).toBe(false);
    expect(isAcceptedAssetMimeType('constructor')).toBe(false);
  });
});

describe('detectAssetMimeType', () => {
  it('reads PNG from its 8-byte signature', () => {
    expect(
      detectAssetMimeType(concat(PNG_SIGNATURE, ascii('\0\0\0\rIHDR')))
    ).toBe('image/png');
  });

  it('reads JPEG from FF D8 FF, whatever the next marker is', () => {
    expect(detectAssetMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16))).toBe(
      'image/jpeg'
    );
    expect(detectAssetMimeType(bytes(0xff, 0xd8, 0xff, 0xe1, 0, 16))).toBe(
      'image/jpeg'
    );
  });

  it('reads PDF from %PDF-', () => {
    expect(detectAssetMimeType(ascii('%PDF-1.7\n%\xe2\xe3'))).toBe(
      'application/pdf'
    );
  });

  it('reads MP4 from the ftyp box at offset 4', () => {
    expect(
      detectAssetMimeType(concat(bytes(0, 0, 0, 0x18), ascii('ftypmp42')))
    ).toBe('video/mp4');
  });

  it.each([
    ['SVG', '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'],
    ['SVG with an XML prolog', '<?xml version="1.0"?><svg onload="alert(1)"/>'],
    ['SVG with a doctype', '<!DOCTYPE svg PUBLIC "x"><svg/>'],
    ['SVG after whitespace', '\n  \t<svg xmlns="http://www.w3.org/2000/svg"/>'],
    ['SVG after a UTF-8 byte order mark', '\xef\xbb\xbf<svg/>'],
    ['HTML', '<html><script>alert(1)</script></html>'],
    ['plain text', 'hello'],
  ])('rejects %s', (_label, text) => {
    expect(detectAssetMimeType(ascii(text))).toBeNull();
  });

  it('rejects an empty buffer and one shorter than any signature', () => {
    expect(detectAssetMimeType(new Uint8Array(0))).toBeNull();
    expect(detectAssetMimeType(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(detectAssetMimeType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectAssetMimeType(ascii('%PDF'))).toBeNull();
  });

  it('rejects a signature that is not at the very start', () => {
    expect(detectAssetMimeType(concat(ascii('<svg/>'), PNG_SIGNATURE))).toBe(
      null
    );
    expect(detectAssetMimeType(concat(bytes(0), PNG_SIGNATURE))).toBeNull();
    expect(
      detectAssetMimeType(concat(ascii(' '), ascii('%PDF-1.4')))
    ).toBeNull();
    expect(
      detectAssetMimeType(concat(bytes(0), bytes(0xff, 0xd8, 0xff, 0xe0)))
    ).toBeNull();
    expect(
      detectAssetMimeType(concat(bytes(0, 0, 0, 0x18, 0), ascii('ftypmp42')))
    ).toBeNull();
  });

  it('rejects a near-miss of each signature', () => {
    expect(
      detectAssetMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b))
    ).toBeNull();
    expect(detectAssetMimeType(bytes(0xff, 0xd8, 0xfe, 0xe0))).toBeNull();
    expect(detectAssetMimeType(ascii('%PDF1.7'))).toBeNull();
    expect(
      detectAssetMimeType(concat(bytes(0, 0, 0, 0x18), ascii('ftxpmp42')))
    ).toBeNull();
  });

  it('only needs the first ASSET_SNIFF_BYTES bytes', () => {
    expect(ASSET_SNIFF_BYTES).toBeGreaterThanOrEqual(12);
    expect(
      detectAssetMimeType(
        concat(PNG_SIGNATURE, ascii('x')).subarray(0, ASSET_SNIFF_BYTES)
      )
    ).toBe('image/png');
    expect(
      detectAssetMimeType(
        concat(bytes(0, 0, 0, 0x18), ascii('ftypmp42')).subarray(
          0,
          ASSET_SNIFF_BYTES
        )
      )
    ).toBe('video/mp4');
  });

  it('only ever answers with a type from the allowlist', () => {
    const samples = [
      concat(PNG_SIGNATURE, ascii('rest')),
      bytes(0xff, 0xd8, 0xff, 0xdb),
      ascii('%PDF-1.4'),
      concat(bytes(0, 0, 0, 0x18), ascii('ftypisom')),
    ];
    for (const sample of samples) {
      const detected = detectAssetMimeType(sample);
      expect(detected).not.toBeNull();
      expect(isAcceptedAssetMimeType(detected as string)).toBe(true);
    }
  });
});

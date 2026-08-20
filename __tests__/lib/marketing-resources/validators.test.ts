/**
 * Marketing Resources Validators Tests
 */

import {
  ACCEPTED_ASSET_MIME_TYPES,
  isAcceptedAssetMimeType,
} from '@/lib/marketing-resources/validators';

describe('isAcceptedAssetMimeType', () => {
  it('accepts every type in the allowlist (PNG, JPG, SVG, MP4, PDF)', () => {
    for (const mimeType of Object.keys(ACCEPTED_ASSET_MIME_TYPES)) {
      expect(isAcceptedAssetMimeType(mimeType)).toBe(true);
    }
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

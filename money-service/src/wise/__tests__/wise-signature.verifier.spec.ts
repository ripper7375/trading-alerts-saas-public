/**
 * Wise Signature Verifier Tests (Session 4A-W3a, File 10/10)
 *
 * Wise's real private key is never available to us — only the published
 * verification (public) keys. To test the "valid signature" path, this
 * suite substitutes a locally generated RSA key pair for the module's
 * public-key constants (jest.mock) and signs with the matching private
 * key, exercising the exact same `crypto.verify('RSA-SHA256', ...)` call
 * the verifier makes against Wise's real keys in production.
 */
import { generateKeyPairSync, sign as cryptoSign } from 'crypto';

const mockKeyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const mockWrongKeyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('../wise-signature.constants', () => ({
  __esModule: true,
  WISE_SANDBOX_PUBLIC_KEY_PEM: mockKeyPair.publicKey,
  WISE_PRODUCTION_PUBLIC_KEY_PEM: mockKeyPair.publicKey,
}));

// eslint-disable-next-line import/order
import { WiseSignatureVerifier } from '../wise-signature.verifier';

function signBody(body: string | Buffer, privateKey: string): string {
  const bodyBuffer = typeof body === 'string' ? Buffer.from(body) : body;
  return cryptoSign('RSA-SHA256', bodyBuffer, privateKey).toString('base64');
}

describe('WiseSignatureVerifier', () => {
  let verifier: WiseSignatureVerifier;

  beforeEach(() => {
    verifier = new WiseSignatureVerifier();
  });

  it('accepts a validly signed payload', () => {
    const body = JSON.stringify({ event_type: 'transfers#state-change' });
    const signature = signBody(body, mockKeyPair.privateKey);

    expect(verifier.verifySignature(body, signature, 'sandbox')).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const originalBody = JSON.stringify({ amount: 100 });
    const signature = signBody(originalBody, mockKeyPair.privateKey);
    const tamperedBody = JSON.stringify({ amount: 999999 });

    expect(verifier.verifySignature(tamperedBody, signature, 'sandbox')).toBe(
      false
    );
  });

  it('rejects a signature made with the wrong key', () => {
    const body = JSON.stringify({ event_type: 'transfers#state-change' });
    const signature = signBody(body, mockWrongKeyPair.privateKey);

    expect(verifier.verifySignature(body, signature, 'sandbox')).toBe(false);
  });

  it('rejects a malformed base64 signature without throwing', () => {
    const body = JSON.stringify({ event_type: 'x' });

    expect(() =>
      verifier.verifySignature(body, 'not-valid-base64!!!***', 'sandbox')
    ).not.toThrow();
    expect(
      verifier.verifySignature(body, 'not-valid-base64!!!***', 'sandbox')
    ).toBe(false);
  });

  it('rejects an empty body without throwing', () => {
    const signature = signBody('irrelevant', mockKeyPair.privateKey);

    expect(() =>
      verifier.verifySignature('', signature, 'sandbox')
    ).not.toThrow();
    expect(verifier.verifySignature('', signature, 'sandbox')).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifier.verifySignature('body', '', 'sandbox')).toBe(false);
  });
});

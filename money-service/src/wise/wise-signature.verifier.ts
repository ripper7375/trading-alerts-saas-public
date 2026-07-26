/**
 * Wise Webhook Signature Verifier (Session 4A-W3a, File 6/10)
 *
 * Verifies Wise's `X-Signature-SHA256` header against the raw request body
 * using Node's built-in `crypto.verify` (RSA-SHA256, asymmetric — there is
 * no shared secret, so no `timingSafeEqual` is needed; `crypto.verify` is
 * already constant-time-safe for the comparison it performs internally).
 * Built in this session so Session 4A-W5's webhook receiver inherits a
 * fully-tested verifier ready-made.
 */

import { verify } from 'crypto';

import { Injectable } from '@nestjs/common';

import { logger } from '../common/logger.util';

import {
  WISE_PRODUCTION_PUBLIC_KEY_PEM,
  WISE_SANDBOX_PUBLIC_KEY_PEM,
} from './wise-signature.constants';
import type { WiseEnvironment } from './wise.config';

@Injectable()
export class WiseSignatureVerifier {
  verifySignature(
    rawBody: string | Buffer,
    signatureBase64: string,
    env: WiseEnvironment
  ): boolean {
    if (!signatureBase64) {
      logger.warn('Wise webhook signature: missing signature header');
      return false;
    }

    const bodyBuffer =
      typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
    if (bodyBuffer.length === 0) {
      logger.warn('Wise webhook signature: empty body');
      return false;
    }

    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    if (signatureBuffer.length === 0) {
      logger.warn('Wise webhook signature: malformed base64 signature');
      return false;
    }

    const publicKeyPem =
      env === 'production'
        ? WISE_PRODUCTION_PUBLIC_KEY_PEM
        : WISE_SANDBOX_PUBLIC_KEY_PEM;

    try {
      return verify('RSA-SHA256', bodyBuffer, publicKeyPem, signatureBuffer);
    } catch (error) {
      logger.warn('Wise webhook signature: verify() threw', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

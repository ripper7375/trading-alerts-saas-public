/**
 * Cloudflare R2 access for the multi-timeframe chart renders.
 *
 * The bucket is PRIVATE. That is the whole point: the object names are
 * deterministic (`mtf_render_xauusd_m5_m15_overlay.png`), so a public bucket
 * would make the PRO gate on the download route cosmetic -- anyone told the URL
 * could fetch it. Instead the gated route mints a short-lived presigned URL and
 * redirects to it, which keeps egress on R2 while making a leaked link expire in
 * about a minute.
 *
 * Deliberately narrow. This is not a general storage abstraction:
 * `lib/marketing-resources/storage.ts` remains the Vercel Blob path for media
 * assets, which are public by design. Two providers is a real cost, recorded in
 * the delivery plan, but they have genuinely different access models.
 *
 * Object naming lives in `chart-keys.ts` so callers that only need to parse a
 * variant do not load the AWS SDK.
 *
 * @module lib/storage/r2
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { chartObjectKey, type ChartVariant } from './chart-keys';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The chart download requires R2 credentials; ` +
        'see the delivery plan for the five R2_* keys.'
    );
  }
  return value;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  client = new S3Client({
    // R2 ignores region but the SDK requires one.
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
  return client;
}

function signedUrlTtlSeconds(): number {
  const raw = process.env['R2_SIGNED_URL_TTL_SECONDS'];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

/**
 * Presigned GET URL for one variant, valid for `R2_SIGNED_URL_TTL_SECONDS`.
 *
 * Signing does not check that the object exists -- a URL for a missing key
 * signs fine and 404s when followed. The render service may legitimately not
 * have run yet, so the caller decides how to present that.
 */
export async function getSignedChartUrl(
  variant: ChartVariant
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: requireEnv('R2_BUCKET'),
    Key: chartObjectKey(variant),
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: signedUrlTtlSeconds(),
  });
}

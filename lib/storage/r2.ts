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

import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  chartObjectKey,
  parseChartStamp,
  type ChartStamp,
  type ChartVariant,
} from './chart-keys';

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

/** The SDK's "no such object" in all the shapes it takes (HEAD has no body, so no error code). */
function isObjectNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === 'NotFound' ||
    e.name === 'NoSuchKey' ||
    e.Code === 'NoSuchKey' ||
    e.$metadata?.httpStatusCode === 404
  );
}

/**
 * The stamp of the render stored for a variant (rule 8, ADR-014): which cycle slot it
 * was drawn for, its last closed bar, the indicators it shows and its variant, read from
 * the object's metadata with a HEAD request (no image bytes move).
 *
 * `null` when the object does not exist (the renderer has not run yet) and when its
 * metadata is missing or cannot be trusted (an image from before stamping, or a
 * corrupt one): both mean "no stamp", and the caller still serves the image. Any other
 * failure (credentials, network, R2 down) is thrown, not hidden as "no stamp", so the
 * caller can tell "this image has no stamp" from "I could not look".
 */
export async function getChartStamp(
  variant: ChartVariant
): Promise<ChartStamp | null> {
  const command = new HeadObjectCommand({
    Bucket: requireEnv('R2_BUCKET'),
    Key: chartObjectKey(variant),
  });

  try {
    const head = await getClient().send(command);
    return parseChartStamp(head.Metadata, variant);
  } catch (error) {
    if (isObjectNotFound(error)) return null;
    throw error;
  }
}

/**
 * The most bytes of a chart image the reply path will read (the renders are a few hundred
 * kilobytes; a larger object is something else and is refused, not buffered).
 */
export const MAX_CHART_IMAGE_BYTES = 8 * 1024 * 1024;

/** An image read server-side, with the stamp of the very object that was downloaded. */
export interface ChartImageObject {
  bytes: Uint8Array;
  contentType: string;
  /** parsed from this object's own metadata: `null` when there is none or it cannot be trusted */
  stamp: ChartStamp | null;
}

/**
 * The bytes of the render stored for a variant, for the reply path (architecture 5.3 and 5.11:
 * the chart goes to the model only when its stamp says it is the cycle's own). The stamp comes
 * back WITH the bytes, from the same GET, so an image the renderer replaced between a HEAD and
 * this read is judged by what it really is.
 *
 * `null` when the object does not exist. An object over `MAX_CHART_IMAGE_BYTES`, one with no body
 * and any other failure (credentials, network, R2 down) are thrown: "I could not look" is not
 * "there is no chart".
 */
export async function getChartImage(
  variant: ChartVariant
): Promise<ChartImageObject | null> {
  const command = new GetObjectCommand({
    Bucket: requireEnv('R2_BUCKET'),
    Key: chartObjectKey(variant),
  });

  try {
    const response = await getClient().send(command);
    if (
      typeof response.ContentLength === 'number' &&
      response.ContentLength > MAX_CHART_IMAGE_BYTES
    ) {
      throw new Error(
        `the chart object is ${response.ContentLength} bytes; the most read is ${MAX_CHART_IMAGE_BYTES}`
      );
    }
    if (!response.Body) throw new Error('the chart object has no body');
    const bytes = await response.Body.transformToByteArray();
    if (bytes.byteLength > MAX_CHART_IMAGE_BYTES) {
      throw new Error(
        `the chart object is ${bytes.byteLength} bytes; the most read is ${MAX_CHART_IMAGE_BYTES}`
      );
    }
    return {
      bytes,
      contentType: response.ContentType ?? 'image/png',
      stamp: parseChartStamp(response.Metadata, variant),
    };
  } catch (error) {
    if (isObjectNotFound(error)) return null;
    throw error;
  }
}

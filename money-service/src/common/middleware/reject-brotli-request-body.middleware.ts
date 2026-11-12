import type { NextFunction, Request, Response } from 'express';

/**
 * Content codings refused on request bodies. Only Brotli is listed because the
 * Node advisory behind this guard (CVE-2026-111497) is about Node's Brotli
 * decoder. Add a coding here to refuse it as well.
 */
const REFUSED_CODINGS: ReadonlySet<string> = new Set(['br']);

/** `Content-Encoding` is a comma-separated, case-insensitive list of tokens. */
function declaresRefusedCoding(contentEncoding: string): boolean {
  return contentEncoding
    .split(',')
    .some((coding) => REFUSED_CODINGS.has(coding.trim().toLowerCase()));
}

/**
 * Refuses a request that declares a Brotli body (`Content-Encoding: br`) with
 * 415, before any body parser can decompress it.
 *
 * Why: Express 5's body-parser 2.x decompresses `br` request bodies with
 * Node's zlib by default, for every request, before routing, guards or
 * authentication. A decoder flaw in Node (CVE-2026-111497, fixed in Node
 * 22.23.4 and 24.22.1) is therefore reachable by anyone who can send a
 * request. We know of no client that sends Brotli request bodies, so refusing
 * them costs nothing and removes that path whatever Node patch level the host
 * runs. gzip and deflate are left alone.
 *
 * Register it with `app.use()` in main.ts, before `app.listen()`. Nest
 * installs its body parsers when the app initialises, so Express middleware
 * added earlier runs first. Do not move it into a module's `configure()`: that
 * runs after the parsers, so the request would still get its 415, but only
 * after the decoder had already run (its spec measures this).
 */
export function rejectBrotliRequestBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const encoding = req.headers['content-encoding'];

  if (encoding !== undefined && declaresRefusedCoding(encoding)) {
    res.status(415).set('Accept-Encoding', 'gzip, deflate, identity').json({
      statusCode: 415,
      error: 'Unsupported Media Type',
      message:
        'This Content-Encoding is not accepted on request bodies. Send the body uncompressed, or with gzip or deflate.',
    });
    return;
  }

  next();
}

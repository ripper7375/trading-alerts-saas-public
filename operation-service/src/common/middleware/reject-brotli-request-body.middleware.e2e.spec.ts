/**
 * Proves rejectBrotliRequestBody keeps Node's Brotli decoder away from request
 * bodies, against a real Nest app with its real body-parser and supertest.
 * Same pattern as correlation-id.middleware.e2e.spec.ts.
 *
 * The decisive assertion is on the decoder itself (zlib.createBrotliDecompress),
 * not on the status code: a guard registered too late still answers 415, but
 * only after the decoder has run.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  Body,
  Controller,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import zlib from 'zlib';

import { rejectBrotliRequestBody } from './reject-brotli-request-body.middleware';

jest.setTimeout(30_000);

// Node's zlib exports are read-only, so jest.spyOn cannot wrap the decoder, and
// Jest 29 does not apply jest.mock('zlib') to body-parser's require('node:zlib').
// So redefine the property on the shared module object: it still calls the real
// decoder, but this spec can see whether the decoder was started.
const realBrotliDecoder = zlib.createBrotliDecompress;
const brotliDecoder = jest.fn(realBrotliDecoder);

function installBrotliDecoder(decoder: typeof realBrotliDecoder): void {
  Object.defineProperty(zlib, 'createBrotliDecompress', {
    value: decoder,
    configurable: true,
    enumerable: true,
    writable: false,
  });
}

beforeAll(() => installBrotliDecoder(brotliDecoder));
afterAll(() => installBrotliDecoder(realBrotliDecoder));

const handled = jest.fn();
const PAYLOAD = { ping: 'pong' };
const json = Buffer.from(JSON.stringify(PAYLOAD));

@Controller()
class EchoController {
  @Post('echo')
  echo(@Body() body: unknown): { got: unknown } {
    handled(body);
    return { got: body };
  }
}

@Module({ controllers: [EchoController] })
class PlainModule {}

// Declares the guard the way a module would. That is too late (see the
// characterization test below); main.ts must not do it this way.
@Module({ controllers: [EchoController] })
class ModuleMiddlewareModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(rejectBrotliRequestBody).forRoutes('/{*splat}');
  }
}

async function createApp(
  module: new () => object,
  guardedLikeMainTs: boolean
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [module],
  }).compile();
  const app = moduleRef.createNestApplication();
  // Exactly how main.ts registers it: Express level, before init()/listen().
  if (guardedLikeMainTs) app.use(rejectBrotliRequestBody);
  await app.init();
  return app;
}

function post(
  app: INestApplication,
  contentEncoding: string | undefined,
  body: Buffer
) {
  const req = request(app.getHttpServer())
    .post('/echo')
    .set('Content-Type', 'application/json')
    // Send the bytes as they are; superagent would JSON-serialize a Buffer.
    .serialize((raw) => raw as unknown as string);
  if (contentEncoding !== undefined) {
    req.set('Content-Encoding', contentEncoding);
  }
  return req.send(body);
}

describe('rejectBrotliRequestBody', () => {
  beforeEach(() => {
    brotliDecoder.mockClear();
    handled.mockClear();
  });

  describe('header matching', () => {
    function runGuard(contentEncoding: string | undefined) {
      const req = {
        headers:
          contentEncoding === undefined
            ? {}
            : { 'content-encoding': contentEncoding },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();
      rejectBrotliRequestBody(
        req,
        res as unknown as Response,
        next as NextFunction
      );
      return { res, next };
    }

    it.each([
      'br',
      'BR',
      'Br',
      ' br ',
      'gzip, br',
      'br, gzip',
      'gzip,deflate,BR',
    ])('refuses Content-Encoding %j with 415', (value) => {
      const { res, next } = runGuard(value);

      expect(res.status).toHaveBeenCalledWith(415);
      expect(next).not.toHaveBeenCalled();
    });

    it.each([
      undefined,
      '',
      'identity',
      'gzip',
      'GZIP',
      'deflate',
      'gzip, deflate',
      'brotli',
      'x-br',
      'bro',
    ])('lets Content-Encoding %j through', (value) => {
      const { res, next } = runGuard(value);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('registered with app.use() before init, as main.ts does', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp(PlainModule, true);
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers a Brotli body with 415 and never starts the Brotli decoder', async () => {
      const res = await post(app, 'br', zlib.brotliCompressSync(json));

      expect(res.status).toBe(415);
      expect(res.body).toEqual({
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: expect.stringContaining('Content-Encoding'),
      });
      expect(res.headers['accept-encoding']).toBe('gzip, deflate, identity');
      expect(brotliDecoder).not.toHaveBeenCalled();
      expect(handled).not.toHaveBeenCalled();
    });

    it('refuses a body that only claims to be Brotli, without decoding it', async () => {
      const res = await post(app, 'br', Buffer.from('not brotli at all'));

      expect(res.status).toBe(415);
      expect(brotliDecoder).not.toHaveBeenCalled();
    });

    it('refuses Brotli when it is one of several codings', async () => {
      const res = await post(app, 'gzip, br', zlib.brotliCompressSync(json));

      expect(res.status).toBe(415);
      expect(brotliDecoder).not.toHaveBeenCalled();
    });

    it('still accepts an uncompressed JSON body', async () => {
      const res = await post(app, undefined, json);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ got: PAYLOAD });
      expect(handled).toHaveBeenCalledTimes(1);
    });

    it('still accepts a gzip JSON body', async () => {
      const res = await post(app, 'gzip', zlib.gzipSync(json));

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ got: PAYLOAD });
      expect(brotliDecoder).not.toHaveBeenCalled();
    });
  });

  describe('control: the same app without the guard', () => {
    // If body-parser ever stops decoding Brotli on its own, this control fails.
    // The guard is then defense in depth only: update the control, keep the guard.
    it('hands a Brotli body to the Brotli decoder and on to the route', async () => {
      const app = await createApp(PlainModule, false);
      try {
        const res = await post(app, 'br', zlib.brotliCompressSync(json));

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ got: PAYLOAD });
        expect(brotliDecoder).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });
  });

  describe('characterization: declared in a module, the guard is too late', () => {
    it('answers 415 only after the Brotli decoder has already run', async () => {
      const app = await createApp(ModuleMiddlewareModule, false);
      try {
        const res = await post(app, 'br', zlib.brotliCompressSync(json));

        expect(res.status).toBe(415);
        expect(brotliDecoder).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });
  });

  describe('main.ts wiring', () => {
    // main.ts bootstraps the whole app on import, so its wiring is pinned by
    // reading the source (same approach as railway-gateway/test/main-wiring.spec.ts).
    const source = readFileSync(join(__dirname, '..', '..', 'main.ts'), 'utf8');

    it('imports the guard from this folder', () => {
      expect(source).toMatch(
        /import\s*\{\s*rejectBrotliRequestBody\s*\}\s*from\s*'\.\/common\/middleware\/reject-brotli-request-body\.middleware';/
      );
    });

    it('registers it with app.use() before app.listen()', () => {
      const use = source.indexOf('app.use(rejectBrotliRequestBody)');
      const listen = source.indexOf('await app.listen(');

      expect(use).toBeGreaterThan(-1);
      expect(listen).toBeGreaterThan(-1);
      expect(use).toBeLessThan(listen);
    });
  });
});

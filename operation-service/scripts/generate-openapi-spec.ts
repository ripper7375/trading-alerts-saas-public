/**
 * OpenAPI spec emission (Session 7-1, Step 2).
 *
 * Boots the real AppModule DI graph and asks @nestjs/swagger to introspect it
 * -- paths/methods/params come from live @Controller()/@Get()/@Post()/@Param()
 * decorator metadata, so they cannot drift from the code the way a
 * hand-authored spec can.
 *
 * Request/response BODY schemas are intentionally generic (`type: object`):
 * every route here validates via a canonical Zod schema through
 * ZodValidationPipe (see src/common/pipes/zod-validation.pipe.ts), not
 * class-validator DTOs -- the exported handler types are bare `type` aliases
 * inferred from those Zod schemas (`z.infer<>`), which erase at compile time
 * and carry no decorator metadata @nestjs/swagger can read. Fabricating a
 * schema here would misrepresent what's actually knowable from the live
 * code; see docs/open-api-documents/OPENAPI-DRIFT-REPORT-pre-phase-7.md and
 * this session's own Deviations for the follow-up options (Zod-to-OpenAPI
 * conversion, or targeted @ApiBody() annotation) left for a future session.
 *
 * Never imported by application code -- run only via `npm run openapi:generate`.
 */
import 'reflect-metadata';

import * as fs from 'fs';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('operation-service')
    .setDescription(
      'Auto-emitted from live NestJS controllers (Session 7-1) -- ' +
        'paths/methods/params are authoritative and cannot drift from the ' +
        'code. Request/response bodies are generic: this service validates ' +
        'via Zod, not class-validator DTOs (see file header for detail). No ' +
        'global route prefix (unlike money-service).'
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = path.resolve(
    __dirname,
    '../../docs/open-api-documents/generated'
  );
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'operation-service-openapi.json');
  fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

  const pathCount = Object.keys(document.paths ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(`[openapi:generate] wrote ${outPath} (${pathCount} paths)`);

  // Deliberately no app.close() -- this is a one-shot script, not a long-
  // running server, so there's nothing to gracefully drain. process.exit()
  // below tears the process down regardless of open handles (Redis/Prisma/
  // BullMQ connections the DI graph opened during create()).
}

generate()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[openapi:generate] failed:', error);
    process.exit(1);
  });

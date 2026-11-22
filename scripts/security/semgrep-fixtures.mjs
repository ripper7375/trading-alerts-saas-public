// The test cases of security/semgrep-rules.yml: what each rule must report and what it must leave alone.
//
// They are strings in a module, not files in the repository, on purpose: a `.ts` file that holds raw
// SQL built from a variable would be type-checked by the root tsconfig, scanned by CodeQL (which would
// raise an alert for code that is wrong by design) and read by Semgrep itself. A command writes them
// to a folder outside the repository (`write-semgrep-fixtures.mjs --out <dir>`) and the CI job runs
// Semgrep over that folder; scripts/security/semgrep-rules.test.mjs runs the same cases through the
// Node evaluator of the rules.
//
// Each fixture has the path it would have in the repository, because most rules are scoped by path.
// A marker `expect: <rule-id>` in a comment says a finding must start on that line or on the next one;
// for a rule that reads a whole file the marker is on the first line (a finding of such a rule is at
// the start of the file). A fixture with no marker must produce no finding at all.
// Avoid the word "expect" followed by a colon in prose here: it is the marker.

const SQL = 'davintrade-prisma-raw-unsafe-dynamic-sql';
const WEBHOOK = 'davintrade-webhook-handler-without-signature-check';
const GUARD = 'davintrade-internal-controller-without-guard';
const ROUTE = 'davintrade-internal-route-without-secret';

export const SEMGREP_RULE_IDS = Object.freeze([SQL, WEBHOOK, GUARD, ROUTE]);

export const SEMGREP_FIXTURES = Object.freeze([
  // --- raw SQL ---------------------------------------------------------------------------------
  {
    path: 'lib/example/raw-sql.ts',
    note: 'a statement built at run time is reported; a constant statement is not',
    content: `declare const prisma: any;
declare const id: string;
declare const table: string;
declare const sql: string;
declare function buildStatement(value: string): string;

export async function dynamicStatements() {
  // expect: ${SQL}
  await prisma.$queryRawUnsafe(\`SELECT * FROM users WHERE id = \${id}\`);
  // expect: ${SQL}
  await prisma.$queryRawUnsafe<unknown[]>(\`SELECT * FROM \${table}\`);
  // expect: ${SQL}
  await prisma.$executeRawUnsafe('DELETE FROM users WHERE id = ' + id);
  // expect: ${SQL}
  await prisma.$queryRawUnsafe(sql, id);
  // expect: ${SQL}
  await prisma.$executeRawUnsafe(buildStatement(id));
  // expect: ${SQL}
  await prisma.$queryRawUnsafe<Row[]>(
    \`SELECT * FROM users WHERE id = \${id}\`,
    id
  );
}

const LEDGER_SQL = { reserve: 'SELECT 1' };
declare const REAP_SQL: string;

export async function constantStatements() {
  await prisma.$queryRawUnsafe('SELECT 1');
  await prisma.$queryRawUnsafe("SELECT 1");
  await prisma.$queryRawUnsafe(\`SELECT $1::int\`, id);
  await prisma.$queryRawUnsafe<unknown[]>(LEDGER_SQL.reserve, id);
  await prisma.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.reserve,
    id
  );
  await prisma.$executeRawUnsafe(REAP_SQL, id);
  await prisma.$queryRaw\`SELECT * FROM users WHERE id = \${id}\`;
}

interface Client {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}
`,
  },
  {
    path: 'lib/admin/analytics/regional.ts',
    note: 'the one reviewed exception of the raw SQL rule: its path is excluded, so no finding',
    content: `declare const prisma: any;
declare const resolvedCountryCase: string;

export async function reviewedStatement() {
  return prisma.$queryRawUnsafe(\`SELECT \${resolvedCountryCase} AS jurisdiction_iso FROM t\`);
}
`,
  },

  // --- webhooks --------------------------------------------------------------------------------
  {
    path: 'app/api/webhooks/missing-signature/route.ts',
    note: 'a Next.js webhook route that reads the body and never verifies it',
    content: `// expect: ${WEBHOOK}
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.text();
  await prisma.payment.update({ where: { id: payload }, data: { status: 'PAID' } });
  return NextResponse.json({ ok: true });
}
`,
  },
  {
    path: 'app/api/webhooks/verified/route.ts',
    note: 'a Next.js webhook route that verifies the signature before it acts',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/stripe';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const event = constructWebhookEvent(body, request.headers.get('stripe-signature') ?? '');
  await prisma.payment.update({ where: { id: event.id }, data: { status: 'PAID' } });
  return NextResponse.json({ ok: true });
}
`,
  },
  {
    path: 'app/api/webhooks/archived/route.ts',
    note: 'an archived route: answers 410 and never reads the body, so it is not a handler',
    content: `import { NextRequest, NextResponse } from 'next/server';

export function POST(_request: NextRequest): NextResponse {
  return NextResponse.json({ error: 'archived' }, { status: 410 });
}
`,
  },
  {
    path: 'money-service/src/example/missing-signature-webhook.controller.ts',
    note: 'a NestJS webhook controller that reads the request and never verifies it',
    content: `// expect: ${WEBHOOK}
import { Controller, Post, Req } from '@nestjs/common';

@Controller('webhooks/example')
export class MissingSignatureWebhookController {
  @Post()
  async handleWebhook(@Req() request: any) {
    const payload = request.rawBody;
    await this.prisma.payment.update({ where: { id: payload.id }, data: { status: 'PAID' } });
  }
}
`,
  },
  {
    path: 'money-service/src/example/verified-webhook.controller.ts',
    note: 'a NestJS webhook controller that verifies the signature first',
    content: `import { Controller, Post, Req } from '@nestjs/common';

@Controller('webhooks/example')
export class VerifiedWebhookController {
  @Post()
  async handleWebhook(@Req() request: any) {
    const verified = this.verifier.verifySignature(request.rawBody, request.headers['x-signature']);
    if (!verified) return { status: 'ignored' };
    await this.prisma.payment.update({ where: { id: request.rawBody.id }, data: { status: 'PAID' } });
  }
}
`,
  },
  {
    path: 'lib/example/other-webhook.controller.ts',
    note: 'outside the path scope of the webhook rule: the same code is not read by it',
    content: `import { Controller, Post, Req } from '@nestjs/common';

@Controller('webhooks/example')
export class OutOfScopeWebhookController {
  @Post()
  async handleWebhook(@Req() request: any) {
    return request.rawBody;
  }
}
`,
  },

  // --- internal and gateway controllers (NestJS) -----------------------------------------------
  {
    path: 'railway-gateway/src/gateway/open.controller.ts',
    note: 'a gateway controller with no guard',
    content: `// expect: ${GUARD}
import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/open')
export class OpenController {
  @Get()
  read() {
    return [];
  }
}
`,
  },
  {
    path: 'railway-gateway/src/gateway/guarded.controller.ts',
    note: 'a gateway controller guarded by the API key',
    content: `import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('api/v1/guarded')
export class GuardedController {
  @Get()
  read() {
    return [];
  }
}
`,
  },
  {
    path: 'railway-gateway/src/health/health.controller.ts',
    note: 'the public health controller of the gateway is excluded from the rule',
    content: `import { Controller, Get } from '@nestjs/common';

@Controller('api/v1')
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
`,
  },
  {
    path: 'operation-service/src/outbox/open-consumer.controller.ts',
    note: 'an internal outbox consumer with no guard',
    content: `// expect: ${GUARD}
import { Controller, Post } from '@nestjs/common';

@Controller('outbox')
export class OpenConsumerController {
  @Post('events')
  consume() {
    return { status: 'ok' };
  }
}
`,
  },
  {
    path: 'operation-service/src/outbox/service-consumer.controller.ts',
    note: 'an internal outbox consumer guarded by SVC_TOKEN',
    content: `import { Controller, Post, UseGuards } from '@nestjs/common';
import { SvcTokenGuard } from './svc-token.guard';

@Controller('outbox')
export class ServiceConsumerController {
  @UseGuards(SvcTokenGuard)
  @Post('events')
  consume() {
    return { status: 'ok' };
  }
}
`,
  },
  {
    path: 'money-service/src/crons/open-trigger.controller.ts',
    note: 'a cron trigger with no guard',
    content: `// expect: ${GUARD}
import { Controller, Post } from '@nestjs/common';

@Controller('cron-trigger')
export class OpenTriggerController {
  @Post('run')
  run() {
    return { status: 'ok' };
  }
}
`,
  },

  // --- internal and cron routes (Next.js) ------------------------------------------------------
  {
    path: 'app/api/cron/open/route.ts',
    note: 'a cron route that checks nobody',
    content: `// expect: ${ROUTE}
export async function GET() {
  return Response.json({ ok: true });
}
`,
  },
  {
    path: 'app/api/cron/secret/route.ts',
    note: 'a cron route that checks the shared secret',
    content: `export async function GET(request: Request) {
  const secret = process.env['CRON_SECRET']?.trim();
  if (!secret || request.headers.get('authorization') !== \`Bearer \${secret}\`) {
    return new Response('unauthorized', { status: 401 });
  }
  return Response.json({ ok: true });
}
`,
  },
  {
    path: 'app/api/internal/open/route.ts',
    note: 'an internal route that checks nobody',
    content: `// expect: ${ROUTE}
export const POST = async () => Response.json({ ok: true });
`,
  },
]);

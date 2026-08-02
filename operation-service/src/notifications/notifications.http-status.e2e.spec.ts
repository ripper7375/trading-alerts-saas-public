/**
 * Session 4B-9 — proves the REAL HTTP status codes NestJS assigns to each
 * NotificationsController route against a real Nest app + real HTTP
 * pipeline, not just a unit test constructing the controller directly.
 *
 * Found live in production (Railway HTTP access logs, not just the response
 * body): `@Post()` defaults to 201 in NestJS, but the ported SOURCE routes
 * (mark-all-read, mark-one-read) both return 200 via bare
 * `NextResponse.json(...)` with no explicit status — a mismatch invisible
 * to `new NotificationsController(mockService)`-style unit tests, since
 * `@HttpCode()` resolution only happens through Nest's real HTTP layer.
 * Fixed with explicit `@HttpCode(200)` on both POST handlers.
 *
 * @module notifications/notifications.http-status.e2e.spec
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController (real HTTP status codes)', () => {
  let app: INestApplication;
  const mockService: Partial<NotificationsService> = {
    list: jest.fn().mockResolvedValue({ notifications: [] }),
    markAllRead: jest
      .fn()
      .mockResolvedValue({ success: true, updatedCount: 0, message: '' }),
    getById: jest.fn().mockResolvedValue({ id: 'n-1' }),
    remove: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Notification deleted' }),
    markRead: jest
      .fn()
      .mockResolvedValue({ success: true, notification: {}, message: '' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => AuthenticatedRequest };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: 'user-1',
            email: 'a@b.com',
            tier: 'PRO',
            role: 'USER',
            isAffiliate: false,
          };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /notifications -> 200', async () => {
    const res = await request(app.getHttpServer()).get('/notifications');
    expect(res.status).toBe(200);
  });

  it("POST /notifications (mark all read) -> 200, NOT Nest's default 201", async () => {
    const res = await request(app.getHttpServer()).post('/notifications');
    expect(res.status).toBe(200);
  });

  it('GET /notifications/:id -> 200', async () => {
    const res = await request(app.getHttpServer()).get('/notifications/n-1');
    expect(res.status).toBe(200);
  });

  it('DELETE /notifications/:id -> 200', async () => {
    const res = await request(app.getHttpServer()).delete('/notifications/n-1');
    expect(res.status).toBe(200);
  });

  it("POST /notifications/:id/read -> 200, NOT Nest's default 201", async () => {
    const res = await request(app.getHttpServer()).post(
      '/notifications/n-1/read'
    );
    expect(res.status).toBe(200);
  });
});

import 'reflect-metadata';

import { AppModule } from '../app.module';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware';

import { EmailLocaleContextMiddleware } from './email-locale.context';
import { EmailLocaleService } from './email-locale.service';
import { EmailModule } from './email.module';

/**
 * Nothing calls `EmailLocaleService` by name: it registers itself with the
 * senders when its module starts, and the request hint is read from a
 * middleware. If either is dropped from AppModule, every e-mail silently goes
 * back to English, so the wiring is pinned here.
 */
describe('e-mail locale wiring', () => {
  it('imports EmailModule into AppModule', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', AppModule);
    expect(imports).toContain(EmailModule);
  });

  it('provides the resolver from EmailModule', () => {
    const providers: unknown[] = Reflect.getMetadata('providers', EmailModule);
    expect(providers).toContain(EmailLocaleService);
  });

  it('puts the request hint middleware on every route, next to the correlation id', () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    new AppModule().configure({ apply } as never);

    expect(apply).toHaveBeenCalledWith(
      CorrelationIdMiddleware,
      EmailLocaleContextMiddleware
    );
    expect(forRoutes).toHaveBeenCalledWith('/{*splat}');
  });
});

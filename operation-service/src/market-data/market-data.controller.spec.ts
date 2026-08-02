import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketDataController } from './market-data.controller';
import type { MarketDataService } from './market-data.service';

function mockRequest(tier: 'FREE' | 'PRO' = 'FREE') {
  return { user: { id: 'user-1', tier } } as never;
}

describe('MarketDataController', () => {
  function makeController(service: Partial<MarketDataService>) {
    return new MarketDataController(service as MarketDataService);
  }

  it('delegates getChannel() to MarketDataService.getChannelData with tier, symbol, timeframe, variant, limit', async () => {
    const getChannelData = jest.fn().mockResolvedValue({ success: true });
    const controller = makeController({ getChannelData });

    await controller.getChannel(mockRequest('PRO'), {
      symbol: 'XAUUSD',
      timeframe: 'M15',
      variant: 'cherry_a',
      limit: 500,
    });

    expect(getChannelData).toHaveBeenCalledWith(
      'PRO',
      'XAUUSD',
      'M15',
      'cherry_a',
      500
    );
  });

  it('is guarded by JwtAuthGuard', () => {
    const guards: unknown[] = Reflect.getMetadata(
      '__guards__',
      MarketDataController.prototype.getChannel
    );
    expect(guards).toBeDefined();
    expect(guards[0]).toBe(JwtAuthGuard);
  });

  it('is decorated with @HttpCode(200) (L43)', () => {
    const httpCode: number = Reflect.getMetadata(
      '__httpCode__',
      MarketDataController.prototype.getChannel
    );
    expect(httpCode).toBe(200);
  });
});

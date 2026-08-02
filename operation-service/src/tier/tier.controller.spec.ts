import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TierController } from './tier.controller';
import type { TierService } from './tier.service';

function mockRequest(tier: 'FREE' | 'PRO' = 'FREE') {
  return { user: { id: 'user-1', tier } } as never;
}

describe('TierController', () => {
  function makeController(service: Partial<TierService>) {
    return new TierController(service as TierService);
  }

  it('delegates getSymbols() to TierService.getSymbols with the caller tier', () => {
    const getSymbols = jest.fn().mockReturnValue({ success: true });
    const controller = makeController({ getSymbols });

    controller.getSymbols(mockRequest('PRO'));

    expect(getSymbols).toHaveBeenCalledWith('PRO');
  });

  it('delegates checkSymbolAccess() to TierService.checkSymbolAccess with tier then symbol', () => {
    const checkSymbolAccess = jest.fn().mockReturnValue({ success: true });
    const controller = makeController({ checkSymbolAccess });

    controller.checkSymbolAccess(mockRequest('FREE'), 'XAUUSD');

    expect(checkSymbolAccess).toHaveBeenCalledWith('FREE', 'XAUUSD');
  });

  it('delegates getCombinations() to TierService.getCombinations with the caller tier', () => {
    const getCombinations = jest.fn().mockReturnValue({ success: true });
    const controller = makeController({ getCombinations });

    controller.getCombinations(mockRequest('PRO'));

    expect(getCombinations).toHaveBeenCalledWith('PRO');
  });

  it('every route is guarded by JwtAuthGuard', () => {
    for (const method of [
      'getSymbols',
      'checkSymbolAccess',
      'getCombinations',
    ] as const) {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        TierController.prototype[method]
      );
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    }
  });
});

/**
 * Generated service API clients (Session 7-1). Re-exported from
 * lib/api/index.ts as `operationApi`/`moneyApi`.
 *
 * Server-only -- see each client.ts's own header.
 */
export {
  createOperationApi,
  unwrapOperationApi,
  type OperationApiClient,
} from './operation-api/client';
export type { paths as OperationApiPaths } from './operation-api/schema';

export {
  createMoneyApi,
  unwrapMoneyApi,
  type MoneyApiClient,
} from './money-api/client';
export type { paths as MoneyApiPaths } from './money-api/schema';

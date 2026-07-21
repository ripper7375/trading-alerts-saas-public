// F15 (DECISION-LOG.md): money-service shares operation-service's existing
// Redis instance rather than getting a dedicated one. These constants are
// the single source of truth for the 'money.*' namespace so every future
// queue/cache key this service adds (starting with the domain modules in
// 4A-4 onward) stays under it without re-deciding the prefix each time.
export const MONEY_KEY_PREFIX = 'money:';
export const MONEY_QUEUE_PREFIX = 'money';

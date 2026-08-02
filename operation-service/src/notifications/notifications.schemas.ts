import { z } from 'zod';

/**
 * Notifications query-param Zod schema — mirrors `app/api/notifications/
 * route.ts`'s `querySchema` exactly, verbatim (status/type filters,
 * pagination bounds). Session 4B-9.
 *
 * None of the 3 ported routes validate a request BODY (list/read/mark-all-
 * read/delete all take no body) — this is the only schema this domain needs.
 *
 * @module notifications/notifications.schemas
 */
export const NOTIFICATION_STATUS_FILTERS = ['all', 'unread', 'read'] as const;
export const NOTIFICATION_TYPES = [
  'ALERT',
  'SUBSCRIPTION',
  'PAYMENT',
  'SYSTEM',
] as const;

export const notificationQuerySchema = z.object({
  status: z.enum(NOTIFICATION_STATUS_FILTERS).default('all'),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(50).default(20),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;

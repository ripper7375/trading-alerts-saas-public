import { notificationQuerySchema } from './notifications.schemas';

/**
 * Remediation Tier 1 §5.7 listed the notifications list endpoint. Its paging
 * is already validated by this schema (the controller applies it as a
 * ZodValidationPipe), so `take`/`skip` can never be NaN or negative there;
 * these tests pin that so a loosening of the schema is noticed.
 */
describe('notificationQuerySchema paging', () => {
  it('defaults page to 1 and pageSize to 20', () => {
    const parsed = notificationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it('coerces numeric strings', () => {
    const parsed = notificationQuerySchema.parse({ page: '3', pageSize: '25' });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(25);
  });

  it.each([
    ['page', 'abc'],
    ['page', 'NaN'],
    ['page', '0'],
    ['page', '-2'],
    ['pageSize', 'abc'],
    ['pageSize', '-5'],
    ['pageSize', '9'],
    ['pageSize', '51'],
  ])('rejects %s=%s', (key, value) => {
    expect(notificationQuerySchema.safeParse({ [key]: value }).success).toBe(
      false
    );
  });
});

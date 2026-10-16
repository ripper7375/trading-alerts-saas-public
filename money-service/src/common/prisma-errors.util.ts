/**
 * True for Prisma's unique-constraint violation (P2002).
 *
 * Duck-typed on `code` rather than `instanceof PrismaClientKnownRequestError`:
 * the error crosses the driver-adapter and `$transaction` boundaries, and an
 * `instanceof` check breaks when two copies of the client are loaded (Jest
 * module registries, a generated client next to `@prisma/client`).
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

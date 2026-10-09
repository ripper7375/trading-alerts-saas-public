/**
 * Whether a failed database read says the table it asked for is not there: Prisma's P2021, PostgreSQL's 42P01, or a message that
 * says a relation or table "does not exist". The read-only tools of build step 4 part 6 (the replay and the measurement kit) read
 * `synthesis_readings` and `entry_zones`, which exist only after Davin applies the migration `20261004000000_add_synthesis_tables`;
 * against a database that does not have them yet, "the table is not there" is an answer (no SYN rows), and every other failure is not.
 */
export function tableIsMissing(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const e = error as { code?: unknown; message?: unknown; meta?: unknown };
  if (e.code === 'P2021' || e.code === '42P01') return true;
  const meta = e.meta;
  if (typeof meta === 'object' && meta !== null) {
    const cause = (meta as { driverAdapterError?: { cause?: unknown } })
      .driverAdapterError?.cause;
    if (
      typeof cause === 'object' &&
      cause !== null &&
      (cause as { kind?: unknown }).kind === 'TableDoesNotExist'
    ) {
      return true;
    }
  }
  return (
    typeof e.message === 'string' &&
    /(relation|table) .*does not exist|does not exist in the current database/i.test(
      e.message
    )
  );
}

import type { PrismaService } from '../../src/prisma/prisma.service';
import type { SeedPlan } from './inputs-world';

type Row = Record<string, unknown>;

/** Rows in chunks: one INSERT of a thousand bars would pass the 65,535 bind parameters Postgres allows. */
function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** A nullable JSON column is left out when it is null: Prisma wants DbNull for a null there, and the table default is NULL. */
const withoutNulls = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

/**
 * Lay a seed plan (`buildSeedPlan`, the world a stored cycle becomes as rows) out in a REAL
 * database: the market tables are emptied and refilled. The sensor tables (`mcd_outputs`,
 * `market_cycle_inputs`) are not touched: a spec wipes them itself.
 */
export async function seedPlanInto(
  prisma: PrismaService,
  plan: SeedPlan
): Promise<void> {
  // children before parents: indicator_statistics holds a foreign key to indicator_configs
  for (const table of [
    'indicator_statistics',
    'indicator_configs',
    'market_data_v6',
    'market_cycles',
    'active_indicator_settings',
  ]) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  }
  await prisma.indicatorConfig.createMany({
    data: plan.configHashes.map((config_hash) => ({
      config_hash,
      source: 'seed',
      params: {},
      first_seen: 1,
    })),
  });
  await prisma.marketCycle.createMany({
    data: plan.cycles.map(withoutNulls) as never,
  });
  for (const part of chunks(plan.bars, 150)) {
    await prisma.marketDataV6.createMany({ data: part as never });
  }
  for (const part of chunks(plan.statistics, 20)) {
    await prisma.indicatorStatistic.createMany({ data: part as never });
  }
  await prisma.activeIndicatorSetting.createMany({
    data: plan.settings as never,
  });
}

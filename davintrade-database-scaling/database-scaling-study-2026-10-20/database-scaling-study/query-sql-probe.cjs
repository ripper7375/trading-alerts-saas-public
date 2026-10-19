// Read-only compiler probe: the fake driver has no network or PostgreSQL client.
// Prisma's installed query compiler produces SQL; queryRaw returns no rows.
const fs = require('node:fs');
const path = require('node:path');
const repo = 'D:/SaaS Project/trading-alerts-saas-public';
const clientRelativePath =
  process.argv[2] || 'node_modules/.prisma/market-client';
const label = process.argv[3] || 'market';
const { PrismaClient, Prisma } = require(path.join(repo, clientRelativePath));
const records = [];
let current = '';
const queryable = {
  provider: 'postgres',
  adapterName: 'sql-compiler-audit-no-network',
  async queryRaw(query) {
    records.push({
      case: current,
      method: 'queryRaw',
      sql: query.sql,
      args: query.args,
    });
    return { columnNames: [], columnTypes: [], rows: [] };
  },
  async executeRaw(query) {
    records.push({
      case: current,
      method: 'executeRaw',
      sql: query.sql,
      args: query.args,
    });
    return 0;
  },
};
const adapter = {
  ...queryable,
  async executeScript() {
    throw new Error('Scripts refused');
  },
  async startTransaction() {
    return {
      ...queryable,
      options: { usePhantomQuery: false },
      async commit() {},
      async rollback() {},
    };
  },
  getConnectionInfo() {
    return { schemaName: 'public', supportsRelationJoins: false };
  },
  async dispose() {},
};
const client = new PrismaClient({
  adapter: {
    provider: 'postgres',
    adapterName: adapter.adapterName,
    async connect() {
      return adapter;
    },
  },
});
async function probe(name, fn) {
  current = name;
  try {
    await fn();
  } catch (e) {
    records.push({
      case: name,
      expectedEmptyResultError: e.message.slice(0, 300),
    });
  }
}
async function main() {
  await probe('currency-latest-distinct-ordered', () =>
    client.currencyGoldIndex.findMany({
      orderBy: [{ index_name: 'asc' }, { bar_time: 'desc' }],
      distinct: ['index_name'],
      select: {
        index_name: true,
        bar_time: true,
        value: true,
        change_pct: true,
        session_open_bar_time: true,
      },
    })
  );
  await probe('pro-session-latest-distinct-ordered', () =>
    client.currencyGoldIndex.findMany({
      where: { index_name: { in: ['USDX', 'EURX'] } },
      orderBy: [{ index_name: 'asc' }, { bar_time: 'desc' }],
      distinct: ['index_name'],
      select: { index_name: true, session_open_bar_time: true },
    })
  );
  await probe('indicator-latest-distinct-ordered', () =>
    client.indicatorStatistic.findMany({
      orderBy: [
        { symbol: 'asc' },
        { timeframe: 'asc' },
        { source: 'asc' },
        { captured_at: 'desc' },
      ],
      distinct: ['symbol', 'timeframe', 'source'],
      select: {
        symbol: true,
        timeframe: true,
        source: true,
        captured_at: true,
        containment_rate: true,
        containment_count: true,
        containment_n: true,
      },
    })
  );
  await probe('channel-current', () =>
    client.marketDataV6.findMany({
      where: { symbol: 'XAUUSD', timeframe: 'M5' },
      orderBy: { timestamp: 'desc' },
      take: 300,
    })
  );
  await probe('channel-projected', () =>
    client.marketDataV6.findMany({
      where: { symbol: 'XAUUSD', timeframe: 'M5' },
      orderBy: { timestamp: 'desc' },
      take: 300,
      select: {
        timestamp: true,
        best_fit_a_uoedt: true,
        best_fit_a_base_fl: true,
        best_fit_a_loedt: true,
      },
    })
  );
  const data = {
    terminal_id: 'AUDIT',
    timestamp: 1700000000,
    symbol: 'XAUUSD',
    timeframe: 'M5',
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 0,
    cycle_id: 1,
    collected_at: 1700000000,
  };
  const where = {
    symbol_timeframe_timestamp: {
      symbol: data.symbol,
      timeframe: data.timeframe,
      timestamp: data.timestamp,
    },
  };
  await probe('gateway-upsert-current', () =>
    client.marketDataV6.upsert({ where, create: data, update: data })
  );
  await probe('gateway-upsert-projected', () =>
    client.marketDataV6.upsert({
      where,
      create: data,
      update: data,
      select: { id: true },
    })
  );
  const fields = Prisma.dmmf.datamodel.models
    .find((m) => m.name === 'MarketDataV6')
    .fields.filter((f) => f.kind !== 'object');
  const report = {
    clientRelativePath,
    prismaVersion: Prisma.prismaVersion,
    marketDataScalarFieldCount: fields.length,
    records,
  };
  fs.writeFileSync(
    path.join(__dirname, `query-sql-probe-${label}.json`),
    JSON.stringify(report, null, 2)
  );
  for (const record of records) {
    if (!record.sql) {
      console.log(JSON.stringify(record));
      continue;
    }
    const from = record.sql.indexOf(' FROM ');
    const projection =
      record.sql.startsWith('SELECT ') && from >= 0
        ? record.sql.slice(7, from)
        : undefined;
    const returning = record.sql.includes(' RETURNING ')
      ? record.sql.split(' RETURNING ')[1]
      : undefined;
    console.log(
      JSON.stringify({
        case: record.case,
        method: record.method,
        hasDistinct: /\bDISTINCT\b/i.test(record.sql),
        hasLimit: /\bLIMIT\b/i.test(record.sql),
        projectionColumns: projection
          ? projection.split(',').length
          : undefined,
        returningColumns: returning ? returning.split(',').length : undefined,
        sql:
          record.sql.length > 1700
            ? record.sql.slice(0, 180) + ' ... ' + record.sql.slice(-350)
            : record.sql,
      })
    );
  }
  console.log(JSON.stringify({ marketDataScalarFieldCount: fields.length }));
  await client.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

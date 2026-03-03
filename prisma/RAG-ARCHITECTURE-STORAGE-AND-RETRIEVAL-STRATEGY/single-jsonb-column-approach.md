The Single JSONB Column approach means 1 comment column total for ALL indicators — not 1 comment column per indicator.

Your Understanding (Incorrect)
20 columns + 12 comment columns = 32 columns
This would be multiple JSONB columns — one per indicator.

Correct Understanding
20 columns + 1 comment column = 21 columns
That 1 single comments column holds ALL indicators' comments inside it as nested JSON:
json{
"tema": { "comment_1": "...", "comment_2": "..." },
"hrma": { "comment_1": "...", "comment_2": "..." },
"smma": { "comment_1": "...", "comment_2": "..." },
"momentum": { "comment_1": "..." },
"atr": { "comment_1": "...", "comment_2": "..." },
"reversal": { "comment_1": "..." }
}

In Prisma Schema
prismamodel OhlcvFiveMin {
id Int @id @default(autoincrement())
symbol String
timeframe String
timestamp DateTime

// OHLCV (5 columns)
open Float
high Float
low Float
close Float
volume BigInt

// 12 indicators (12 columns)
temaValue Float?
hrmaValue Float?
smmaValue Float?
atrValue Float?
atrPercentile Int?
adxValue Float?
rsiValue Float?
trendDirection String?
volatilityRegime String?
swingMomentum String?
supportLevels Json?
resistanceLevels Json?

// ALL comments in 1 single JSONB column (1 column)
comments Json @default("{}")

@@unique([symbol, timeframe, timestamp])
@@index([symbol, timeframe, timestamp(sort: Desc)])
@@map("ohlcv_5m")
}
Total: 3 + 5 + 12 + 1 = 21 columns. The comments column expands infinitely inside without ever touching the schema.

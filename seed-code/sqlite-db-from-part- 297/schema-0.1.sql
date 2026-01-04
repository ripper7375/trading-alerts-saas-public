-- symbol definition

CREATE TABLE symbol(
    symbol_id INTEGER PRIMARY KEY,
    ticker TEXT CHECK(LENGTH(ticker) <= 10) NOT NULL,
    exchange TEXT CHECK(LENGTH(exchange) <= 50) NOT NULL,
    asset_type TEXT CHECK(LENGTH(asset_type) <= 50),
    sector TEXT CHECK(LENGTH(sector) <= 50),
    industry TEXT CHECK(LENGTH(industry) <= 50),
    currency TEXT CHECK(LENGTH(currency) <= 10)
) STRICT;


-- corporate_event definition

CREATE TABLE "corporate_event"(
    tstamp INTEGER PRIMARY KEY,
    event_type TEXT CHECK(event_type IN ('dividend', 'split', 'earnings')) NOT NULL,
    event_value REAL,
    details TEXT CHECK(LENGTH(details) <= 255),
    symbol_id INTEGER NOT NULL,
    FOREIGN KEY(symbol_id) REFERENCES symbol(symbol_id)
) STRICT;


-- market_data definition

CREATE TABLE "market_data" (
    tstamp INTEGER,
    timeframe TEXT CHECK (
        timeframe IN (
            'M1',
            'M2',
            'M3',
            'M4',
            'M5',
            'M6',
            'M10',
            'M12',
            'M15',
            'M20',
            'M30',
            'H1',
            'H2',
            'H3',
            'H4',
            'H6',
            'H8',
            'H12',
            'D1',
            'W1',
            'MN1'
        )
    ) NOT NULL,
    price_open REAL NOT NULL,
    price_high REAL NOT NULL,
    price_low REAL NOT NULL,
    price_close REAL NOT NULL,
    tick_volume INTEGER,
    real_volume INTEGER,
    spread REAL,
    symbol_id INTEGER NOT NULL,
    CONSTRAINT temp_market_data_pk PRIMARY KEY (tstamp, timeframe, symbol_id),
    CONSTRAINT temp_market_data_symbol_fk FOREIGN KEY (symbol_id) REFERENCES symbol(symbol_id) ON DELETE CASCADE ON UPDATE CASCADE
) STRICT;


-- trade definition

CREATE TABLE trade(
    tstamp INTEGER PRIMARY KEY,
    ticket INTEGER NOT NULL,
    side TEXT CHECK(side IN ('buy', 'sell')) NOT NULL,
    quantity INTEGER CHECK(quantity > 0) NOT NULL,
    price REAL CHECK(price >= 0) NOT NULL,
    strategy TEXT CHECK(LENGTH(strategy) <= 50),
    symbol_id INTEGER NOT NULL,
    FOREIGN KEY(symbol_id) REFERENCES symbol(symbol_id)
) STRICT;
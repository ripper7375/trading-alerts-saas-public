# V5_Part E: MQL5 Indicators Integration

## 8. MQL5 Indicators Integration

### 8.1 Understanding Your Indicator Structure

**⚠️ CRITICAL: You must attach these files in your next chat!**

Your indicators have specific buffer indices that the Flask service needs to read:

#### Fractal Horizontal Line_V5.mq5 Buffer Structure:

```mql5
// From your indicator file (YOU WILL ATTACH THIS)
SetIndexBuffer(0, ExtUpperBuffer, INDICATOR_DATA);      // Buffer 0: Peak fractals (108)
SetIndexBuffer(1, ExtLowerBuffer, INDICATOR_DATA);      // Buffer 1: Bottom fractals (108)
SetIndexBuffer(2, ExtUpperBuffer119, INDICATOR_DATA);   // Buffer 2: Peak fractals (119)
SetIndexBuffer(3, ExtLowerBuffer119, INDICATOR_DATA);   // Buffer 3: Bottom fractals (119)
SetIndexBuffer(4, ExtPeakLine1, INDICATOR_DATA);        // Buffer 4: Peak Line #1
SetIndexBuffer(5, ExtPeakLine2, INDICATOR_DATA);        // Buffer 5: Peak Line #2
SetIndexBuffer(6, ExtPeakLine3, INDICATOR_DATA);        // Buffer 6: Peak Line #3
SetIndexBuffer(7, ExtBottomLine1, INDICATOR_DATA);      // Buffer 7: Bottom Line #1
SetIndexBuffer(8, ExtBottomLine2, INDICATOR_DATA);      // Buffer 8: Bottom Line #2
SetIndexBuffer(9, ExtBottomLine3, INDICATOR_DATA);      // Buffer 9: Bottom Line #3
```

#### Fractal Diagonal Line_V4.mq5 Buffer Structure:

```mql5
// From your indicator file (YOU WILL ATTACH THIS)
SetIndexBuffer(0, DiagAscLine1, INDICATOR_DATA);        // Buffer 0: Ascending Line #1
SetIndexBuffer(1, DiagAscLine2, INDICATOR_DATA);        // Buffer 1: Ascending Line #2
SetIndexBuffer(2, DiagAscLine3, INDICATOR_DATA);        // Buffer 2: Ascending Line #3
SetIndexBuffer(3, DiagDescLine1, INDICATOR_DATA);       // Buffer 3: Descending Line #1
SetIndexBuffer(4, DiagDescLine2, INDICATOR_DATA);       // Buffer 4: Descending Line #2
SetIndexBuffer(5, DiagDescLine5, INDICATOR_DATA);       // Buffer 5: Descending Line #3
```

### 8.2 V5 Tier-Based Symbol Access Constants

Create `mt5-service/app/constants.py`:

```python
# V5: Commercial SaaS - Tier-based symbol access
TIER_SYMBOLS = {
    'FREE': ['XAUUSD'],
    'PRO': [
        'AUDUSD',
        'BTCUSD',
        'ETHUSD',
        'EURUSD',
        'GBPUSD',
        'NDX100',
        'US30',
        'USDJPY',
        'XAGUSD',
        'XAUUSD',
    ]
}

def get_accessible_symbols(tier: str) -> list:
    """Get list of symbols accessible by tier"""
    tier = tier.upper()
    return TIER_SYMBOLS.get(tier, [])

def can_access_symbol(tier: str, symbol: str) -> bool:
    """Check if tier can access symbol"""
    tier = tier.upper()
    if tier not in TIER_SYMBOLS:
        return False
    return symbol in TIER_SYMBOLS[tier]
```

### 8.3 Flask Service with Tier Validation

Create `mt5-service/app/services/mt5_service.py`:

```python
import MetaTrader5 as mt5
from loguru import logger
import os
from app.constants import can_access_symbol, TIER_SYMBOLS

class MT5Service:
    def __init__(self):
        self.login = int(os.getenv('MT5_LOGIN', 0))
        self.password = os.getenv('MT5_PASSWORD', '')
        self.server = os.getenv('MT5_SERVER', '')

        # YOUR indicator names (will be verified from YOUR .mq5 files)
        self.HORIZONTAL_INDICATOR = "Fractal Horizontal Line_V5"
        self.DIAGONAL_INDICATOR = "Fractal Diagonal Line_V4"

        self.initialize()

    def initialize(self):
        """Initialize MT5 connection"""
        if not mt5.initialize(
            login=self.login,
            password=self.password,
            server=self.server
        ):
            logger.error("MT5 initialization failed")
            return False
        logger.info("MT5 initialized successfully")
        return True

    def is_connected(self):
        """Check if MT5 is connected"""
        return mt5.terminal_info() is not None

    def validate_symbol_access(self, symbol: str, tier: str) -> bool:
        """
        V5: Validate if tier can access symbol

        Args:
            symbol: Trading symbol (e.g., 'XAUUSD')
            tier: User tier ('FREE' or 'PRO')

        Returns:
            bool: True if access allowed, False otherwise
        """
        return can_access_symbol(tier, symbol)

    def get_indicators(self, symbol, timeframe, bars, tier='FREE'):
        """
        Read indicator buffers from YOUR custom .mq5 files

        V5 CHANGES:
        - Added tier parameter for access control
        - Validates symbol access before reading
        - Updated timeframe mapping (removed M1/M5, added H2/H8)

        Args:
            symbol: Trading symbol (e.g., 'XAUUSD')
            timeframe: Timeframe string (M15, M30, H1, H2, H4, H8, D1)
            bars: Number of bars to fetch
            tier: User tier for access control ('FREE' or 'PRO')

        Raises:
            Exception: If tier cannot access symbol or data fetch fails
        """
        # V5: VALIDATE TIER ACCESS FIRST
        if not self.validate_symbol_access(symbol, tier):
            accessible = TIER_SYMBOLS.get(tier.upper(), [])
            raise Exception(
                f"Access denied: {tier} tier cannot access {symbol}. "
                f"Accessible symbols: {', '.join(accessible)}"
            )

        if not self.is_connected():
            self.initialize()

        # V5: Updated timeframe mapping (removed M1/M5, added H2/H8)
        tf_map = {
            'M15': mt5.TIMEFRAME_M15,
            'M30': mt5.TIMEFRAME_M30,
            'H1': mt5.TIMEFRAME_H1,
            'H2': mt5.TIMEFRAME_H2,    # V5: Added
            'H4': mt5.TIMEFRAME_H4,
            'H8': mt5.TIMEFRAME_H8,    # V5: Added
            'D1': mt5.TIMEFRAME_D1,
        }

        tf = tf_map.get(timeframe)
        if tf is None:
            raise Exception(
                f"Invalid timeframe: {timeframe}. "
                f"Valid options: {', '.join(tf_map.keys())}"
            )

        # Select symbol
        if not mt5.symbol_select(symbol, True):
            raise Exception(f"Failed to select symbol: {symbol}")

        # Get OHLC data
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, bars)

        if rates is None:
            raise Exception(f"Failed to get OHLC data for {symbol}")

        # Get indicator handles for YOUR custom indicators
        h_handle = mt5.iCustom(symbol, tf, self.HORIZONTAL_INDICATOR)
        d_handle = mt5.iCustom(symbol, tf, self.DIAGONAL_INDICATOR)

        if h_handle == mt5.INVALID_HANDLE:
            raise Exception(
                f"Failed to get handle for {self.HORIZONTAL_INDICATOR}. "
                f"Is the indicator attached to the chart in MT5?"
            )

        if d_handle == mt5.INVALID_HANDLE:
            raise Exception(
                f"Failed to get handle for {self.DIAGONAL_INDICATOR}. "
                f"Is the indicator attached to the chart in MT5?"
            )

        # Read buffers (indices match YOUR indicator structure)
        result = {
            'ohlc': [
                {
                    'time': int(bar['time']),
                    'open': float(bar['open']),
                    'high': float(bar['high']),
                    'low': float(bar['low']),
                    'close': float(bar['close']),
                    'volume': int(bar['tick_volume'])
                }
                for bar in rates
            ],
            'horizontal': {
                # Buffer indices from YOUR Fractal Horizontal Line_V5.mq5
                'peak_1': self._read_buffer(h_handle, 4, bars),
                'peak_2': self._read_buffer(h_handle, 5, bars),
                'peak_3': self._read_buffer(h_handle, 6, bars),
                'bottom_1': self._read_buffer(h_handle, 7, bars),
                'bottom_2': self._read_buffer(h_handle, 8, bars),
                'bottom_3': self._read_buffer(h_handle, 9, bars),
            },
            'diagonal': {
                # Buffer indices from YOUR Fractal Diagonal Line_V4.mq5
                'ascending_1': self._read_buffer(d_handle, 0, bars),
                'ascending_2': self._read_buffer(d_handle, 1, bars),
                'ascending_3': self._read_buffer(d_handle, 2, bars),
                'descending_1': self._read_buffer(d_handle, 3, bars),
                'descending_2': self._read_buffer(d_handle, 4, bars),
                'descending_3': self._read_buffer(d_handle, 5, bars),
            },
            'fractals': self._extract_fractals(h_handle, rates, bars),
            'metadata': {
                'symbol': symbol,
                'timeframe': timeframe,
                'tier': tier,  # V5: Include tier in response
                'bars_returned': len(rates)
            }
        }

        logger.info(
            f"Successfully read indicators for {symbol} {timeframe} "
            f"(tier: {tier}, bars: {len(rates)})"
        )
        return result

    def _read_buffer(self, handle, buffer_index, count):
        """Read indicator buffer and filter EMPTY_VALUE"""
        try:
            buffer = mt5.copy_buffer(handle, buffer_index, 0, count)

            if buffer is None:
                logger.warning(f"Failed to read buffer {buffer_index}")
                return []

            # MT5 EMPTY_VALUE constant
            EMPTY_VALUE = 2147483647

            # Filter out EMPTY_VALUE and invalid values
            result = []
            for i, val in enumerate(buffer):
                if val != EMPTY_VALUE and 0 < val < 1000000:
                    result.append({
                        'index': i,
                        'value': float(val)
                    })

            return result

        except Exception as e:
            logger.error(f"Error reading buffer {buffer_index}: {e}")
            return []

    def _extract_fractals(self, handle, rates, count):
        """Extract fractal markers from YOUR indicator"""
        try:
            # Buffer 0 = Upper fractals (peaks)
            # Buffer 1 = Lower fractals (bottoms)
            peaks_buffer = mt5.copy_buffer(handle, 0, 0, count)
            bottoms_buffer = mt5.copy_buffer(handle, 1, 0, count)

            EMPTY_VALUE = 2147483647

            peaks = []
            bottoms = []

            if peaks_buffer is not None:
                for i, val in enumerate(peaks_buffer):
                    if val != EMPTY_VALUE and 0 < val < 1000000:
                        peaks.append({
                            'time': int(rates[i]['time']),
                            'price': float(val)
                        })

            if bottoms_buffer is not None:
                for i, val in enumerate(bottoms_buffer):
                    if val != EMPTY_VALUE and 0 < val < 1000000:
                        bottoms.append({
                            'time': int(rates[i]['time']),
                            'price': float(val)
                        })

            return {
                'peaks': peaks,
                'bottoms': bottoms
            }

        except Exception as e:
            logger.error(f"Error extracting fractals: {e}")
            return {'peaks': [], 'bottoms': []}

    def get_accessible_symbols(self, tier: str) -> list:
        """
        V5: Get list of symbols accessible by tier

        Args:
            tier: User tier ('FREE' or 'PRO')

        Returns:
            list: List of accessible symbol strings
        """
        tier = tier.upper()
        return TIER_SYMBOLS.get(tier, [])
```

### 8.4 Flask Routes with Tier Authentication

Create `mt5-service/app/routes/indicators.py`:

```python
from flask import Blueprint, jsonify, request
from app.services.mt5_service import MT5Service
import os

bp = Blueprint('indicators', __name__)
mt5_service = MT5Service()

API_KEY = os.getenv('MT5_API_KEY', 'default-secret-key')

def check_api_key():
    """Validate API key from header"""
    key = request.headers.get('X-API-Key')
    if key != API_KEY:
        return False
    return True

def get_tier_from_request():
    """
    V5: Extract tier from request header

    Next.js will send the user's tier in X-User-Tier header
    Default to FREE if not provided
    """
    tier = request.headers.get('X-User-Tier', 'FREE').upper()
    if tier not in ['FREE', 'PRO']:
        tier = 'FREE'
    return tier

@bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'mt5_connected': mt5_service.is_connected(),
        'version': 'v5'  # V5 identifier
    })

@bp.route('/symbols', methods=['GET'])
def get_symbols():
    """
    V5: Get symbols accessible by tier

    Headers:
        X-API-Key: API authentication key
        X-User-Tier: User tier (FREE or PRO)
    """
    if not check_api_key():
        return jsonify({'error': 'Unauthorized'}), 401

    tier = get_tier_from_request()
    symbols = mt5_service.get_accessible_symbols(tier)

    return jsonify({
        'success': True,
        'tier': tier,
        'symbols': symbols
    })

@bp.route('/indicators/<symbol>/<timeframe>', methods=['GET'])
def get_indicators(symbol, timeframe):
    """
    V5: Get indicator data from MT5 with tier-based access control

    Headers:
        X-API-Key: API authentication key
        X-User-Tier: User tier (FREE or PRO)

    Query Parameters:
        bars: Number of bars to fetch (default: 1000)

    Returns:
        JSON with OHLC, horizontal lines, diagonal lines, and fractals
    """
    if not check_api_key():
        return jsonify({'error': 'Unauthorized'}), 401

    # V5: Get tier from request
    tier = get_tier_from_request()

    # V5: Validate symbol access
    if not mt5_service.validate_symbol_access(symbol, tier):
        accessible = mt5_service.get_accessible_symbols(tier)
        return jsonify({
            'success': False,
            'error': f'{tier} tier cannot access {symbol}',
            'tier': tier,
            'accessible_symbols': accessible,
            'upgrade_required': tier == 'FREE'
        }), 403

    bars = int(request.args.get('bars', 1000))

    try:
        # V5: Pass tier to service method
        data = mt5_service.get_indicators(symbol, timeframe, bars, tier)
        return jsonify({
            'success': True,
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bp.route('/timeframes', methods=['GET'])
def get_timeframes():
    """
    V5: Get list of available timeframes

    Returns all timeframes supported in V5
    """
    if not check_api_key():
        return jsonify({'error': 'Unauthorized'}), 401

    return jsonify({
        'success': True,
        'timeframes': ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1']  # V5 list
    })
```

### 8.5 Flask Application Factory

Create `mt5-service/app/__init__.py`:

```python
from flask import Flask
from flask_cors import CORS
from loguru import logger
import sys

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Configure logger
    logger.remove()
    logger.add(sys.stderr, level="INFO")
    logger.add("logs/mt5-service.log", rotation="10 MB", retention="7 days")

    # V5: Log startup
    logger.info("Starting MT5 Service V5")

    # Register routes
    from app.routes.indicators import bp as indicators_bp
    app.register_blueprint(indicators_bp, url_prefix='/api')

    return app
```

Create `mt5-service/run.py`:

```python
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
```

### 8.6 Flask Requirements

Create `mt5-service/requirements.txt`:

```
Flask==3.0.0
flask-cors==4.0.0
MetaTrader5==5.0.45
loguru==0.7.2
python-dotenv==1.0.0
```

### 8.7 Flask Environment Variables

Create `mt5-service/.env.example`:

```env
# MT5 Credentials (YOUR SINGLE SOURCE)
MT5_LOGIN=your_mt5_login
MT5_PASSWORD=your_mt5_password
MT5_SERVER=your_broker_server

# API Security
MT5_API_KEY=your-secret-api-key

# Flask Config
FLASK_ENV=development
FLASK_DEBUG=True
```

### 8.8 Flask Dockerfile

Create `mt5-service/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 5001

# Run application
CMD ["python", "run.py"]
```

### 8.9 Next.js API Route to Flask Service

Create `app/api/mt5/[symbol]/[timeframe]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { canAccessCombination } from '@/lib/tier-access';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5001';
const MT5_API_KEY = process.env.MT5_API_KEY || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  try {
    // V5: Get user session and tier
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { symbol, timeframe } = params;
    const tier = session.user.tier;

    // V5: Validate tier access before calling Flask
    if (!canAccessCombination(tier, symbol, timeframe)) {
      return NextResponse.json(
        {
          error: `${tier} tier cannot access ${symbol}`,
          upgrade_required: tier === 'FREE',
          accessible_symbols: tier === 'FREE' ? ['XAUUSD'] : null,
        },
        { status: 403 }
      );
    }

    // Get bars parameter
    const searchParams = request.nextUrl.searchParams;
    const bars = searchParams.get('bars') || '1000';

    // V5: Call Flask service with tier header
    const response = await fetch(
      `${MT5_SERVICE_URL}/api/indicators/${symbol}/${timeframe}?bars=${bars}`,
      {
        headers: {
          'X-API-Key': MT5_API_KEY,
          'X-User-Tier': tier, // V5: Pass tier to Flask
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('MT5 API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch indicator data' },
      { status: 500 }
    );
  }
}
```

### 8.10 MT5 Terminal Setup Instructions

Once Flask service is ready, you need to:

1. **Compile indicators in MT5:**
   - Open MetaEditor (F4 in MT5)
   - Open each .mq5 file
   - Compile (F7)
   - Check for 0 errors

2. **Attach to chart:**
   - Open MT5 chart for your symbol
   - Navigator → Indicators → Custom
   - Drag "Fractal Horizontal Line_V5" onto chart
   - Drag "Fractal Diagonal Line_V4" onto chart
   - Keep MT5 running!

3. **Verify indicators are working:**
   - You should see lines and fractals on chart
   - If not visible, check indicator settings

4. **V5: Configure for all symbols:**
   - Ensure indicators are attached to charts for ALL symbols:
     - XAUUSD (FREE + PRO)
     - AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPUSD (PRO only)
     - NDX100, US30, USDJPY, XAGUSD (PRO only)
   - Each symbol needs indicators on at least one timeframe

---

## V5 Key Changes Summary

### Timeframe Updates

- ❌ **REMOVED**: M1, M5
- ✅ **ADDED**: H2, H8
- **Final list**: M15, M30, H1, H2, H4, H8, D1

### Tier-Based Access

- **FREE tier**: XAUUSD only, all 7 timeframes
- **PRO tier**: 10 symbols, all 7 timeframes
- **Validation**: Flask validates BEFORE reading indicators
- **Headers**: Next.js passes tier via X-User-Tier header

### Commercial Model

- YOUR MT5 is the ONLY data source
- Users CANNOT connect their own MT5
- All data served from your single MT5 terminal
- Tier determines which symbols users can access

---

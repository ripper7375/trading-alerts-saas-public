"""
MT5 Service Request/Response Models

Pydantic models for validating indicator requests and responses.
Uses correct symbol and timeframe lists as per tier specifications.

Symbols: 15 total (5 FREE + 10 PRO-exclusive)
Timeframes: 9 total (NO M1 or W1!)
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ============================================================================
# VALID SYMBOLS (15 total)
# ============================================================================
VALID_SYMBOLS: List[str] = [
    # FREE tier (5 symbols)
    'BTCUSD',   # Bitcoin/USD
    'EURUSD',   # Euro/USD
    'USDJPY',   # USD/Japanese Yen
    'US30',     # Dow Jones
    'XAUUSD',   # Gold/USD
    # PRO-exclusive (10 symbols)
    'AUDJPY',   # Australian Dollar/Yen
    'AUDUSD',   # Australian Dollar/USD
    'ETHUSD',   # Ethereum/USD
    'GBPJPY',   # British Pound/Yen
    'GBPUSD',   # British Pound/USD
    'NDX100',   # NASDAQ 100
    'NZDUSD',   # New Zealand Dollar/USD
    'USDCAD',   # USD/Canadian Dollar
    'USDCHF',   # USD/Swiss Franc
    'XAGUSD',   # Silver/USD
]

# ============================================================================
# VALID TIMEFRAMES (9 total - NO M1 or W1!)
# ============================================================================
VALID_TIMEFRAMES: List[str] = [
    # Intraday short
    'M5',   # 5 minutes (PRO only)
    'M15',  # 15 minutes (PRO only)
    'M30',  # 30 minutes (PRO only)
    # Intraday medium
    'H1',   # 1 hour (FREE)
    'H2',   # 2 hours (PRO only)
    'H4',   # 4 hours (FREE)
    'H8',   # 8 hours (PRO only)
    'H12',  # 12 hours (PRO only)
    # Daily
    'D1',   # 1 day (FREE)
]

# FREE tier subsets
FREE_SYMBOLS: List[str] = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']
FREE_TIMEFRAMES: List[str] = ['H1', 'H4', 'D1']


# ============================================================================
# TIER ENUM
# ============================================================================
class Tier(str, Enum):
    """User subscription tier"""
    FREE = 'FREE'
    PRO = 'PRO'


# ============================================================================
# REQUEST MODELS
# ============================================================================
class IndicatorRequest(BaseModel):
    """
    Request model for fetching indicator data.

    Validates symbol and timeframe against the allowed lists.
    """
    symbol: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Trading symbol (e.g., XAUUSD, BTCUSD)"
    )
    timeframe: str = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Chart timeframe (e.g., H1, D1)"
    )
    bars: int = Field(
        default=1000,
        ge=1,
        le=5000,
        description="Number of bars to fetch (1-5000)"
    )
    tier: Tier = Field(
        default=Tier.FREE,
        description="User subscription tier"
    )

    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        """Validate symbol is in the allowed list"""
        v_upper = v.upper()
        if v_upper not in VALID_SYMBOLS:
            raise ValueError(
                f'Invalid symbol: {v}. Must be one of: {", ".join(VALID_SYMBOLS)}'
            )
        return v_upper

    @field_validator('timeframe')
    @classmethod
    def validate_timeframe(cls, v: str) -> str:
        """Validate timeframe is in the allowed list (NO M1 or W1!)"""
        v_upper = v.upper()
        if v_upper not in VALID_TIMEFRAMES:
            raise ValueError(
                f'Invalid timeframe: {v}. Must be one of: {", ".join(VALID_TIMEFRAMES)}. '
                f'Note: M1 and W1 are not supported.'
            )
        return v_upper


class SymbolsRequest(BaseModel):
    """Request model for fetching available symbols"""
    tier: Tier = Field(
        default=Tier.FREE,
        description="User subscription tier"
    )


class TimeframesRequest(BaseModel):
    """Request model for fetching available timeframes"""
    tier: Tier = Field(
        default=Tier.FREE,
        description="User subscription tier"
    )


# ============================================================================
# RESPONSE MODELS
# ============================================================================
class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: Literal['healthy', 'degraded', 'unhealthy']
    terminal_connected: bool
    message: str
    timestamp: str
    details: Optional[Dict[str, Any]] = None


class CandlestickData(BaseModel):
    """OHLC candlestick data point"""
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = None


class HorizontalLine(BaseModel):
    """Horizontal support/resistance line"""
    price: float
    type: str  # 'peak' or 'bottom'
    label: str


class DiagonalLine(BaseModel):
    """Diagonal trendline"""
    start_time: int
    start_price: float
    end_time: int
    end_price: float
    type: str  # 'ascending' or 'descending'


class FractalPoint(BaseModel):
    """Fractal peak or bottom point"""
    time: int
    price: float


class ProIndicators(BaseModel):
    """PRO-only indicator data (nullable for FREE users)"""
    momentum_candles: Optional[List[Dict[str, Any]]] = None
    keltner_channels: Optional[Dict[str, List[Optional[float]]]] = None
    tema: Optional[List[Optional[float]]] = None
    hrma: Optional[List[Optional[float]]] = None
    smma: Optional[List[Optional[float]]] = None
    zigzag: Optional[Dict[str, List[Dict[str, Any]]]] = None


class IndicatorData(BaseModel):
    """Complete indicator data response"""
    ohlc: List[CandlestickData]
    horizontal: Dict[str, Any]
    diagonal: Dict[str, Any]
    fractals: Dict[str, List[FractalPoint]]
    metadata: Dict[str, Any]
    proIndicators: Optional[ProIndicators] = None


class IndicatorResponse(BaseModel):
    """Indicator API response"""
    success: bool
    data: Optional[IndicatorData] = None
    error: Optional[str] = None
    tier: str
    symbol: str
    timeframe: str
    bars: int
    timestamp: str


class ErrorResponse(BaseModel):
    """Error response"""
    success: Literal[False] = False
    error: str
    message: str
    code: Optional[int] = None
    details: Optional[Dict[str, Any]] = None


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================
def get_symbols_for_tier(tier: Tier) -> List[str]:
    """Get available symbols for a tier"""
    if tier == Tier.PRO:
        return VALID_SYMBOLS
    return FREE_SYMBOLS


def get_timeframes_for_tier(tier: Tier) -> List[str]:
    """Get available timeframes for a tier"""
    if tier == Tier.PRO:
        return VALID_TIMEFRAMES
    return FREE_TIMEFRAMES


def is_symbol_allowed(symbol: str, tier: Tier) -> bool:
    """Check if symbol is allowed for tier"""
    allowed = get_symbols_for_tier(tier)
    return symbol.upper() in allowed


def is_timeframe_allowed(timeframe: str, tier: Tier) -> bool:
    """Check if timeframe is allowed for tier"""
    allowed = get_timeframes_for_tier(tier)
    return timeframe.upper() in allowed


def validate_tier_access(symbol: str, timeframe: str, tier: Tier) -> tuple[bool, Optional[str]]:
    """
    Validate that tier can access symbol and timeframe.

    Returns:
        Tuple of (allowed: bool, error_message: Optional[str])
    """
    symbol_upper = symbol.upper()
    timeframe_upper = timeframe.upper()

    # Validate symbol exists in system
    if symbol_upper not in VALID_SYMBOLS:
        return False, f"Invalid symbol: {symbol}. Valid symbols: {', '.join(VALID_SYMBOLS)}"

    # Validate timeframe exists in system
    if timeframe_upper not in VALID_TIMEFRAMES:
        return False, f"Invalid timeframe: {timeframe}. Valid timeframes: {', '.join(VALID_TIMEFRAMES)}"

    # Validate tier access
    if not is_symbol_allowed(symbol_upper, tier):
        return False, f"Symbol {symbol} requires PRO tier. Upgrade to access all 15 symbols."

    if not is_timeframe_allowed(timeframe_upper, tier):
        return False, f"Timeframe {timeframe} requires PRO tier. Upgrade to access all 9 timeframes."

    return True, None

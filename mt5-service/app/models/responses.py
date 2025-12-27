"""
Pydantic models for API response validation

These models define the structure of API responses.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class OHLCData(BaseModel):
    """OHLC candlestick data point"""

    time: int = Field(..., description="Unix timestamp")
    open: float = Field(..., description="Open price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Close price")
    volume: Optional[float] = Field(None, description="Volume")


class FractalPoint(BaseModel):
    """Fractal point (peak or bottom)"""

    index: int = Field(..., description="Bar index")
    price: float = Field(..., description="Price level")
    time: Optional[int] = Field(None, description="Unix timestamp")


class HorizontalLine(BaseModel):
    """Horizontal support/resistance line"""

    price: float = Field(..., description="Price level")
    start_time: int = Field(..., description="Start timestamp")
    end_time: int = Field(..., description="End timestamp")
    type: str = Field(..., description="Line type: SUPPORT or RESISTANCE")


class DiagonalLine(BaseModel):
    """Diagonal trend line"""

    start_price: float = Field(..., description="Start price")
    end_price: float = Field(..., description="End price")
    start_time: int = Field(..., description="Start timestamp")
    end_time: int = Field(..., description="End timestamp")
    direction: str = Field(..., description="Line direction: ASCENDING or DESCENDING")


class MomentumCandle(BaseModel):
    """Momentum candle classification"""

    index: int = Field(..., description="Bar index")
    type: int = Field(..., ge=0, le=5, description="Candle type (0-5)")
    zscore: float = Field(..., description="Z-score value")


class KeltnerChannels(BaseModel):
    """10-band Keltner Channel data"""

    ultra_extreme_upper: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 0"
    )
    extreme_upper: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 1"
    )
    upper_most: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 2"
    )
    upper: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 3"
    )
    upper_middle: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 4"
    )
    lower_middle: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 5"
    )
    lower: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 6"
    )
    lower_most: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 7"
    )
    extreme_lower: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 8"
    )
    ultra_extreme_lower: list[Optional[float]] = Field(
        default_factory=list, description="Buffer 9"
    )


class ZigZagPoint(BaseModel):
    """ZigZag peak/bottom point"""

    index: int = Field(..., description="Bar index")
    price: float = Field(..., description="Price level")
    time: Optional[int] = Field(None, description="Unix timestamp")


class ZigZagData(BaseModel):
    """ZigZag indicator data"""

    peaks: list[ZigZagPoint] = Field(default_factory=list)
    bottoms: list[ZigZagPoint] = Field(default_factory=list)


class ProIndicators(BaseModel):
    """PRO-tier exclusive indicators"""

    momentum_candles: list[MomentumCandle] = Field(
        default_factory=list, description="Momentum candle classifications"
    )
    keltner_channels: Optional[KeltnerChannels] = Field(
        None, description="10-band Keltner Channel"
    )
    tema: list[Optional[float]] = Field(
        default_factory=list, description="Triple EMA values"
    )
    hrma: list[Optional[float]] = Field(
        default_factory=list, description="Hull-like Responsive MA values"
    )
    smma: list[Optional[float]] = Field(
        default_factory=list, description="Smoothed MA values"
    )
    zigzag: Optional[ZigZagData] = Field(
        None, description="ZigZag peaks and bottoms"
    )


class IndicatorMetadata(BaseModel):
    """Metadata for indicator response"""

    symbol: str
    timeframe: str
    tier: str
    bars_returned: int
    terminal_id: Optional[str] = None
    pro_indicators_enabled: bool = False


class IndicatorData(BaseModel):
    """Complete indicator data for a symbol/timeframe"""

    ohlc: list[OHLCData] = Field(default_factory=list)
    horizontal: list[HorizontalLine] = Field(default_factory=list)
    diagonal: list[DiagonalLine] = Field(default_factory=list)
    fractals: dict[str, list[FractalPoint]] = Field(
        default_factory=lambda: {"peaks": [], "bottoms": []}
    )
    pro_indicators: Optional[ProIndicators] = None
    metadata: Optional[IndicatorMetadata] = None


class IndicatorResponse(BaseModel):
    """Response model for indicator endpoint"""

    success: bool = True
    data: Optional[IndicatorData] = None
    error: Optional[str] = None
    tier: Optional[str] = None
    upgrade_required: Optional[bool] = None
    accessible_symbols: Optional[list[str]] = None
    accessible_timeframes: Optional[list[str]] = None


class SymbolsResponse(BaseModel):
    """Response model for symbols endpoint"""

    success: bool = True
    tier: str
    symbols: list[str]


class TimeframesResponse(BaseModel):
    """Response model for timeframes endpoint"""

    success: bool = True
    tier: str
    timeframes: list[str]


class TerminalHealth(BaseModel):
    """Health status of a single MT5 terminal"""

    id: str
    connected: bool
    symbols: list[str]
    last_heartbeat: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for health endpoint"""

    status: str = Field(..., description="ok, degraded, or error")
    version: str = "v5.0.0"
    total_terminals: int = 0
    connected_terminals: int = 0
    terminals: dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    """Generic error response"""

    success: bool = False
    error: str
    tier: Optional[str] = None
    upgrade_required: Optional[bool] = None

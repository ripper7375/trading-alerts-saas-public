"""
Pydantic models for API request validation

These models validate incoming request parameters and headers.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Tier(str, Enum):
    """User subscription tier"""
    FREE = "FREE"
    PRO = "PRO"


# Valid symbols by tier
FREE_SYMBOLS = frozenset(['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'])
PRO_SYMBOLS = FREE_SYMBOLS | frozenset([
    'AUDJPY', 'AUDUSD', 'ETHUSD', 'GBPJPY', 'GBPUSD',
    'NDX100', 'NZDUSD', 'USDCAD', 'USDCHF', 'XAGUSD'
])

# Valid timeframes by tier
FREE_TIMEFRAMES = frozenset(['H1', 'H4', 'D1'])
PRO_TIMEFRAMES = FREE_TIMEFRAMES | frozenset(['M5', 'M15', 'M30', 'H2', 'H8', 'H12'])


class IndicatorRequest(BaseModel):
    """Request model for indicator data endpoint"""

    symbol: str = Field(
        ...,
        description="Trading symbol (e.g., XAUUSD, EURUSD)",
        min_length=2,
        max_length=10
    )
    timeframe: str = Field(
        ...,
        description="Chart timeframe (e.g., H1, M15, D1)",
        min_length=2,
        max_length=5
    )
    bars: int = Field(
        default=1000,
        ge=100,
        le=5000,
        description="Number of bars to retrieve (100-5000)"
    )
    tier: Tier = Field(
        default=Tier.FREE,
        description="User subscription tier"
    )

    @field_validator('symbol', mode='before')
    @classmethod
    def normalize_symbol(cls, v: str) -> str:
        """Normalize symbol to uppercase"""
        if isinstance(v, str):
            return v.upper().strip()
        return v

    @field_validator('timeframe', mode='before')
    @classmethod
    def normalize_timeframe(cls, v: str) -> str:
        """Normalize timeframe to uppercase"""
        if isinstance(v, str):
            return v.upper().strip()
        return v

    def validate_access(self) -> tuple[bool, str]:
        """
        Validate that the tier can access the requested symbol/timeframe.

        Returns:
            Tuple of (is_allowed, error_message)
        """
        symbols = PRO_SYMBOLS if self.tier == Tier.PRO else FREE_SYMBOLS
        timeframes = PRO_TIMEFRAMES if self.tier == Tier.PRO else FREE_TIMEFRAMES

        if self.symbol not in symbols:
            return False, f"{self.tier.value} tier cannot access {self.symbol}"

        if self.timeframe not in timeframes:
            return False, f"{self.tier.value} tier cannot access {self.timeframe}"

        return True, ""

    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "XAUUSD",
                "timeframe": "H1",
                "bars": 1000,
                "tier": "FREE"
            }
        }


class SymbolsRequest(BaseModel):
    """Request model for symbols endpoint"""

    tier: Tier = Field(
        default=Tier.FREE,
        description="User subscription tier"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "tier": "PRO"
            }
        }


class TimeframesRequest(BaseModel):
    """Request model for timeframes endpoint"""

    tier: Tier = Field(
        default=Tier.FREE,
        description="User subscription tier"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "tier": "FREE"
            }
        }

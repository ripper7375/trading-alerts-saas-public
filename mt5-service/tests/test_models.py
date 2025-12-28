"""
Test Suite - Pydantic Models

Tests for request/response validation models.
"""

import pytest
from pydantic import ValidationError

from app.constants.errors import ValidationMessages
from app.models.requests import (
    IndicatorRequest,
    SymbolsRequest,
    TimeframesRequest,
    Tier,
    VALID_SYMBOLS,
    VALID_TIMEFRAMES,
    FREE_SYMBOLS,
    FREE_TIMEFRAMES,
    get_symbols_for_tier,
    get_timeframes_for_tier,
    is_symbol_allowed,
    is_timeframe_allowed,
    validate_tier_access,
)


class TestValidSymbols:
    """Test valid symbols configuration"""

    def test_correct_symbol_count(self):
        """Test we have exactly 15 symbols"""
        assert len(VALID_SYMBOLS) == 15

    def test_free_symbols_subset_of_valid(self):
        """Test FREE symbols are subset of valid"""
        for symbol in FREE_SYMBOLS:
            assert symbol in VALID_SYMBOLS

    def test_free_symbols_count(self):
        """Test FREE tier has exactly 5 symbols"""
        assert len(FREE_SYMBOLS) == 5

    def test_no_invalid_symbols(self):
        """Test no M1 or W1 exist (should be timeframes anyway)"""
        for symbol in VALID_SYMBOLS:
            assert symbol not in ['M1', 'W1']


class TestValidTimeframes:
    """Test valid timeframes configuration"""

    def test_correct_timeframe_count(self):
        """Test we have exactly 9 timeframes"""
        assert len(VALID_TIMEFRAMES) == 9

    def test_no_m1_timeframe(self):
        """Test M1 is not in valid timeframes"""
        assert 'M1' not in VALID_TIMEFRAMES

    def test_no_w1_timeframe(self):
        """Test W1 is not in valid timeframes"""
        assert 'W1' not in VALID_TIMEFRAMES

    def test_includes_all_expected_timeframes(self):
        """Test all expected timeframes are present"""
        expected = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']
        for tf in expected:
            assert tf in VALID_TIMEFRAMES, f"{tf} should be in valid timeframes"

    def test_free_timeframes_count(self):
        """Test FREE tier has exactly 3 timeframes"""
        assert len(FREE_TIMEFRAMES) == 3

    def test_free_timeframes_subset(self):
        """Test FREE timeframes are subset of valid"""
        for tf in FREE_TIMEFRAMES:
            assert tf in VALID_TIMEFRAMES


class TestIndicatorRequest:
    """Test IndicatorRequest model validation"""

    def test_valid_request(self):
        """Test valid request passes validation"""
        request = IndicatorRequest(
            symbol='XAUUSD',
            timeframe='H1',
            bars=500,
            tier=Tier.FREE
        )
        assert request.symbol == 'XAUUSD'
        assert request.timeframe == 'H1'
        assert request.bars == 500

    def test_symbol_uppercase_conversion(self):
        """Test symbol is converted to uppercase"""
        request = IndicatorRequest(
            symbol='xauusd',
            timeframe='h1',
            bars=500
        )
        assert request.symbol == 'XAUUSD'
        assert request.timeframe == 'H1'

    def test_invalid_symbol_rejected(self):
        """Test invalid symbol raises validation error"""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorRequest(
                symbol='INVALID',
                timeframe='H1',
                bars=500
            )
        assert 'Invalid symbol' in str(exc_info.value)

    def test_invalid_timeframe_rejected(self):
        """Test invalid timeframe (M1) raises validation error"""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorRequest(
                symbol='XAUUSD',
                timeframe='M1',  # Not allowed!
                bars=500
            )
        assert 'Invalid timeframe' in str(exc_info.value)

    def test_w1_timeframe_rejected(self):
        """Test W1 timeframe raises validation error"""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorRequest(
                symbol='XAUUSD',
                timeframe='W1',  # Not allowed!
                bars=500
            )
        assert 'Invalid timeframe' in str(exc_info.value)

    def test_bars_default_value(self):
        """Test bars defaults to 1000"""
        request = IndicatorRequest(
            symbol='XAUUSD',
            timeframe='H1'
        )
        assert request.bars == 1000

    def test_bars_minimum(self):
        """Test bars minimum is 1"""
        request = IndicatorRequest(
            symbol='XAUUSD',
            timeframe='H1',
            bars=1
        )
        assert request.bars == 1

    def test_bars_maximum(self):
        """Test bars maximum is 5000"""
        request = IndicatorRequest(
            symbol='XAUUSD',
            timeframe='H1',
            bars=5000
        )
        assert request.bars == 5000

    def test_bars_exceeds_maximum(self):
        """Test bars > 5000 raises validation error"""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorRequest(
                symbol='XAUUSD',
                timeframe='H1',
                bars=5001
            )
        assert 'less than or equal to 5000' in str(exc_info.value)

    def test_tier_default_to_free(self):
        """Test tier defaults to FREE"""
        request = IndicatorRequest(
            symbol='XAUUSD',
            timeframe='H1'
        )
        assert request.tier == Tier.FREE


class TestTierFunctions:
    """Test tier utility functions"""

    def test_get_symbols_for_free_tier(self):
        """Test get_symbols_for_tier returns correct symbols for FREE"""
        symbols = get_symbols_for_tier(Tier.FREE)
        assert len(symbols) == 5
        assert 'XAUUSD' in symbols
        assert 'GBPUSD' not in symbols

    def test_get_symbols_for_pro_tier(self):
        """Test get_symbols_for_tier returns all symbols for PRO"""
        symbols = get_symbols_for_tier(Tier.PRO)
        assert len(symbols) == 15
        assert 'XAUUSD' in symbols
        assert 'GBPUSD' in symbols

    def test_get_timeframes_for_free_tier(self):
        """Test get_timeframes_for_tier returns correct timeframes for FREE"""
        timeframes = get_timeframes_for_tier(Tier.FREE)
        assert len(timeframes) == 3
        assert 'H1' in timeframes
        assert 'M5' not in timeframes

    def test_get_timeframes_for_pro_tier(self):
        """Test get_timeframes_for_tier returns all timeframes for PRO"""
        timeframes = get_timeframes_for_tier(Tier.PRO)
        assert len(timeframes) == 9
        assert 'M5' in timeframes
        assert 'D1' in timeframes

    def test_is_symbol_allowed_free_tier(self):
        """Test is_symbol_allowed for FREE tier"""
        # FREE tier can access these
        assert is_symbol_allowed('XAUUSD', Tier.FREE) is True
        assert is_symbol_allowed('BTCUSD', Tier.FREE) is True

        # FREE tier cannot access these
        assert is_symbol_allowed('GBPUSD', Tier.FREE) is False
        assert is_symbol_allowed('AUDJPY', Tier.FREE) is False

    def test_is_symbol_allowed_pro_tier(self):
        """Test is_symbol_allowed for PRO tier"""
        # PRO tier can access all
        assert is_symbol_allowed('XAUUSD', Tier.PRO) is True
        assert is_symbol_allowed('GBPUSD', Tier.PRO) is True
        assert is_symbol_allowed('AUDJPY', Tier.PRO) is True

    def test_is_timeframe_allowed_free_tier(self):
        """Test is_timeframe_allowed for FREE tier"""
        # FREE tier can access these
        assert is_timeframe_allowed('H1', Tier.FREE) is True
        assert is_timeframe_allowed('H4', Tier.FREE) is True
        assert is_timeframe_allowed('D1', Tier.FREE) is True

        # FREE tier cannot access these
        assert is_timeframe_allowed('M5', Tier.FREE) is False
        assert is_timeframe_allowed('H12', Tier.FREE) is False

    def test_is_timeframe_allowed_pro_tier(self):
        """Test is_timeframe_allowed for PRO tier"""
        # PRO tier can access all
        for tf in VALID_TIMEFRAMES:
            assert is_timeframe_allowed(tf, Tier.PRO) is True


class TestValidateTierAccess:
    """Test validate_tier_access function"""

    def test_free_tier_allowed_combination(self):
        """Test FREE tier can access allowed symbol + timeframe"""
        allowed, error = validate_tier_access('XAUUSD', 'H1', Tier.FREE)
        assert allowed is True
        assert error is None

    def test_free_tier_denied_symbol(self):
        """Test FREE tier denied for PRO-only symbol"""
        allowed, error = validate_tier_access('GBPUSD', 'H1', Tier.FREE)
        assert allowed is False
        # Use constant to ensure test stays synchronized with implementation
        assert ValidationMessages.SYMBOL_PRO_REQUIRED in error

    def test_free_tier_denied_timeframe(self):
        """Test FREE tier denied for PRO-only timeframe"""
        allowed, error = validate_tier_access('XAUUSD', 'M5', Tier.FREE)
        assert allowed is False
        # Use constant to ensure test stays synchronized with implementation
        assert ValidationMessages.TIMEFRAME_PRO_REQUIRED in error

    def test_pro_tier_all_allowed(self):
        """Test PRO tier can access any valid combination"""
        allowed, error = validate_tier_access('GBPUSD', 'M5', Tier.PRO)
        assert allowed is True
        assert error is None

    def test_invalid_symbol_error(self):
        """Test invalid symbol returns error"""
        allowed, error = validate_tier_access('INVALID', 'H1', Tier.PRO)
        assert allowed is False
        assert 'Invalid symbol' in error

    def test_invalid_timeframe_error(self):
        """Test invalid timeframe (M1) returns error"""
        allowed, error = validate_tier_access('XAUUSD', 'M1', Tier.PRO)
        assert allowed is False
        assert 'Invalid timeframe' in error


class TestSymbolsRequest:
    """Test SymbolsRequest model"""

    def test_default_tier(self):
        """Test default tier is FREE"""
        request = SymbolsRequest()
        assert request.tier == Tier.FREE

    def test_pro_tier(self):
        """Test PRO tier setting"""
        request = SymbolsRequest(tier=Tier.PRO)
        assert request.tier == Tier.PRO


class TestTimeframesRequest:
    """Test TimeframesRequest model"""

    def test_default_tier(self):
        """Test default tier is FREE"""
        request = TimeframesRequest()
        assert request.tier == Tier.FREE

    def test_pro_tier(self):
        """Test PRO tier setting"""
        request = TimeframesRequest(tier=Tier.PRO)
        assert request.tier == Tier.PRO


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

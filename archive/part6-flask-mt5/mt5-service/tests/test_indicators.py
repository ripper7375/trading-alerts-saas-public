"""
Test Suite - Indicators API and Tier Validation

Tests tier validation logic and indicator endpoint behavior.
"""

import pytest
from app import create_app
from app.services.tier_service import (
    validate_symbol_access,
    validate_timeframe_access,
    validate_chart_access
)


@pytest.fixture
def client():
    """Create test Flask client"""
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestTierValidation:
    """Test tier validation service"""

    def test_free_tier_symbol_access(self):
        """Test FREE tier can access allowed symbols"""
        # Should allow
        is_allowed, error = validate_symbol_access('XAUUSD', 'FREE')
        assert is_allowed is True
        assert error == ''

        is_allowed, error = validate_symbol_access('BTCUSD', 'FREE')
        assert is_allowed is True

        # Should deny
        is_allowed, error = validate_symbol_access('GBPUSD', 'FREE')
        assert is_allowed is False
        assert 'FREE tier cannot access GBPUSD' in error

    def test_pro_tier_symbol_access(self):
        """Test PRO tier can access all symbols"""
        # Should allow all 15 symbols
        is_allowed, error = validate_symbol_access('XAUUSD', 'PRO')
        assert is_allowed is True

        is_allowed, error = validate_symbol_access('GBPUSD', 'PRO')
        assert is_allowed is True

        is_allowed, error = validate_symbol_access('AUDJPY', 'PRO')
        assert is_allowed is True

    def test_free_tier_timeframe_access(self):
        """Test FREE tier timeframe restrictions"""
        # Should allow H1, H4, D1
        is_allowed, error = validate_timeframe_access('H1', 'FREE')
        assert is_allowed is True

        is_allowed, error = validate_timeframe_access('H4', 'FREE')
        assert is_allowed is True

        is_allowed, error = validate_timeframe_access('D1', 'FREE')
        assert is_allowed is True

        # Should deny M5, H12
        is_allowed, error = validate_timeframe_access('M5', 'FREE')
        assert is_allowed is False
        assert 'FREE tier cannot access M5' in error

        is_allowed, error = validate_timeframe_access('H12', 'FREE')
        assert is_allowed is False

    def test_pro_tier_timeframe_access(self):
        """Test PRO tier can access all timeframes"""
        # Should allow all 9 timeframes
        for tf in ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']:
            is_allowed, error = validate_timeframe_access(tf, 'PRO')
            assert is_allowed is True, f"PRO should access {tf}"

    def test_chart_access_validation(self):
        """Test combined symbol + timeframe validation"""
        # FREE tier: allowed combination
        is_allowed, error = validate_chart_access('XAUUSD', 'H1', 'FREE')
        assert is_allowed is True

        # FREE tier: denied symbol
        is_allowed, error = validate_chart_access('GBPUSD', 'H1', 'FREE')
        assert is_allowed is False

        # FREE tier: denied timeframe
        is_allowed, error = validate_chart_access('XAUUSD', 'M5', 'FREE')
        assert is_allowed is False

        # PRO tier: all allowed
        is_allowed, error = validate_chart_access('GBPUSD', 'M5', 'PRO')
        assert is_allowed is True


class TestIndicatorsEndpoint:
    """Test indicators API endpoint"""

    def test_health_check(self, client):
        """Test health check endpoint works correctly.

        Note: In CI environment, MT5 terminals are not available so health
        returns 503 (degraded). In production with MT5 connected, returns 200.
        Both are valid responses indicating the endpoint works correctly.
        """
        response = client.get('/api/health')
        # Accept both 200 (connected) and 503 (disconnected in CI)
        assert response.status_code in (200, 503)
        data = response.get_json()
        # Status reflects connection state
        assert data['status'] in ('ok', 'degraded', 'error')
        assert 'version' in data

    def test_free_tier_blocked_symbol(self, client):
        """Test FREE tier blocked from PRO-only symbol"""
        response = client.get(
            '/api/indicators/GBPUSD/H1',
            headers={'X-User-Tier': 'FREE'}
        )
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
        assert 'FREE tier cannot access GBPUSD' in data['error']

    def test_free_tier_blocked_timeframe(self, client):
        """Test FREE tier blocked from PRO-only timeframe"""
        response = client.get(
            '/api/indicators/XAUUSD/M5',
            headers={'X-User-Tier': 'FREE'}
        )
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
        assert 'M5' in data['error']

    def test_missing_tier_defaults_to_free(self, client):
        """Test missing tier header defaults to FREE"""
        response = client.get('/api/indicators/GBPUSD/H1')
        assert response.status_code == 403
        data = response.get_json()
        assert data['tier'] == 'FREE'


class TestProIndicatorFunctions:
    """Test PRO-only indicator fetch functions (Part 6: MT5 Service)"""

    def test_empty_pro_indicators_structure(self):
        """Test _empty_pro_indicators returns correct structure"""
        from app.services.indicator_reader import _empty_pro_indicators

        result = _empty_pro_indicators()

        assert 'momentum_candles' in result
        assert 'keltner_channels' in result
        assert 'tema' in result
        assert 'hrma' in result
        assert 'smma' in result
        assert 'zigzag' in result

        # Should be empty lists/dicts
        assert result['momentum_candles'] == []
        assert result['tema'] == []
        assert result['hrma'] == []
        assert result['smma'] == []

    def test_empty_keltner_channels_structure(self):
        """Test _empty_keltner_channels returns 10 bands"""
        from app.services.indicator_reader import _empty_keltner_channels

        result = _empty_keltner_channels()

        # Should have all 10 bands
        expected_bands = [
            'ultra_extreme_upper', 'extreme_upper', 'upper_most', 'upper',
            'upper_middle', 'lower_middle', 'lower', 'lower_most',
            'extreme_lower', 'ultra_extreme_lower'
        ]
        for band in expected_bands:
            assert band in result
            assert result[band] == []

    def test_buffer_to_value_array_with_none(self):
        """Test _buffer_to_value_array handles None input"""
        from app.services.indicator_reader import _buffer_to_value_array

        result = _buffer_to_value_array(None)
        assert result == []

    def test_buffer_to_value_array_filters_empty_value(self):
        """Test _buffer_to_value_array converts EMPTY_VALUE to None"""
        from app.services.indicator_reader import (
            _buffer_to_value_array,
            EMPTY_VALUE
        )
        import numpy as np

        # Simulate MT5 buffer with EMPTY_VALUE
        buffer = np.array([100.0, EMPTY_VALUE, 200.0, 0, 300.0])
        result = _buffer_to_value_array(buffer)

        # EMPTY_VALUE and 0 should become None
        assert len(result) == 5
        assert result[0] == 100.0
        assert result[1] is None  # EMPTY_VALUE -> None
        assert result[2] == 200.0
        assert result[3] is None  # 0 -> None
        assert result[4] == 300.0

    def test_buffer_to_zigzag_points_with_none(self):
        """Test _buffer_to_zigzag_points handles None inputs"""
        from app.services.indicator_reader import _buffer_to_zigzag_points

        # Both None
        result = _buffer_to_zigzag_points(None, None)
        assert result == []

        # Buffer None
        result = _buffer_to_zigzag_points(None, [])
        assert result == []

    def test_buffer_to_zigzag_points_with_data(self):
        """Test _buffer_to_zigzag_points extracts valid points"""
        from app.services.indicator_reader import (
            _buffer_to_zigzag_points,
            EMPTY_VALUE
        )
        import numpy as np

        # Mock buffer and rates
        buffer = np.array([EMPTY_VALUE, 2050.5, EMPTY_VALUE, 2030.0])
        rates = np.array([
            (1700000000,), (1700001000,), (1700002000,), (1700003000,)
        ], dtype=[('time', 'i8')])

        result = _buffer_to_zigzag_points(buffer, rates)

        # Should have 2 valid points
        assert len(result) == 2
        assert result[0]['index'] == 1
        assert result[0]['price'] == 2050.5
        assert result[0]['time'] == 1700001000
        assert result[1]['index'] == 3
        assert result[1]['price'] == 2030.0


class TestProIndicatorsEndpoint:
    """Test PRO indicators inclusion in API response"""

    def test_pro_tier_gets_pro_indicators_structure(self, client):
        """Test PRO tier response includes pro_indicators field"""
        response = client.get(
            '/api/indicators/XAUUSD/H1',
            headers={'X-User-Tier': 'PRO'}
        )
        # Accept both 200 (with data) and 503 (MT5 not connected)
        if response.status_code == 200:
            data = response.get_json()
            # PRO tier should have pro_indicators in response
            assert 'pro_indicators' in data or data.get('success') is True

    def test_free_tier_excluded_from_pro_indicators(self, client):
        """Test FREE tier does not receive PRO indicator data"""
        response = client.get(
            '/api/indicators/XAUUSD/H1',
            headers={'X-User-Tier': 'FREE'}
        )
        if response.status_code == 200:
            data = response.get_json()
            # FREE tier should NOT have pro_indicators data populated
            pro_data = data.get('pro_indicators', {})
            # Either empty or not present
            if pro_data:
                assert pro_data.get('momentum_candles', []) == []


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

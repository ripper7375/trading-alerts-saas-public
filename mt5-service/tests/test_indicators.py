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
        """Test health check endpoint"""
        response = client.get('/api/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'ok'
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


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

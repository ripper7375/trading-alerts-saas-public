"""
Integration tests with mocked MT5 responses

These tests mock the MT5 connection pool and indicator reader
to test API endpoints without requiring actual MT5 terminals.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import numpy as np

from app import create_app


@pytest.fixture
def client():
    """Create test Flask client"""
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_mt5_connection():
    """Create a mock MT5 connection"""
    connection = Mock()
    connection.id = 'mock_terminal_1'
    connection.connected = True
    connection.symbols = ['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD']
    return connection


@pytest.fixture
def mock_ohlc_data():
    """Create mock OHLC data"""
    return [
        {'time': 1700000000, 'open': 2000.0, 'high': 2010.0, 'low': 1995.0, 'close': 2005.0, 'volume': 1000},
        {'time': 1700003600, 'open': 2005.0, 'high': 2015.0, 'low': 2000.0, 'close': 2010.0, 'volume': 1200},
        {'time': 1700007200, 'open': 2010.0, 'high': 2020.0, 'low': 2008.0, 'close': 2018.0, 'volume': 800},
    ]


@pytest.fixture
def mock_indicator_data(mock_ohlc_data):
    """Create complete mock indicator data"""
    return {
        'ohlc': mock_ohlc_data,
        'horizontal': [
            {'price': 2015.0, 'start_time': 1700000000, 'end_time': 1700007200, 'type': 'RESISTANCE'},
            {'price': 1998.0, 'start_time': 1700000000, 'end_time': 1700007200, 'type': 'SUPPORT'},
        ],
        'diagonal': [
            {'start_price': 1995.0, 'end_price': 2018.0, 'start_time': 1700000000, 'end_time': 1700007200, 'direction': 'ASCENDING'},
        ],
        'fractals': {
            'peaks': [{'index': 2, 'price': 2020.0, 'time': 1700007200}],
            'bottoms': [{'index': 0, 'price': 1995.0, 'time': 1700000000}],
        },
    }


@pytest.fixture
def mock_pro_indicators():
    """Create mock PRO indicators data"""
    return {
        'momentum_candles': [
            {'index': 0, 'type': 1, 'zscore': 0.8},
            {'index': 1, 'type': 0, 'zscore': 0.3},
            {'index': 2, 'type': 2, 'zscore': 1.5},
        ],
        'keltner_channels': {
            'ultra_extreme_upper': [2025.0, 2030.0, 2035.0],
            'extreme_upper': [2020.0, 2025.0, 2030.0],
            'upper_most': [2015.0, 2020.0, 2025.0],
            'upper': [2010.0, 2015.0, 2020.0],
            'upper_middle': [2005.0, 2010.0, 2015.0],
            'lower_middle': [1995.0, 2000.0, 2005.0],
            'lower': [1990.0, 1995.0, 2000.0],
            'lower_most': [1985.0, 1990.0, 1995.0],
            'extreme_lower': [1980.0, 1985.0, 1990.0],
            'ultra_extreme_lower': [1975.0, 1980.0, 1985.0],
        },
        'tema': [2002.0, 2008.0, 2014.0],
        'hrma': [2001.0, 2007.0, 2013.0],
        'smma': [2000.5, 2006.5, 2012.5],
        'zigzag': {
            'peaks': [{'index': 2, 'price': 2020.0, 'time': 1700007200}],
            'bottoms': [{'index': 0, 'price': 1995.0, 'time': 1700000000}],
        },
    }


class TestMockedIndicatorEndpoint:
    """Tests with fully mocked MT5 connection"""

    def test_get_indicators_pro_tier_success(
        self, client, mock_mt5_connection, mock_indicator_data, mock_pro_indicators
    ):
        """Test successful PRO tier indicator request with mocked data"""
        with patch('app.routes.indicators.get_connection_pool') as mock_pool_fn:
            with patch('app.routes.indicators.fetch_indicator_data') as mock_fetch:
                with patch('app.routes.indicators.fetch_pro_indicators') as mock_pro:
                    # Setup mocks
                    mock_pool = Mock()
                    mock_pool.get_connection_by_symbol.return_value = mock_mt5_connection
                    mock_pool_fn.return_value = mock_pool

                    mock_fetch.return_value = mock_indicator_data.copy()
                    mock_pro.return_value = mock_pro_indicators

                    # Make request
                    response = client.get(
                        '/api/indicators/XAUUSD/H1?bars=500',
                        headers={'X-User-Tier': 'PRO'}
                    )

                    assert response.status_code == 200
                    data = response.get_json()

                    assert data['success'] is True
                    assert 'data' in data
                    assert 'ohlc' in data['data']
                    assert 'pro_indicators' in data['data']
                    assert data['data']['metadata']['tier'] == 'PRO'
                    assert data['data']['metadata']['pro_indicators_enabled'] is True

    def test_get_indicators_free_tier_success(
        self, client, mock_mt5_connection, mock_indicator_data
    ):
        """Test successful FREE tier indicator request"""
        with patch('app.routes.indicators.get_connection_pool') as mock_pool_fn:
            with patch('app.routes.indicators.fetch_indicator_data') as mock_fetch:
                with patch('app.routes.indicators._empty_pro_indicators') as mock_empty:
                    # Setup mocks
                    mock_pool = Mock()
                    mock_pool.get_connection_by_symbol.return_value = mock_mt5_connection
                    mock_pool_fn.return_value = mock_pool

                    mock_fetch.return_value = mock_indicator_data.copy()
                    mock_empty.return_value = {
                        'momentum_candles': [],
                        'keltner_channels': {},
                        'tema': [],
                        'hrma': [],
                        'smma': [],
                        'zigzag': {},
                    }

                    # Make request for FREE-accessible symbol
                    response = client.get(
                        '/api/indicators/XAUUSD/H1',
                        headers={'X-User-Tier': 'FREE'}
                    )

                    assert response.status_code == 200
                    data = response.get_json()

                    assert data['success'] is True
                    assert data['data']['metadata']['tier'] == 'FREE'
                    assert data['data']['metadata']['pro_indicators_enabled'] is False

    def test_disconnected_terminal_returns_503(self, client, mock_mt5_connection):
        """Test that disconnected terminal returns 503"""
        mock_mt5_connection.connected = False

        with patch('app.routes.indicators.get_connection_pool') as mock_pool_fn:
            mock_pool = Mock()
            mock_pool.get_connection_by_symbol.return_value = mock_mt5_connection
            mock_pool_fn.return_value = mock_pool

            response = client.get(
                '/api/indicators/XAUUSD/H1',
                headers={'X-User-Tier': 'PRO'}
            )

            assert response.status_code == 503
            data = response.get_json()
            assert data['success'] is False
            assert 'disconnected' in data['error'].lower()

    def test_no_terminal_for_symbol_returns_500(self, client):
        """Test that missing terminal returns 500"""
        with patch('app.routes.indicators.get_connection_pool') as mock_pool_fn:
            mock_pool = Mock()
            mock_pool.get_connection_by_symbol.return_value = None
            mock_pool_fn.return_value = mock_pool

            response = client.get(
                '/api/indicators/XAUUSD/H1',
                headers={'X-User-Tier': 'PRO'}
            )

            assert response.status_code == 500
            data = response.get_json()
            assert data['success'] is False
            assert 'No MT5 terminal' in data['error']


class TestMockedSymbolsEndpoint:
    """Tests for symbols endpoint"""

    def test_get_free_symbols(self, client):
        """Test getting FREE tier symbols"""
        response = client.get('/api/symbols', headers={'X-User-Tier': 'FREE'})

        assert response.status_code == 200
        data = response.get_json()

        assert data['success'] is True
        assert data['tier'] == 'FREE'
        assert len(data['symbols']) == 5
        assert 'XAUUSD' in data['symbols']
        assert 'EURUSD' in data['symbols']

    def test_get_pro_symbols(self, client):
        """Test getting PRO tier symbols"""
        response = client.get('/api/symbols', headers={'X-User-Tier': 'PRO'})

        assert response.status_code == 200
        data = response.get_json()

        assert data['success'] is True
        assert data['tier'] == 'PRO'
        assert len(data['symbols']) == 15
        assert 'GBPUSD' in data['symbols']
        assert 'ETHUSD' in data['symbols']


class TestMockedTimeframesEndpoint:
    """Tests for timeframes endpoint"""

    def test_get_free_timeframes(self, client):
        """Test getting FREE tier timeframes"""
        response = client.get('/api/timeframes', headers={'X-User-Tier': 'FREE'})

        assert response.status_code == 200
        data = response.get_json()

        assert data['success'] is True
        assert data['tier'] == 'FREE'
        assert len(data['timeframes']) == 3
        assert 'H1' in data['timeframes']
        assert 'H4' in data['timeframes']
        assert 'D1' in data['timeframes']

    def test_get_pro_timeframes(self, client):
        """Test getting PRO tier timeframes"""
        response = client.get('/api/timeframes', headers={'X-User-Tier': 'PRO'})

        assert response.status_code == 200
        data = response.get_json()

        assert data['success'] is True
        assert data['tier'] == 'PRO'
        assert len(data['timeframes']) == 9
        assert 'M5' in data['timeframes']
        assert 'H12' in data['timeframes']


class TestPydanticModels:
    """Test Pydantic model validation"""

    def test_indicator_request_validation(self):
        """Test IndicatorRequest validation"""
        from app.models import IndicatorRequest, Tier

        # Valid request
        req = IndicatorRequest(
            symbol='xauusd',  # Should be normalized to uppercase
            timeframe='h1',
            bars=500,
            tier=Tier.PRO
        )
        assert req.symbol == 'XAUUSD'
        assert req.timeframe == 'H1'
        assert req.bars == 500

    def test_indicator_request_bars_limits(self):
        """Test IndicatorRequest bars validation"""
        from app.models import IndicatorRequest
        from pydantic import ValidationError

        # Too few bars
        with pytest.raises(ValidationError):
            IndicatorRequest(symbol='XAUUSD', timeframe='H1', bars=50)

        # Too many bars
        with pytest.raises(ValidationError):
            IndicatorRequest(symbol='XAUUSD', timeframe='H1', bars=10000)

    def test_indicator_request_access_validation(self):
        """Test IndicatorRequest.validate_access()"""
        from app.models import IndicatorRequest, Tier

        # FREE tier with FREE symbol/timeframe
        req = IndicatorRequest(symbol='XAUUSD', timeframe='H1', tier=Tier.FREE)
        is_allowed, error = req.validate_access()
        assert is_allowed is True
        assert error == ""

        # FREE tier with PRO symbol
        req = IndicatorRequest(symbol='GBPUSD', timeframe='H1', tier=Tier.FREE)
        is_allowed, error = req.validate_access()
        assert is_allowed is False
        assert 'FREE tier cannot access GBPUSD' in error

        # FREE tier with PRO timeframe
        req = IndicatorRequest(symbol='XAUUSD', timeframe='M5', tier=Tier.FREE)
        is_allowed, error = req.validate_access()
        assert is_allowed is False
        assert 'FREE tier cannot access M5' in error

        # PRO tier with PRO symbol/timeframe
        req = IndicatorRequest(symbol='GBPUSD', timeframe='M5', tier=Tier.PRO)
        is_allowed, error = req.validate_access()
        assert is_allowed is True

    def test_indicator_response_model(self):
        """Test IndicatorResponse model"""
        from app.models import IndicatorResponse, IndicatorData, OHLCData

        # Create response with data
        ohlc = OHLCData(time=1700000000, open=2000.0, high=2010.0, low=1995.0, close=2005.0)
        data = IndicatorData(ohlc=[ohlc])
        response = IndicatorResponse(success=True, data=data)

        assert response.success is True
        assert len(response.data.ohlc) == 1
        assert response.data.ohlc[0].close == 2005.0

    def test_pro_indicators_model(self):
        """Test ProIndicators model"""
        from app.models import ProIndicators, MomentumCandle, KeltnerChannels

        pro = ProIndicators(
            momentum_candles=[
                MomentumCandle(index=0, type=1, zscore=0.8)
            ],
            tema=[2000.0, 2005.0, None],
            hrma=[1998.0, 2003.0],
            smma=[1997.0, 2002.0],
        )

        assert len(pro.momentum_candles) == 1
        assert pro.momentum_candles[0].zscore == 0.8
        assert pro.tema[2] is None  # None values are allowed


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

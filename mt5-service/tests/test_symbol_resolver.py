"""
Unit Tests for Symbol Resolver

Tests broker-specific symbol name resolution (e.g., Eightcap's .i suffix).
"""

import pytest
from unittest.mock import Mock, patch, MagicMock

from app.utils.symbol_resolver import SymbolResolver, get_symbol_resolver


class TestSymbolResolver:
    """Test SymbolResolver class"""

    def setup_method(self):
        """Setup before each test"""
        self.resolver = SymbolResolver()
        # Clear cache before each test
        self.resolver.clear_cache()

    def test_initialization(self):
        """Test resolver initializes correctly"""
        assert self.resolver._cache == {}
        assert self.resolver._available_symbols is None

    def test_exact_match(self):
        """Test exact symbol match (no suffix needed)"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            # Mock symbol_info to return symbol exists
            mock_mt5.symbol_info.return_value = Mock()

            result = self.resolver.resolve("XAUUSD")
            assert result == "XAUUSD"

    def test_suffix_resolution(self):
        """Test symbol resolution with broker suffix (.i)"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            # Mock symbols_get to return available symbols
            mock_symbol = Mock()
            mock_symbol.name = "EURUSD.i"
            mock_mt5.symbols_get.return_value = [mock_symbol]

            # Load symbols first
            self.resolver._load_available_symbols()

            # Resolve EURUSD -> EURUSD.i
            result = self.resolver.resolve("EURUSD")
            assert result == "EURUSD.i"

    def test_suffix_already_present(self):
        """Test symbol that already has suffix"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            mock_symbol = Mock()
            mock_symbol.name = "EURUSD.i"
            mock_mt5.symbols_get.return_value = [mock_symbol]

            self.resolver._load_available_symbols()

            # EURUSD.i should resolve to EURUSD.i
            result = self.resolver.resolve("EURUSD.i")
            assert result == "EURUSD.i"

    def test_remove_suffix(self):
        """Test removing suffix if base symbol exists"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            mock_symbol = Mock()
            mock_symbol.name = "GBPUSD"
            mock_mt5.symbols_get.return_value = [mock_symbol]

            self.resolver._load_available_symbols()

            # GBPUSD.i should resolve to GBPUSD if .i version doesn't exist
            result = self.resolver.resolve("GBPUSD.i")
            assert result == "GBPUSD"

    def test_symbol_not_found(self):
        """Test symbol that doesn't exist in any variation"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            mock_mt5.symbols_get.return_value = []

            self.resolver._load_available_symbols()

            # Non-existent symbol should return original
            result = self.resolver.resolve("NONEXISTENT")
            assert result == "NONEXISTENT"

    def test_caching(self):
        """Test that successful resolutions are cached"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            mock_symbol = Mock()
            mock_symbol.name = "EURUSD.i"
            mock_mt5.symbols_get.return_value = [mock_symbol]

            self.resolver._load_available_symbols()

            # First resolution
            result1 = self.resolver.resolve("EURUSD")
            assert result1 == "EURUSD.i"

            # Check cache
            assert "EURUSD" in self.resolver._cache
            assert self.resolver._cache["EURUSD"] == "EURUSD.i"

            # Second resolution should use cache
            result2 = self.resolver.resolve("EURUSD")
            assert result2 == "EURUSD.i"

    def test_starts_with_clean_name(self):
        """Test starts_with_clean_name method"""
        resolver = SymbolResolver()

        # Should match
        assert resolver.starts_with_clean_name("EURUSD.i", "EURUSD") is True
        assert resolver.starts_with_clean_name("EURUSD-c", "EURUSD") is True
        assert resolver.starts_with_clean_name("EURUSDc", "EURUSD") is True

        # Should not match
        assert resolver.starts_with_clean_name("GBPUSD.i", "EURUSD") is False
        assert resolver.starts_with_clean_name("XAUUSD", "EURUSD") is False

    def test_resolve_batch(self):
        """Test batch symbol resolution"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            # Mock multiple symbols
            symbols_list = [
                Mock(name="EURUSD.i"),
                Mock(name="GBPUSD.i"),
                Mock(name="XAUUSD"),
            ]
            mock_mt5.symbols_get.return_value = symbols_list

            self.resolver._load_available_symbols()

            # Batch resolve
            symbols = ["EURUSD", "GBPUSD", "XAUUSD"]
            results = self.resolver.resolve_batch(symbols)

            assert results["EURUSD"] == "EURUSD.i"
            assert results["GBPUSD"] == "GBPUSD.i"
            assert results["XAUUSD"] == "XAUUSD"

    def test_clear_cache(self):
        """Test cache clearing"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            mock_symbol = Mock()
            mock_symbol.name = "EURUSD.i"
            mock_mt5.symbols_get.return_value = [mock_symbol]

            self.resolver._load_available_symbols()
            self.resolver.resolve("EURUSD")

            # Cache should have data
            assert len(self.resolver._cache) > 0
            assert self.resolver._available_symbols is not None

            # Clear cache
            self.resolver.clear_cache()

            # Cache should be empty
            assert self.resolver._cache == {}
            assert self.resolver._available_symbols is None

    def test_get_cache_stats(self):
        """Test cache statistics"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            mock_symbol = Mock()
            mock_symbol.name = "EURUSD.i"
            mock_mt5.symbols_get.return_value = [mock_symbol]

            self.resolver._load_available_symbols()
            self.resolver.resolve("EURUSD")
            self.resolver.resolve("GBPUSD")

            stats = self.resolver.get_cache_stats()

            assert stats['cached_symbols'] == 2
            assert stats['available_symbols'] == 1

    def test_mt5_not_available(self):
        """Test behavior when MT5 is not available"""
        with patch('app.utils.symbol_resolver.mt5', None):
            resolver = SymbolResolver()

            # Should return original symbol when MT5 not available
            result = resolver.resolve("EURUSD")
            assert result == "EURUSD"

    def test_singleton_get_symbol_resolver(self):
        """Test global singleton instance"""
        resolver1 = get_symbol_resolver()
        resolver2 = get_symbol_resolver()

        # Should be same instance
        assert resolver1 is resolver2


class TestEightcapBrokerScenarios:
    """Test real-world Eightcap broker scenarios"""

    def setup_method(self):
        """Setup before each test"""
        self.resolver = SymbolResolver()
        self.resolver.clear_cache()

    def test_eightcap_forex_pairs(self):
        """Test Eightcap forex pairs with .i suffix"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            # Mock Eightcap symbols
            eightcap_symbols = [
                Mock(name="EURUSD.i"),
                Mock(name="GBPUSD.i"),
                Mock(name="USDJPY.i"),
                Mock(name="AUDUSD.i"),
            ]
            mock_mt5.symbols_get.return_value = eightcap_symbols

            self.resolver._load_available_symbols()

            # Test forex pairs
            assert self.resolver.resolve("EURUSD") == "EURUSD.i"
            assert self.resolver.resolve("GBPUSD") == "GBPUSD.i"
            assert self.resolver.resolve("USDJPY") == "USDJPY.i"
            assert self.resolver.resolve("AUDUSD") == "AUDUSD.i"

    def test_eightcap_metals_no_suffix(self):
        """Test Eightcap metals (XAUUSD, XAGUSD) without suffix"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            # Mock Eightcap symbols
            eightcap_symbols = [
                Mock(name="XAUUSD"),
                Mock(name="XAGUSD"),
            ]
            mock_mt5.symbols_get.return_value = eightcap_symbols

            self.resolver._load_available_symbols()

            # Metals should not have .i suffix
            assert self.resolver.resolve("XAUUSD") == "XAUUSD"
            assert self.resolver.resolve("XAGUSD") == "XAGUSD"

    def test_eightcap_crypto_no_suffix(self):
        """Test Eightcap crypto (BTCUSD, ETHUSD) without suffix"""
        with patch('app.utils.symbol_resolver.mt5') as mock_mt5:
            # Mock Eightcap symbols
            eightcap_symbols = [
                Mock(name="BTCUSD"),
                Mock(name="ETHUSD"),
            ]
            mock_mt5.symbols_get.return_value = eightcap_symbols

            self.resolver._load_available_symbols()

            # Crypto should not have .i suffix
            assert self.resolver.resolve("BTCUSD") == "BTCUSD"
            assert self.resolver.resolve("ETHUSD") == "ETHUSD"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

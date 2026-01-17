"""
Symbol Resolver for Broker-Specific Symbol Variations

Handles broker-specific symbol naming conventions (e.g., Eightcap's .i suffix).
Based on the symbol detection methodology from MQL5 indicator:
"Symbol Information_Revised_8_Multi_Symbol_Code Base_Data Transform_Light Version_11.mq5"

Purpose:
- Resolves clean symbol names (e.g., "EURUSD") to broker-specific names (e.g., "EURUSD.i")
- Caches successful mappings to avoid repeated lookups
- Supports multiple broker naming conventions

Usage:
    resolver = SymbolResolver()
    broker_symbol = resolver.resolve("EURUSD")  # Returns "EURUSD.i" for Eightcap

Reference: mql5-indicators/symbol-name-detection/Symbol Information*.mq5 lines 80-101
"""

import logging
from typing import Dict, Optional, List

# Try to import MetaTrader5
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

logger = logging.getLogger(__name__)


class SymbolResolver:
    """
    Resolves clean symbol names to broker-specific symbol names.

    Based on MQL5 IsAllowedSymbol() function methodology:
    - First tries exact match
    - Then tries with/without common broker suffixes
    - Caches successful mappings for performance
    """

    # Common broker-specific suffixes
    # Eightcap uses: .i for forex pairs
    # Other brokers may use: -c, c, .a, _i, .m, etc.
    BROKER_SUFFIXES = [
        '.i',      # Eightcap forex pairs (e.g., EURUSD.i)
        '-c',      # Some brokers use dash-c
        'c',       # Some brokers append 'c' without separator
        '.a',      # Alternative suffix
        '_i',      # Underscore variant
        '.m',      # Mini contracts
        '-m',      # Mini contracts (dash variant)
        '.raw',    # Raw spreads
        '-raw',    # Raw spreads (dash variant)
    ]

    def __init__(self):
        """Initialize symbol resolver with empty cache."""
        self._cache: Dict[str, Optional[str]] = {}
        self._available_symbols: Optional[List[str]] = None
        logger.info("SymbolResolver initialized")

    def _load_available_symbols(self) -> bool:
        """
        Load all available symbols from MT5 terminal.

        Returns:
            bool: True if symbols loaded successfully
        """
        if mt5 is None:
            logger.error("MetaTrader5 module not available")
            return False

        try:
            symbols = mt5.symbols_get()
            if symbols is None or len(symbols) == 0:
                logger.warning("No symbols available from MT5")
                return False

            self._available_symbols = [s.name for s in symbols]
            logger.info(f"Loaded {len(self._available_symbols)} symbols from MT5")
            return True

        except Exception as e:
            logger.error(f"Error loading symbols from MT5: {e}")
            return False

    def _symbol_exists(self, symbol: str) -> bool:
        """
        Check if symbol exists in MT5 terminal.

        Args:
            symbol: Symbol name to check

        Returns:
            bool: True if symbol exists
        """
        if mt5 is None:
            return False

        # Load symbols if not already loaded
        if self._available_symbols is None:
            if not self._load_available_symbols():
                # Fallback: try direct symbol check
                try:
                    symbol_info = mt5.symbol_info(symbol)
                    return symbol_info is not None
                except:
                    return False

        # Check in cached symbols list
        return symbol in self._available_symbols

    def resolve(self, clean_symbol: str) -> str:
        """
        Resolve clean symbol name to broker-specific symbol name.

        Methodology (from MQL5 IsAllowedSymbol function):
        1. Try exact match first
        2. Try with each common broker suffix
        3. If symbol already has suffix, try without it
        4. Cache successful resolution

        Args:
            clean_symbol: Clean symbol name (e.g., "EURUSD", "XAUUSD")

        Returns:
            str: Broker-specific symbol name or original if not found

        Examples:
            resolve("EURUSD") -> "EURUSD.i"  (Eightcap)
            resolve("XAUUSD") -> "XAUUSD"     (No suffix needed)
            resolve("EURUSD.i") -> "EURUSD.i" (Already has suffix)
        """
        # Check cache first
        if clean_symbol in self._cache:
            cached = self._cache[clean_symbol]
            if cached is not None:
                return cached

        # Strategy 1: Try exact match first
        if self._symbol_exists(clean_symbol):
            logger.debug(f"Symbol '{clean_symbol}' found as exact match")
            self._cache[clean_symbol] = clean_symbol
            return clean_symbol

        # Strategy 2: Try with each broker suffix
        for suffix in self.BROKER_SUFFIXES:
            test_symbol = clean_symbol + suffix
            if self._symbol_exists(test_symbol):
                logger.info(f"Symbol '{clean_symbol}' resolved to '{test_symbol}'")
                self._cache[clean_symbol] = test_symbol
                return test_symbol

        # Strategy 3: If symbol already has a suffix, try without it
        for suffix in self.BROKER_SUFFIXES:
            if clean_symbol.endswith(suffix):
                base_symbol = clean_symbol[:-len(suffix)]
                if self._symbol_exists(base_symbol):
                    logger.info(f"Symbol '{clean_symbol}' resolved to base '{base_symbol}'")
                    self._cache[clean_symbol] = base_symbol
                    return base_symbol

        # Strategy 4: Try common replacements (e.g., "EURUSD-c" -> "EURUSD.i")
        for old_suffix in self.BROKER_SUFFIXES:
            if clean_symbol.endswith(old_suffix):
                base_symbol = clean_symbol[:-len(old_suffix)]
                for new_suffix in self.BROKER_SUFFIXES:
                    if new_suffix != old_suffix:
                        test_symbol = base_symbol + new_suffix
                        if self._symbol_exists(test_symbol):
                            logger.info(
                                f"Symbol '{clean_symbol}' resolved to '{test_symbol}' "
                                f"(suffix replacement)"
                            )
                            self._cache[clean_symbol] = test_symbol
                            return test_symbol

        # Not found: log warning and return original
        logger.warning(
            f"Symbol '{clean_symbol}' not found in any variation. "
            f"Returning original name."
        )
        self._cache[clean_symbol] = clean_symbol  # Cache to avoid repeated lookups
        return clean_symbol

    def resolve_batch(self, symbols: List[str]) -> Dict[str, str]:
        """
        Resolve multiple symbols at once.

        Args:
            symbols: List of clean symbol names

        Returns:
            Dict mapping clean symbol to broker-specific symbol
        """
        return {symbol: self.resolve(symbol) for symbol in symbols}

    def clear_cache(self) -> None:
        """Clear the resolution cache."""
        self._cache.clear()
        self._available_symbols = None
        logger.info("SymbolResolver cache cleared")

    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get cache statistics.

        Returns:
            Dict with cache stats (size, hits, misses)
        """
        return {
            'cached_symbols': len(self._cache),
            'available_symbols': len(self._available_symbols) if self._available_symbols else 0
        }

    def starts_with_clean_name(self, symbol: str, clean_name: str) -> bool:
        """
        Check if symbol starts with clean name (ignoring broker suffix).

        Based on MQL5 methodology: StringFind(symbol, "EURUSD") == 0

        Args:
            symbol: Full broker-specific symbol (e.g., "EURUSD.i")
            clean_name: Clean symbol name (e.g., "EURUSD")

        Returns:
            bool: True if symbol starts with clean name

        Example:
            starts_with_clean_name("EURUSD.i", "EURUSD") -> True
            starts_with_clean_name("EURUSD-c", "EURUSD") -> True
            starts_with_clean_name("GBPUSD.i", "EURUSD") -> False
        """
        return symbol.startswith(clean_name)


# Global singleton instance
_resolver: Optional[SymbolResolver] = None


def get_symbol_resolver() -> SymbolResolver:
    """
    Get global SymbolResolver instance (singleton).

    Returns:
        SymbolResolver: The global resolver instance
    """
    global _resolver
    if _resolver is None:
        _resolver = SymbolResolver()
    return _resolver


def resolve_symbol(clean_symbol: str) -> str:
    """
    Convenience function to resolve a single symbol.

    Args:
        clean_symbol: Clean symbol name

    Returns:
        str: Broker-specific symbol name
    """
    resolver = get_symbol_resolver()
    return resolver.resolve(clean_symbol)

"""
Centralized Error Message Constants for MT5 Service.

Single source of truth for all error messages.
Both implementation code and tests should import from this module
to ensure consistency and prevent test/implementation drift.
"""


class ErrorMessages:
    """API-level error messages (short codes)."""

    # Authentication errors
    UNAUTHORIZED = "Unauthorized"
    FORBIDDEN = "Forbidden"

    # MT5 Service errors
    MT5_SERVICE = "MT5 service error"
    MT5_UNAVAILABLE = "MT5 service unavailable"
    MT5_CONNECTION_FAILED = "Failed to connect to MT5"

    # Validation errors
    VALIDATION_ERROR = "Validation error"
    INVALID_SYMBOL = "Invalid symbol"
    INVALID_TIMEFRAME = "Invalid timeframe"

    # Tier restriction errors
    TIER_RESTRICTION = "Tier restriction"
    TIER_UPGRADE_REQUIRED = "Upgrade required"

    # Generic errors
    INTERNAL_SERVER = "Internal server error"
    NOT_FOUND = "Not found"
    BAD_REQUEST = "Bad request"


class ErrorDetails:
    """Detailed error messages for user-facing responses."""

    MT5_SERVICE_FAILURE = (
        "Failed to fetch indicator data from MT5 service. "
        "Please try again later."
    )
    UNEXPECTED_ERROR = "An unexpected error occurred. Please try again later."


class ValidationMessages:
    """Validation-specific error messages for tier and access control."""

    # Tier upgrade messages - used in validation responses
    # These are the canonical messages that tests should match against
    # IMPORTANT: Tests check for 'requires PRO tier' substring
    SYMBOL_PRO_REQUIRED = "requires PRO tier. Upgrade to access all symbols."
    TIMEFRAME_PRO_REQUIRED = "requires PRO tier. Upgrade for all timeframes."

    # Invalid input messages
    INVALID_SYMBOL_TEMPLATE = "Invalid symbol: {symbol}. Valid symbols: {valid}"
    INVALID_TIMEFRAME_TEMPLATE = (
        "Invalid timeframe: {tf}. Valid: {valid}. "
        "Note: M1 and W1 are not supported."
    )

    # Helper methods for generating messages
    @classmethod
    def symbol_pro_required(cls, symbol: str) -> str:
        """Generate symbol upgrade required message."""
        return f"Symbol {symbol} {cls.SYMBOL_PRO_REQUIRED}"

    @classmethod
    def timeframe_pro_required(cls, timeframe: str) -> str:
        """Generate timeframe upgrade required message."""
        return f"Timeframe {timeframe} {cls.TIMEFRAME_PRO_REQUIRED}"

    @classmethod
    def invalid_symbol(cls, symbol: str, valid_symbols: list[str]) -> str:
        """Generate invalid symbol message."""
        valid = ", ".join(valid_symbols)
        return cls.INVALID_SYMBOL_TEMPLATE.format(symbol=symbol, valid=valid)

    @classmethod
    def invalid_timeframe(cls, timeframe: str, valid_tfs: list[str]) -> str:
        """Generate invalid timeframe message."""
        valid = ", ".join(valid_tfs)
        return cls.INVALID_TIMEFRAME_TEMPLATE.format(tf=timeframe, valid=valid)

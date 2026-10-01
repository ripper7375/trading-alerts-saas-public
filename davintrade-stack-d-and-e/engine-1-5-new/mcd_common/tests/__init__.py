"""Kit tests. The evaluator-error logger is silenced here; tests that check logging use assertLogs."""

import logging

logging.getLogger("mcd").addHandler(logging.NullHandler())

"""Tests of the cycle runner. The evaluators' error logger is silenced here; tests that check logging use assertLogs."""

import logging

logging.getLogger("mcd").addHandler(logging.NullHandler())

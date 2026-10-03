"""Errors of the cycle runner.

Only two kinds exist, and neither is about market data. Bad market data never raises: it becomes an
INVALID or STALE reading (rule R7). These errors are for a runner that cannot be trusted to run at all.
"""

from __future__ import annotations

from typing import Sequence


class WorkerError(Exception):
    """Base class: the caller must not invent a result."""


class ConfigError(WorkerError):
    """A registry, a flag, a checklist or a configuration file is wrong.

    ``problems`` lists every problem found, not only the first, so one run shows the whole fix.
    """

    def __init__(self, problems: Sequence[str] | str) -> None:
        self.problems: tuple[str, ...] = (problems,) if isinstance(problems, str) else tuple(problems)
        super().__init__("; ".join(self.problems))


class BundleError(WorkerError):
    """The bundle is not something a cycle can be keyed by (no slot, no symbol, a non-boolean ``retuning``).

    A bundle with bad *data* in it is not an error: the evaluators answer INVALID or STALE.
    """

"""The cycle runner of the sensor worker (build step 3, part 1; architecture section 2.2).

One call, ``Worker.run_cycle``, turns one frozen input bundle (``mcd_common.CycleInputs``) into one
reading per enabled MCD: MCD0 first, then the independent MCDs, then the derived ones in dependency
order. The runner is the only place that knows how readings relate to each other: it marks the channel
MCDs of a defective timeframe CAUTIONARY (ADR-018), hands the same-cycle readings of MCD1 and MCD2 to
MCD3 (ADR-021), applies the RETUNING switch, checks every envelope before it can be saved, and keeps
every MCD flag below what its checklist allows (architecture section 2.9).

It reads no database, no file apart from its own configuration, no network and no clock for any
decision. The sensor worker (part 4) runs it once per cycle as ``python -m mcd_worker.cli``.

The evaluators, the parameters and the registries are not copied here: they stay in ``mcd0`` to
``mcd3`` and in ``mcd_common`` and are loaded as they are.
"""

from .errors import BundleError, ConfigError, WorkerError

__all__ = ["BundleError", "ConfigError", "WorkerError"]

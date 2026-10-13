"""Problems and errors shared by the corpus tooling, the index and the service."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class Problem:
    """One thing wrong, with where it is (a file, a chunk id or a config key) and a stable code."""

    where: str
    code: str
    message: str

    def __str__(self) -> str:
        return f"{self.where}: {self.code}: {self.message}"


class KnowledgeError(Exception):
    """Base of every error this package raises on purpose."""


class ConfigError(KnowledgeError):
    """A configuration file (tags, registry codes, index settings, matrix) is not what it must be."""

    def __init__(self, problems: list[Problem] | str):
        if isinstance(problems, str):
            problems = [Problem("config", "CONFIG", problems)]
        self.problems = list(problems)
        super().__init__("; ".join(str(p) for p in self.problems))


class BuildFailed(KnowledgeError):
    """The corpus cannot be built into an index; `problems` lists everything found, not just the first."""

    def __init__(self, problems: list[Problem]):
        self.problems = sorted(problems)
        super().__init__(
            f"{len(self.problems)} problem(s): "
            + "; ".join(str(p) for p in self.problems[:5])
            + (" ..." if len(self.problems) > 5 else "")
        )


class IndexUnavailable(KnowledgeError):
    """The index on disk cannot be used. `code` is short and upper case, safe to log and to return."""

    def __init__(self, code: str, message: str = ""):
        self.code = code
        super().__init__(f"{code}: {message}" if message else code)


class UnknownIntent(KnowledgeError):
    """The request names an intent the dispatch matrix does not have."""


class RoutingVersionMismatch(KnowledgeError):
    """The request was routed with a matrix version this service does not hold."""

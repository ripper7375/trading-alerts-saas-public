"""The embedding model: fetched once at a pinned revision, then used from a local directory (decision D12).

The service never downloads at start. `fetch_model` runs when the image is built (and in a developer's first test run);
the result is a directory holding the files below and a `.revision` marker. Everything else, the index build, the
loader and the token counter, reads that directory and refuses one whose marker is not the pinned revision.
"""

from __future__ import annotations

from pathlib import Path

from .errors import IndexUnavailable
from .config import IndexConfig

REVISION_MARKER = ".revision"

# What txtai and the tokenizer need; the other formats of the repository (onnx, openvino, tf, rust) are not fetched.
MODEL_FILES = (
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt",
    "model.safetensors",
    "modules.json",
    "sentence_bert_config.json",
    "config_sentence_transformers.json",
    "1_Pooling/config.json",
)


def model_ready(model_dir: Path, revision: str) -> bool:
    """True when the directory holds the pinned revision completely."""
    marker = model_dir / REVISION_MARKER
    if not marker.is_file() or marker.read_text(encoding="utf-8").strip() != revision:
        return False
    return all((model_dir / name).is_file() for name in MODEL_FILES)


def fetch_model(config: IndexConfig, model_dir: Path) -> Path:
    """Download the pinned revision into `model_dir` (needs the network). Idempotent."""
    if model_ready(model_dir, config.model_revision):
        return model_dir
    from huggingface_hub import snapshot_download  # imported here: the service never calls this at start

    model_dir.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=config.model_repo,
        revision=config.model_revision,
        local_dir=str(model_dir),
        allow_patterns=list(MODEL_FILES),
    )
    missing = [name for name in MODEL_FILES if not (model_dir / name).is_file()]
    if missing:
        raise IndexUnavailable("MODEL_INCOMPLETE", f"{config.model_repo}@{config.model_revision} lacks {missing}")
    (model_dir / REVISION_MARKER).write_text(config.model_revision + "\n", encoding="utf-8")
    return model_dir


def require_model(config: IndexConfig, model_dir: Path) -> Path:
    """The model directory, or IndexUnavailable: this is what the service and the build call (no download)."""
    if not model_ready(model_dir, config.model_revision):
        raise IndexUnavailable(
            "MODEL_NOT_PINNED",
            f"{model_dir} does not hold {config.model_repo}@{config.model_revision}; "
            "run `python -m knowledge.gate fetch-model`",
        )
    return model_dir


class TokenCounter:
    """Counts tokens with the embedding model's own tokenizer (D11 (f)), as the model will see them.

    No special tokens are added and neither truncation nor padding is applied: the count is the length of the text in
    word pieces. `window` is the longest input txtai gives the model (its tokenizer's `model_max_length`); anything
    beyond it is not part of the dense vector, only of the keyword index.
    """

    def __init__(self, model_dir: Path):
        from tokenizers import Tokenizer  # light: no torch, no transformers

        self._tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        self._tokenizer.no_truncation()
        self._tokenizer.no_padding()
        import json

        settings = json.loads((model_dir / "tokenizer_config.json").read_text(encoding="utf-8"))
        window = settings.get("model_max_length")
        self.window = int(window) if isinstance(window, (int, float)) and window < 1_000_000 else 512

    def count(self, text: str) -> int:
        return len(self._tokenizer.encode(text, add_special_tokens=False).ids)

    __call__ = count

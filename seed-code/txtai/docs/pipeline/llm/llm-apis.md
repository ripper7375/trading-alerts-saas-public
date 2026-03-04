# txtai Supported LLM APIs

This document catalogs all LLM APIs and frameworks supported by the txtai framework, based on analysis of the source code at `src/python/txtai/pipeline/llm/`.

---

## Architecture Overview

txtai uses a **factory pattern** to auto-detect the appropriate LLM backend based on the model path. The detection order is:

1. **LiteLLM** — if recognized as an API provider string
2. **llama.cpp** — if the path ends with `.gguf`
3. **OpenCode** — if the path starts with `opencode`
4. **Hugging Face Transformers** — default fallback

```
LLM Pipeline (llm.py)
  └── GenerationFactory (factory.py)
        ├── LiteLLM      (litellm.py)   — Cloud API providers
        ├── LlamaCpp      (llama.py)     — Local GGUF models
        ├── OpenCode      (opencode.py)  — OpenCode server
        └── HFGeneration  (huggingface.py) — Local Transformers models
```

All implementations inherit from the `Generation` base class (`generation.py`), which provides a unified interface for text generation, streaming, chat formatting, and response parsing.

---

## 1. LiteLLM (Cloud LLM APIs)

**Source**: `src/python/txtai/pipeline/llm/litellm.py`

LiteLLM is the primary integration layer for cloud LLM APIs. It provides a unified abstraction across 100+ providers. LLM API keys must be set via environment variables.

### Supported Providers

| Provider | Model Examples | Environment Variable |
|---|---|---|
| **OpenAI** | `gpt-4o-mini-2024-07-18`, `gpt-4`, `gpt-5.2` | `OPENAI_API_KEY` |
| **Anthropic Claude** | `claude-3-5-haiku-20241022`, `claude-opus-4-5-20251101` | `ANTHROPIC_API_KEY` |
| **Google Gemini** | `gemini/gemini-pro`, `gemini/gemini-3-pro-preview` | `GEMINI_API_KEY` |
| **Google Vertex AI** | `vertex_ai/gemini-pro` | `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION` |
| **AWS Bedrock** | `amazon.titan-text-lite-v1` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION_NAME` |
| **Mistral** | `mistral-tiny`, `mistral-small`, `mistral-medium` | `MISTRAL_API_KEY` |
| **Cohere** | `command-light`, `command` | `COHERE_API_KEY` |
| **Groq** | `llama3-8b-8192` | `GROQ_API_KEY` |
| **Hugging Face Inference** | `roneneldan/TinyStories-1M` | `HF_API_TOKEN` |
| **Ollama** | `ollama/gpt-oss` | (custom `api_base`) |
| **OpenAI-compatible endpoints** | `openai/gpt-oss` | (custom `api_base`) |

For the full list of LiteLLM-supported providers, see the [LiteLLM provider documentation](https://litellm.vercel.app/docs/providers).

### Usage Examples

```python
from txtai import LLM

# OpenAI
llm = LLM("gpt-4o-mini-2024-07-18")

# Anthropic Claude
llm = LLM("claude-opus-4-5-20251101")

# Google Gemini
llm = LLM("gemini/gemini-3-pro-preview")

# AWS Bedrock
llm = LLM("amazon.titan-text-lite-v1")

# Mistral
llm = LLM("mistral-small")

# Cohere
llm = LLM("command-light")

# Groq
llm = LLM("llama3-8b-8192")

# Ollama (local server)
llm = LLM("ollama/gpt-oss", api_base="http://localhost:11434")

# Custom OpenAI-compatible endpoint
llm = LLM("openai/gpt-oss", api_base="http://localhost:4000")

# Explicit method specification
llm = LLM("ollama/gpt-oss", method="litellm")
```

### Embedding Providers (via LiteLLM)

LiteLLM also enables API-based text embeddings for the `Embeddings` class:

| Provider | Model Examples | Environment Variable |
|---|---|---|
| **OpenAI** | `text-embedding-3-small`, `text-embedding-3-large` | `OPENAI_API_KEY` |
| **Cohere** | `embed-english-v3.0` | `COHERE_API_KEY` |
| **Google Gemini** | `text-embedding-004` | `GEMINI_API_KEY` |
| **Vertex AI** | `text-embedding-004` | `GOOGLE_APPLICATION_CREDENTIALS` |
| **Mistral** | `mistral-embed` | `MISTRAL_API_KEY` |
| **AWS Bedrock** | `amazon.titan-embed-text-v1` | AWS credentials |
| **Voyage AI** | `voyage-01` | `VOYAGE_API_KEY` |
| **Hugging Face** | `sentence-transformers/all-MiniLM-L6-v2` | `HF_API_TOKEN` |

---

## 2. Hugging Face Transformers (Local Models)

**Source**: `src/python/txtai/pipeline/llm/huggingface.py`

The default backend for running open-source models locally. Supports text generation (causal LM), sequence-to-sequence, and vision models (image-text-to-text).

### Usage Examples

```python
from txtai import LLM

# Auto-detected as Transformers (default fallback)
llm = LLM("openai/gpt-oss-20b")
llm = LLM("meta-llama/Llama-2-7b-chat-hf")

# Explicit method
llm = LLM("openai/gpt-oss-20b", method="transformers")

# With quantization
llm = LLM("meta-llama/Llama-2-7b", quantize=True, gpu=True, dtype="torch.bfloat16")

# Externally loaded model
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-0.6B")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B")
llm = LLM((model, tokenizer))
```

### Key Features

- Auto-detects model task (causal LM, seq2seq, vision)
- Quantization support for reduced memory
- GPU acceleration
- Batch processing
- Streaming generation via `TextIteratorStreamer`

---

## 3. llama.cpp (GGUF Models)

**Source**: `src/python/txtai/pipeline/llm/llama.py`

Runs quantized GGUF models locally with efficient CPU/GPU inference via [llama-cpp-python](https://github.com/abetlen/llama-cpp-python). GGUF files can be loaded from local filesystem or downloaded from Hugging Face Hub.

### Usage Examples

```python
from txtai import LLM

# Local GGUF file
llm = LLM("path/to/model.gguf")

# Remote GGUF from Hugging Face Hub (auto-downloaded)
llm = LLM("unsloth/gpt-oss-20b-GGUF/gpt-oss-20b-Q4_K_M.gguf")

# Explicit method
llm = LLM("unsloth/gpt-oss-20b-GGUF/gpt-oss-20b-Q4_K_M.gguf", method="llama.cpp")
```

### Key Features

- Auto-detected when path ends with `.gguf`
- Supports both chat completions and raw text completions
- GPU layer offloading (`n_gpu_layers`)
- Configurable context window (`n_ctx`)

---

## 4. OpenCode Server

**Source**: `src/python/txtai/pipeline/llm/opencode.py`

Integration with [OpenCode](https://opencode.ai/docs/server/)-compatible servers via HTTP.

### Usage Examples

```python
from txtai import LLM

# Default local OpenCode server (http://localhost:4096)
llm = LLM("opencode")

# With custom URL and model
llm = LLM("opencode/big-pickle", url="http://localhost:4000")
```

### Key Features

- HTTP-based protocol
- Session management
- Provider and model selection
- Default URL: `http://localhost:4096`

---

## Summary Table

| Backend | Detection Rule | Local/Remote | API Key Required | Streaming |
|---|---|---|---|---|
| **LiteLLM** | Recognized provider string | Remote | Yes | Yes |
| **Hugging Face Transformers** | Default fallback | Local | No | Yes |
| **llama.cpp** | `.gguf` file extension | Local | No | Yes |
| **OpenCode** | `opencode` prefix | Remote | No (server) | Yes |

---

## Common LLM Parameters

All backends share these parameters via the `LLM` pipeline:

| Parameter | Default | Description |
|---|---|---|
| `path` | `ibm-granite/granite-4.0-350m` | Model path (auto-detects backend) |
| `method` | (auto-detected) | Force a specific backend: `litellm`, `transformers`, `llama.cpp`, `opencode` |
| `maxlength` | `512` | Maximum generation length |
| `stream` | `False` | Enable streaming output |
| `stop` | `None` | List of stop sequences |
| `defaultrole` | `auto` | Role handling for string inputs: `auto`, `user`, or `prompt` |
| `stripthink` | `None` | Remove `<think>` tokens from reasoning models |

---

## Related Notebooks

| Notebook | Description |
|---|---|
| [Getting started with LLM APIs](https://github.com/neuml/txtai/blob/master/examples/70_Getting_started_with_LLM_APIs.ipynb) | Covers OpenAI, Claude, Gemini, Bedrock, Mistral, Cohere, Groq and more |
| [Integrate LLM Frameworks](https://github.com/neuml/txtai/blob/master/examples/53_Integrate_LLM_Frameworks.ipynb) | llama.cpp, LiteLLM, and custom generation frameworks |
| [RAG with llama.cpp and external API services](https://github.com/neuml/txtai/blob/master/examples/62_RAG_with_llama_cpp_and_external_API_services.ipynb) | RAG with additional vector and LLM frameworks |

---

## References

- [txtai LLM Pipeline Documentation](https://neuml.github.io/txtai/pipeline/llm/llm/)
- [LiteLLM Provider Documentation](https://litellm.vercel.app/docs/providers)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python)
- [OpenCode Server Documentation](https://opencode.ai/docs/server/)
- [txtai GitHub Repository](https://github.com/neuml/txtai)

# FAQ

![faq](images/faq.png)

Below is a list of frequently asked questions and common issues encountered.

## Questions

---

**Question**

What models are recommended?

**Answer**

See the [model guide](../models).

---

**Question**

What is the best way to track the progress of an `embeddings.index` call?

**Answer**

Wrap the list or generator passed to the index call with tqdm. See [#478](https://github.com/neuml/txtai/issues/478) for more.

---

**Question**

What is the best way to analyze and debug a txtai process?

**Answer**

See the [observability](../observability) section for more on how this can be enabled in txtai processes.

txtai also has a console application. [This article](https://medium.com/neuml/insights-from-the-txtai-console-d307c28e149e) has more details.

---

**Question**

How can models be externally loaded and passed to embeddings and pipelines?

**Answer**

Embeddings example.

```python
from transformers import AutoModel, AutoTokenizer
from txtai import Embeddings

# Load model externally
model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

# Pass to embeddings instance
embeddings = Embeddings(path=model, tokenizer=tokenizer)
```

LLM pipeline example.

```python
import torch

from transformers import AutoModelForCausalLM, AutoTokenizer
from txtai import LLM

# Load Qwen3 0.6B
path = "Qwen/Qwen3-0.6B"
model = AutoModelForCausalLM.from_pretrained(
  path,
  dtype=torch.bfloat16,
)
tokenizer = AutoTokenizer.from_pretrained(path)

llm = LLM((model, tokenizer))
```

## Common issues

---

**Issue**

Embeddings query errors like this:

```
SQLError: no such function: json_extract
```

**Solution**

Upgrade Python version as it doesn't have SQLite support for `json_extract`

---

**Issue**

Segmentation faults and similar errors on macOS

**Solution**

Set the following environment parameters.

- Disable OpenMP multithreading via `export OMP_NUM_THREADS=1`
- Workaround `OMP: Error #15` errors via `export KMP_DUPLICATE_LIB_OK=TRUE`
- Disable PyTorch MPS device via `export PYTORCH_MPS_DISABLE=1`
- Disable llama.cpp metal via `export LLAMA_NO_METAL=1`

For more details, refer to [this issue on GitHub](https://github.com/kyamagu/faiss-wheels/issues/73).

---

**Issue**

Error running SQLite ANN on macOS

```
AttributeError: 'sqlite3.Connection' object has no attribute 'enable_load_extension'
```

**Solution**

See [this note](https://alexgarcia.xyz/sqlite-vec/python.html#macos-blocks-sqlite-extensions-by-default) for options on how to fix this.

---

**Issue**

`ContextualVersionConflict` and/or package METADATA exception while running one of the [examples](../examples) notebooks on Google Colab

**Solution**

Restart the kernel. See issue [#409](https://github.com/neuml/txtai/issues/409) for more on this issue.

---

**Issue**

Error installing optional/extra dependencies such as `pipeline`

**Solution**

The default MacOS shell (zsh) and Windows PowerShell require escaping square brackets

```
pip install 'txtai[pipeline]'
```

import os
from functools import lru_cache

import torch

# Prefer non-deprecated LangChain packages; gracefully fall back if not installed.
try:  # Chroma from langchain-chroma (preferred)
    from langchain_chroma import Chroma as _Chroma
except ImportError:
    from langchain_community.vectorstores.chroma import Chroma as _Chroma

try:  # Embeddings from langchain-huggingface (preferred)
    from langchain_huggingface import HuggingFaceEmbeddings as _HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceBgeEmbeddings as _HuggingFaceEmbeddings

# Use mirror to avoid slow downloads in CN
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

DB_DIR = os.path.join(os.path.dirname(__file__), "db")
MODEL_NAME = "BAAI/bge-large-zh-v1.5"
MODEL_KWARGS = {"device": "cuda" if torch.cuda.is_available() else "cpu"}
ENCODE_KWARGS = {"normalize_embeddings": True}


@lru_cache
def get_embeddings():
    """Create (or reuse) the shared embedding model instance."""
    return _HuggingFaceEmbeddings(
        model_name=MODEL_NAME,
        model_kwargs=MODEL_KWARGS,
        encode_kwargs=ENCODE_KWARGS,
    )


@lru_cache
def get_vector_db():
    """Create (or reuse) the shared Chroma vector store."""
    os.makedirs(DB_DIR, exist_ok=True)
    return _Chroma(persist_directory=DB_DIR, embedding_function=get_embeddings())

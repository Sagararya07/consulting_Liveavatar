import requests
import numpy as np

from config import HF_API_KEY, HF_EMBEDDING_MODEL

EMBEDDING_DIM = 1536

HF_API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{HF_EMBEDDING_MODEL}"

def _to_vectors(result) -> list[list[float]]:
    arr = np.array(result, dtype=float)
    if arr.ndim == 1:
        return [arr.tolist()]
    return [row.tolist() for row in arr]

def _pad_to_dim(vector: list[float]) -> list[float]:
    if len(vector) >= EMBEDDING_DIM:
        return vector[:EMBEDDING_DIM]
    return vector + [0.0] * (EMBEDDING_DIM - len(vector))

def _sync_embed(text_or_texts):
    headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
    res = requests.post(HF_API_URL, headers=headers, json={"inputs": text_or_texts}, timeout=30.0)
    if res.status_code != 200:
        raise Exception(f"HF API Error: {res.status_code} - {res.text}")
    return res.json()

async def embed_text(text: str) -> list[float]:
    result = _sync_embed(text)
    return _pad_to_dim(_to_vectors(result)[0])

async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    result = _sync_embed(texts)
    return [_pad_to_dim(vec) for vec in _to_vectors(result)]

"""Vector store and embedding engine for semantic search over DocumentChunks."""

import hashlib
import logging
import math
import re
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from data.models.chunk import DocumentChunk

log = logging.getLogger(__name__)

# Fallback vector dimension matching all-MiniLM-L6-v2
EMBEDDING_DIM = 384

_ST_MODEL = None
_ST_LOAD_ATTEMPTED = False


def _get_sentence_transformer(model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
    global _ST_MODEL, _ST_LOAD_ATTEMPTED
    if _ST_LOAD_ATTEMPTED:
        return _ST_MODEL
    _ST_LOAD_ATTEMPTED = True
    try:
        import os
        from sentence_transformers import SentenceTransformer
        try:
            _ST_MODEL = SentenceTransformer(model_name, local_files_only=True)
            log.info("Loaded cached SentenceTransformer model: %s", model_name)
            return _ST_MODEL
        except Exception:
            pass
        if os.environ.get("ALLOW_DOWNLOAD_EMBEDDINGS", "").lower() in ("true", "1"):
            _ST_MODEL = SentenceTransformer(model_name)
            log.info("Downloaded SentenceTransformer model: %s", model_name)
    except Exception as exc:
        log.warning("SentenceTransformer not available (%s). Using fallback embedder.", exc)
        _ST_MODEL = None
    return _ST_MODEL



def fallback_text_embedding(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """Deterministic token/n-gram hashing embedder with L2 normalization."""
    vec = [0.0] * dim
    words = re.findall(r"\w+", text.lower())
    if not words:
        return vec

    for word in words:
        # Hash full word
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0

        # Hash character 3-grams for subword matching
        if len(word) >= 3:
            for i in range(len(word) - 2):
                tri = word[i : i + 3]
                th = int(hashlib.md5(tri.encode("utf-8")).hexdigest(), 16)
                tidx = th % dim
                vec[tidx] += 0.5

    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0.0:
        vec = [round(x / norm, 6) for x in vec]
    return vec


class EmbeddingEngine:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        st = _get_sentence_transformer(self.model_name)
        if st is not None:
            try:
                embeddings = st.encode(texts, normalize_embeddings=True)
                return [emb.tolist() if hasattr(emb, "tolist") else list(emb) for emb in embeddings]
            except Exception as exc:
                log.warning("Error running SentenceTransformer encode: %s. Using fallback.", exc)

        return [fallback_text_embedding(t) for t in texts]

    def embed_query(self, query: str) -> List[float]:
        results = self.embed_texts([query])
        return results[0] if results else [0.0] * EMBEDDING_DIM


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


class VectorStore:
    def __init__(self, embedding_engine: Optional[EmbeddingEngine] = None):
        self.embedder = embedding_engine or EmbeddingEngine()

    def save_chunks(
        self,
        db: Session,
        chunks: List[Dict[str, Any]],
        file_id: Optional[str] = None,
        collection_name: Optional[str] = None,
    ) -> List[DocumentChunk]:
        """Compute embeddings and persist chunks to the database."""
        if not chunks:
            return []

        texts_to_embed = [c["content"] for c in chunks]
        embeddings = self.embedder.embed_texts(texts_to_embed)

        records: List[DocumentChunk] = []
        for i, c in enumerate(chunks):
            record = DocumentChunk(
                file_id=file_id,
                collection_name=collection_name,
                chunk_index=c.get("chunk_index", i),
                content=c["content"],
                embedding=embeddings[i] if i < len(embeddings) else None,
                meta=c.get("meta") or {},
            )
            db.add(record)
            records.append(record)

        db.commit()
        for r in records:
            db.refresh(r)
        return records

    def search(
        self,
        db: Session,
        query: str,
        top_k: int = 5,
        file_ids: Optional[List[str]] = None,
        collection_name: Optional[str] = None,
        collection_names: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Search chunks by cosine similarity."""
        query_vec = self.embedder.embed_query(query)

        q = db.query(DocumentChunk)
        if file_ids:
            q = q.filter(DocumentChunk.file_id.in_(file_ids))
        if collection_name:
            q = q.filter(DocumentChunk.collection_name == collection_name)
        elif collection_names:
            q = q.filter(DocumentChunk.collection_name.in_(collection_names))

        candidate_chunks = q.all()
        if not candidate_chunks:
            return []

        scored = []
        for ch in candidate_chunks:
            chunk_vec = ch.embedding
            if not chunk_vec or len(chunk_vec) != len(query_vec):
                sim = fallback_text_embedding(ch.content)
                score = cosine_similarity(query_vec, sim)
            else:
                score = cosine_similarity(query_vec, chunk_vec)

            distance = round(1.0 - max(0.0, score), 4)
            scored.append({
                "id": ch.id,
                "file_id": ch.file_id,
                "collection_name": ch.collection_name,
                "chunk_index": ch.chunk_index,
                "content": ch.content,
                "meta": ch.meta or {},
                "score": round(score, 4),
                "distance": distance,
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def delete_by_file(self, db: Session, file_id: str) -> int:
        count = db.query(DocumentChunk).filter(DocumentChunk.file_id == file_id).delete()
        db.commit()
        return count

    def delete_by_collection(self, db: Session, collection_name: str) -> int:
        count = db.query(DocumentChunk).filter(DocumentChunk.collection_name == collection_name).delete()
        db.commit()
        return count

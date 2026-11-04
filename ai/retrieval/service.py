"""Retrieval service — manages configuration, document chunking, indexing, and vector search."""

import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from ai.retrieval.chunker import SemanticChunker
from ai.retrieval.vector_store import VectorStore
from ai.retrieval.web_search import search_web
from common.exceptions import NotFoundError
from content.files.extractor import FileExtractor, extract_html_text
from content.files.repository import FileRepository
from data.models.chunk import DocumentChunk
from data.models.config import AppConfig
from data.models.file import FileRecord

log = logging.getLogger(__name__)

_CONFIG_KEY = "retrieval_config"

_DEFAULTS = {
    "pdf_extract_images": False,
    "enable_google_drive_integration": False,
    "web_loader_ssl_verification": True,
    "chunk": {
        "chunk_size": 800,
        "chunk_overlap": 100,
    },
    "content_extraction": {
        "engine": "",
        "tika_server_url": None,
    },
    "youtube": {
        "language": ["en"],
        "translation": None,
        "proxy_url": "",
    },
    "query": {
        "k": 5,
        "r": 0.0,
        "template": None,
        "hybrid": False,
    },
    "embedding": {
        "embedding_engine": "",
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "embedding_batch_size": 1,
        "openai_config": None,
    },
    "reranking": {
        "reranking_model": "",
        "enabled": False,
    },
    "web": {
        "search": {
            "enabled": True,
            "engine": "duckduckgo",
            "tavily_api_key": "",
            "searxng_url": "",
            "result_count": 3,
        }
    },
}


class RetrievalService:
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = VectorStore()
        self.file_repo = FileRepository(db, FileRecord)

    def _get_config_record(self) -> AppConfig:
        cfg = self.db.query(AppConfig).filter(AppConfig.key == _CONFIG_KEY).first()
        if not cfg:
            cfg = AppConfig(key=_CONFIG_KEY, value=_DEFAULTS.copy())
            self.db.add(cfg)
            self.db.commit()
            self.db.refresh(cfg)
        return cfg

    def get_config(self) -> dict:
        return self._get_config_record().value or _DEFAULTS.copy()

    def update_config(self, data: dict) -> dict:
        cfg = self._get_config_record()
        current = dict(cfg.value or _DEFAULTS)
        # Top-level scalar fields
        for key in (
            "pdf_extract_images",
            "enable_google_drive_integration",
            "web_loader_ssl_verification",
        ):
            if key in data:
                current[key] = data[key]
        # Nested objects — merge deeply
        for key in ("chunk", "content_extraction", "youtube", "web"):
            if key in data and isinstance(data[key], dict):
                current.setdefault(key, _DEFAULTS.get(key, {}).copy())
                current[key].update(
                    {k: v for k, v in data[key].items() if v is not None}
                )
        cfg.value = current
        self.db.commit()
        return current

    def get_template(self) -> str:
        cfg = self.get_config()
        return cfg.get("query", {}).get("template") or "[context]\n\n[query]"

    def get_query_settings(self) -> dict:
        return self.get_config().get("query", _DEFAULTS["query"])

    def update_query_settings(self, data: dict) -> dict:
        cfg = self._get_config_record()
        current = dict(cfg.value or _DEFAULTS)
        current.setdefault("query", _DEFAULTS["query"].copy())
        current["query"].update({k: v for k, v in data.items() if v is not None})
        cfg.value = current
        self.db.commit()
        return current["query"]

    def get_embedding(self) -> dict:
        return self.get_config().get("embedding", _DEFAULTS["embedding"])

    def update_embedding(self, data: dict) -> dict:
        cfg = self._get_config_record()
        current = dict(cfg.value or _DEFAULTS)
        current.setdefault("embedding", _DEFAULTS["embedding"].copy())
        current["embedding"].update({k: v for k, v in data.items() if v is not None})
        cfg.value = current
        self.db.commit()
        return current["embedding"]

    def get_reranking(self) -> dict:
        return self.get_config().get("reranking", _DEFAULTS["reranking"])

    def update_reranking(self, data: dict) -> dict:
        cfg = self._get_config_record()
        current = dict(cfg.value or _DEFAULTS)
        current.setdefault("reranking", _DEFAULTS["reranking"].copy())
        current["reranking"].update({k: v for k, v in data.items() if v is not None})
        cfg.value = current
        self.db.commit()
        return current["reranking"]

    # ── Document & Web Processing ─────────────────────────────────────────────

    def process_file(self, file_id: str, collection_name: Optional[str] = None) -> dict:
        """Extract text from FileRecord, chunk, embed, and store into DocumentChunk table."""
        record = self.file_repo.get_by_id(file_id)
        if not record:
            raise NotFoundError("File", file_id)

        # Read contents
        contents = b""
        if record.path and os.path.exists(record.path):
            with open(record.path, "rb") as fh:
                contents = fh.read()
        elif record.data and record.data.get("content"):
            contents = record.data["content"].encode("utf-8")

        # Extract text sections
        sections = FileExtractor.extract(contents, record.filename, record.content_type)
        full_text = "\n\n".join(s["text"] for s in sections if s.get("text")).strip()

        # Delete existing chunks for this file to avoid duplicates
        self.vector_store.delete_by_file(self.db, file_id)

        cfg = self.get_config()
        chunk_size = cfg.get("chunk", {}).get("chunk_size", 800)
        chunk_overlap = cfg.get("chunk", {}).get("chunk_overlap", 100)
        chunker = SemanticChunker(target_chunk_size=chunk_size, overlap_size=chunk_overlap)

        base_meta = {
            "file_id": file_id,
            "name": record.filename,
            "source": record.filename,
            "content_type": record.content_type,
        }

        chunks = chunker.split_text(full_text, source_name=record.filename, base_meta=base_meta)

        # Persist chunks
        persisted = self.vector_store.save_chunks(
            self.db,
            chunks,
            file_id=file_id,
            collection_name=collection_name or file_id,
        )

        return {
            "status": True,
            "file_id": file_id,
            "collection_name": collection_name or file_id,
            "chunk_count": len(persisted),
            "filename": record.filename,
        }

    async def process_web(self, url: str, collection_name: Optional[str] = None) -> dict:
        """Fetch web page, extract visible text, chunk, embed, and store."""
        target_collection = collection_name or url
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html_text = resp.text

        clean_text = extract_html_text(html_text)

        cfg = self.get_config()
        chunk_size = cfg.get("chunk", {}).get("chunk_size", 800)
        chunk_overlap = cfg.get("chunk", {}).get("chunk_overlap", 100)
        chunker = SemanticChunker(target_chunk_size=chunk_size, overlap_size=chunk_overlap)

        base_meta = {"source": url, "name": url, "url": url}
        chunks = chunker.split_text(clean_text, source_name=url, base_meta=base_meta)

        self.vector_store.delete_by_collection(self.db, target_collection)
        persisted = self.vector_store.save_chunks(
            self.db,
            chunks,
            collection_name=target_collection,
        )

        return {
            "status": True,
            "collection_name": target_collection,
            "chunk_count": len(persisted),
            "file": {"name": url, "url": url},
        }

    async def process_web_search(self, query: str, collection_name: Optional[str] = None) -> dict:
        """Execute web search, index snippets, and return UI SearchDocument format."""
        target_collection = collection_name or f"search_{query[:30]}"
        cfg = self.get_config()
        count = cfg.get("web", {}).get("search", {}).get("result_count", 3)

        results = await search_web(query, count=count, config=cfg)
        if not results:
            return {"status": False, "collection_name": target_collection, "filenames": []}

        # Clear previous search chunks in this collection
        self.vector_store.delete_by_collection(self.db, target_collection)

        chunker = SemanticChunker(target_chunk_size=500, overlap_size=50)
        all_chunks: List[Dict[str, Any]] = []
        filenames: List[str] = []

        for r in results:
            title = r.get("title") or r.get("url") or "Web Result"
            snippet = r.get("snippet") or ""
            link = r.get("url") or ""
            filenames.append(title)

            text_to_index = f"### {title}\nURL: {link}\n\n{snippet}"
            base_meta = {"name": title, "source": link, "url": link}
            res_chunks = chunker.split_text(text_to_index, source_name=title, base_meta=base_meta)
            all_chunks.extend(res_chunks)

        if all_chunks:
            self.vector_store.save_chunks(
                self.db,
                all_chunks,
                collection_name=target_collection,
            )

        return {
            "status": True,
            "collection_name": target_collection,
            "filenames": filenames,
        }

    def query_doc(self, collection_name: str, query: str, k: Optional[int] = None) -> dict:
        """Search chunks in a collection by query vector similarity."""
        cfg = self.get_config()
        top_k = k or cfg.get("query", {}).get("k", 5)
        results = self.vector_store.search(
            self.db,
            query,
            top_k=top_k,
            collection_name=collection_name,
        )
        return {"results": results}

    def query_collection(self, collection_names: Any, query: str, k: Optional[int] = None) -> dict:
        """Search across multiple collections or a comma-separated list."""
        cfg = self.get_config()
        top_k = k or cfg.get("query", {}).get("k", 5)

        names_list: List[str] = []
        if isinstance(collection_names, list):
            names_list = collection_names
        elif isinstance(collection_names, str):
            names_list = [c.strip() for c in collection_names.split(",") if c.strip()]

        results = self.vector_store.search(
            self.db,
            query,
            top_k=top_k,
            collection_names=names_list,
        )
        return {"results": results}

    def reset_uploads(self) -> None:
        """Delete all chunks generated from uploaded files."""
        self.db.query(DocumentChunk).filter(DocumentChunk.file_id.isnot(None)).delete()
        self.db.commit()

    def reset_vector_db(self) -> None:
        """Delete all chunks from the vector database."""
        self.db.query(DocumentChunk).delete()
        self.db.commit()

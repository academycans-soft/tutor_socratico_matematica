"""Providers service — Hermes-style core. Config via ProviderConfigService, upstream via httpx.

Ollama is treated as OpenAI-compatible via its /v1 endpoint where possible;
native Ollama API operations live in a separate adapter.
"""

import logging
import time as _time
from typing import Any, Dict, List

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ai.providers.config_service import ProviderConfigService
from ai.providers.proxy import proxy_json

log = logging.getLogger(__name__)

# ── LLM body helpers ──────────────────────────────────────────────────────────

# Fields the UI adds that are NOT part of the OpenAI wire format
_STRIP_FIELDS = {
    "session_id",
    "chat_id",
    "id",
    "params",
    "features",
    "model_item",
    "files",
    "tool_ids",
    "background_tasks",
    "avatar_type",
    "variables",
}

_STANDARD_PARAMS = {
    "temperature",
    "top_p",
    "top_k",
    "max_tokens",
    "max_completion_tokens",
    "frequency_penalty",
    "presence_penalty",
    "stop",
    "seed",
    "repeat_penalty",
    "keep_alive",
    "num_ctx",
    "num_predict",
    "format",
}


def build_llm_body(body: Dict[str, Any]) -> Dict[str, Any]:
    """Strip CE-only fields and hoist `params` into the top-level body."""
    params = body.get("params") or {}
    out = {k: v for k, v in body.items() if k not in _STRIP_FIELDS}
    for k, v in params.items():
        if k in _STANDARD_PARAMS and v is not None:
            out.setdefault(k, v)
    return out


# Module-level cache — survives across request-scoped ProvidersService instances
_OPENAI_MODEL_MAP: dict = {}  # model_id → url_idx
_OPENAI_MODEL_MAP_TS: float = 0.0
_OPENAI_MODEL_MAP_TTL: float = 60.0


async def get_openai_models_map(config: "ProviderConfigService") -> dict:
    """Return {model_id: url_idx} with 60-second TTL cache.

    The cache is scoped to this module so it survives across request-scoped
    ProvidersService instances.
    """
    global _OPENAI_MODEL_MAP, _OPENAI_MODEL_MAP_TS
    now = _time.monotonic()
    if _OPENAI_MODEL_MAP and (now - _OPENAI_MODEL_MAP_TS) < _OPENAI_MODEL_MAP_TTL:
        return _OPENAI_MODEL_MAP

    cfg = config.get_openai()
    urls: list = cfg.get("OPENAI_API_BASE_URLS") or []
    keys: list = cfg.get("OPENAI_API_KEYS") or []
    result: dict = {}
    for idx, url in enumerate(urls):
        key = keys[idx] if idx < len(keys) else ""
        try:
            data = await proxy_json(url.rstrip("/"), key, "GET", "models")
            for m in data.get("data", []):
                model_id = m.get("id") or m.get("name")
                if model_id and model_id not in result:
                    result[model_id] = idx
        except Exception as exc:
            log.warning("OpenAI upstream unreachable (%s): %s", url, exc)

    _OPENAI_MODEL_MAP = result
    _OPENAI_MODEL_MAP_TS = now
    return result


def invalidate_openai_models_cache() -> None:
    global _OPENAI_MODEL_MAP_TS
    _OPENAI_MODEL_MAP_TS = 0.0


_OLLAMA_MODEL_MAP: dict = {}  # model_name → url_idx
_OLLAMA_MODEL_MAP_TS: float = 0.0
_OLLAMA_MODEL_MAP_TTL: float = 60.0


async def get_ollama_models_map(config: "ProviderConfigService") -> dict:
    """Return {model_name: url_idx} with 60s TTL cache from /api/tags aggregation."""
    global _OLLAMA_MODEL_MAP, _OLLAMA_MODEL_MAP_TS
    now = _time.monotonic()
    if _OLLAMA_MODEL_MAP and (now - _OLLAMA_MODEL_MAP_TS) < _OLLAMA_MODEL_MAP_TTL:
        return _OLLAMA_MODEL_MAP

    cfg = config.get_ollama()
    urls: list = cfg.get("OLLAMA_BASE_URLS") or []
    result: dict = {}
    for idx, url in enumerate(urls):
        try:
            data = await proxy_json(url.rstrip("/"), "", "GET", "api/tags")
            for m in data.get("models", []):
                name = m.get("model") or m.get("name")
                if name and name not in result:
                    result[name] = idx
        except Exception as exc:
            log.warning("Ollama upstream unreachable (%s): %s", url, exc)

    _OLLAMA_MODEL_MAP = result
    _OLLAMA_MODEL_MAP_TS = now
    return result


def invalidate_ollama_models_cache() -> None:
    global _OLLAMA_MODEL_MAP_TS
    _OLLAMA_MODEL_MAP_TS = 0.0


class ProvidersService:
    def __init__(self, session: Session):
        self.config = ProviderConfigService(session)

    def list_providers(self) -> List[dict]:
        oa = self.config.get_openai()
        ol = self.config.get_ollama()
        return [
            {
                "id": "openai",
                "name": "OpenAI-Compatible",
                "enabled": bool(oa.get("ENABLE_OPENAI_API")),
            },
            {
                "id": "ollama",
                "name": "Ollama",
                "enabled": bool(ol.get("ENABLE_OLLAMA_API")),
            },
        ]

    async def openai_models_map(self) -> dict:
        return await get_openai_models_map(self.config)

    async def ollama_models_map(self) -> dict:
        return await get_ollama_models_map(self.config)

    async def verify_openai(self, url: str, key: str) -> dict:
        """Verify an OpenAI-compatible endpoint by listing models."""
        if not url:
            return {"status": "error", "detail": "url required"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"{url.rstrip('/')}/models",
                    headers={"Authorization": f"Bearer {key}"} if key else {},
                )
                r.raise_for_status()
                data = r.json().get("data", [])
                return {"status": "ok", "model_count": len(data)}
        except Exception as exc:
            log.warning("OpenAI verify failed: %s", exc)
            return {"status": "unreachable", "detail": str(exc)}

    async def verify_ollama(self, url: str, key: str = "") -> dict:
        """Verify an Ollama endpoint via its native /api/version probe."""
        if not url:
            return {"status": "error", "detail": "url required"}
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    f"{url.rstrip('/')}/api/version",
                    headers={"Authorization": f"Bearer {key}"} if key else {},
                )
                r.raise_for_status()
                return {"status": "ok", "version": r.json().get("version")}
        except Exception as exc:
            log.warning("Ollama verify failed: %s", exc)
            return {"status": "unreachable", "detail": str(exc)}

    async def get_merged_models(self) -> list:
        """Aggregate models from Ollama + OpenAI providers + DB custom models.

        Returns a flat list (caller wraps in {"data": ...} if needed).
        """
        from ai.model_catalog.service import ModelsService

        ol_cfg = self.config.get_ollama()
        oa_cfg = self.config.get_openai()

        # Ollama models
        ollama: list = []
        if ol_cfg.get("ENABLE_OLLAMA_API"):
            urls: list = ol_cfg.get("OLLAMA_BASE_URLS") or []
            for idx, url in enumerate(urls):
                try:
                    data = await proxy_json(url.rstrip("/"), "", "GET", "api/tags")
                    for m in data.get("models", []):
                        model_id = m.get("model") or m.get("name", "")
                        ollama.append(
                            {
                                "id": model_id,
                                "name": m.get("name", model_id),
                                "object": "model",
                                "created": int(_time.time()),
                                "owned_by": "ollama",
                                "ollama": m,
                                "urlIdx": idx,
                            }
                        )
                except Exception as exc:
                    log.warning("Ollama upstream unreachable (%s): %s", url, exc)

        # OpenAI-compatible models
        openai: list = []
        if oa_cfg.get("ENABLE_OPENAI_API"):
            urls = oa_cfg.get("OPENAI_API_BASE_URLS") or []
            keys: list = oa_cfg.get("OPENAI_API_KEYS") or []
            for idx, url in enumerate(urls):
                key = keys[idx] if idx < len(keys) else ""
                try:
                    data = await proxy_json(url.rstrip("/"), key, "GET", "models")
                    for m in data.get("data", []):
                        model_id = m.get("id") or m.get("name", "")
                        openai.append(
                            {
                                **m,
                                "id": model_id,
                                "name": m.get("name", model_id),
                                "object": "model",
                                "owned_by": "openai",
                                "urlIdx": idx,
                            }
                        )
                except Exception as exc:
                    log.warning("OpenAI upstream unreachable (%s): %s", url, exc)

        # DB custom/overridden models
        # ModelsService is imported locally to avoid circular imports
        models_svc = ModelsService(self.config.session)
        all_db = models_svc.list_active()
        db_models = {m.base_model_id: m.to_dict() for m in all_db if m.base_model_id}
        db_standalone = [m.to_dict() for m in all_db if not m.base_model_id]

        # Merge: provider model gets overridden by matching DB entry; deduplicate by id
        merged = []
        seen_ids: set = set()
        for m in ollama + openai:
            mid = m["id"]
            if mid in seen_ids:
                continue
            seen_ids.add(mid)
            if mid in db_models:
                merged.append({**m, **db_models[mid]})
            else:
                merged.append(m)

        # Add standalone DB custom models not linked to any provider model
        merged.extend(db_standalone)

        return merged

    async def resolve_provider(self, model_id: str) -> tuple:
        """Return (base_url, api_key, path) or raise HTTPException(404).

        Uses cached model maps (ollama_models_map / openai_models_map) instead
        of re-fetching from upstream on every request.
        """
        ol_cfg = self.config.get_ollama()
        if ol_cfg.get("ENABLE_OLLAMA_API"):
            ollama_map = await self.ollama_models_map()
            if model_id in ollama_map:
                urls: list = ol_cfg.get("OLLAMA_BASE_URLS") or []
                idx = ollama_map[model_id]
                if idx < len(urls):
                    return urls[idx].rstrip("/"), "", "v1/chat/completions"

        oa_cfg = self.config.get_openai()
        if oa_cfg.get("ENABLE_OPENAI_API"):
            openai_map = await self.openai_models_map()
            if model_id in openai_map:
                urls = oa_cfg.get("OPENAI_API_BASE_URLS") or []
                keys: list = oa_cfg.get("OPENAI_API_KEYS") or []
                idx = openai_map[model_id]
                if idx < len(urls):
                    key = keys[idx] if idx < len(keys) else ""
                    return urls[idx].rstrip("/"), key, "chat/completions"

        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_id}' not found on any configured provider",
        )

"""Web search service supporting DuckDuckGo (free, default), Tavily, and SearXNG."""

import logging
import os
import re
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx

from content.files.extractor import extract_html_text

log = logging.getLogger(__name__)


class WebSearchEngine:
    """Universal web searcher with DuckDuckGo default and Tavily/SearXNG API support."""

    @staticmethod
    async def search_tavily(query: str, api_key: str, count: int = 5) -> List[Dict[str, str]]:
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": count,
            "include_answer": False,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("results", []):
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("content", ""),
                    })
                return results
            else:
                log.warning("Tavily search returned status %s: %s", resp.status_code, resp.text)
                return []

    @staticmethod
    async def search_searxng(query: str, searxng_url: str, count: int = 5) -> List[Dict[str, str]]:
        url = f"{searxng_url.rstrip('/')}/search"
        params = {"q": query, "format": "json"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("results", [])[:count]:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("content", ""),
                    })
                return results
            else:
                log.warning("SearXNG search returned status %s: %s", resp.status_code, resp.text)
                return []

    @staticmethod
    async def search_duckduckgo(query: str, count: int = 5) -> List[Dict[str, str]]:
        """Scrape DuckDuckGo HTML results cleanly without requiring API keys."""
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        url = "https://html.duckduckgo.com/html/"
        data = {"q": query, "b": ""}

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.post(url, data=data, headers=headers)
                if resp.status_code != 200:
                    log.warning("DuckDuckGo HTML returned %s", resp.status_code)
                    return []

                html = resp.text
                results: List[Dict[str, str]] = []

                title_matches = re.findall(
                    r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                    html,
                    re.DOTALL,
                )
                snippet_matches = re.findall(
                    r'<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>',
                    html,
                    re.DOTALL,
                )

                limit = min(len(title_matches), len(snippet_matches), count)
                for i in range(limit):
                    raw_href, title_html = title_matches[i]
                    title = extract_html_text(title_html)
                    snippet = extract_html_text(snippet_matches[i])

                    # Unescape or extract real url from DuckDuckGo redirect
                    url_str = raw_href
                    if "uddg=" in raw_href:
                        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
                        url_str = parsed.get("uddg", [raw_href])[0]

                    if title or snippet:
                        results.append({
                            "title": title or url_str,
                            "url": url_str,
                            "snippet": snippet,
                        })

                return results

        except Exception as exc:
            log.warning("DuckDuckGo search error: %s", exc)
            return []


async def search_web(query: str, count: int = 5, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, str]]:
    """Search web using configured search engine (Tavily, SearXNG, or DuckDuckGo)."""
    cfg = config or {}
    web_cfg = cfg.get("web", {})
    search_cfg = web_cfg.get("search", {})

    engine = (search_cfg.get("engine") or "").lower()
    tavily_api_key = search_cfg.get("tavily_api_key") or os.environ.get("TAVILY_API_KEY", "")
    searxng_url = search_cfg.get("searxng_url") or os.environ.get("SEARXNG_URL", "")

    # Priority 1: Tavily if selected or if key is provided and engine is tavily
    if engine == "tavily" or (tavily_api_key and engine != "searxng" and engine != "duckduckgo"):
        if tavily_api_key:
            res = await WebSearchEngine.search_tavily(query, tavily_api_key, count)
            if res:
                return res

    # Priority 2: SearXNG if configured
    if engine == "searxng" and searxng_url:
        res = await WebSearchEngine.search_searxng(query, searxng_url, count)
        if res:
            return res

    # Priority 3: DuckDuckGo (Free, default)
    ddg_res = await WebSearchEngine.search_duckduckgo(query, count)
    if ddg_res:
        return ddg_res

    return []

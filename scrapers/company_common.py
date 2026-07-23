"""
Shared cache for per-company career-page scrapers.

Company sites don't support server-side keyword search the way job boards
do — a scraper fetches its *entire* current listing once, unfiltered (the
app's scoring step decides relevance afterward, same as for any other
source). Since `run_search` instantiates a fresh scraper per (keyword,
source) pair, this module-level TTL cache avoids re-fetching the same
listing (sometimes hundreds of jobs) once per keyword within a single
search run.
"""
from __future__ import annotations

import time
from typing import Any, Optional

CACHE_TTL = 600  # seconds

_CACHE: dict[str, tuple[float, Any]] = {}


def get_cached(key: str) -> Optional[Any]:
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[0]) < CACHE_TTL:
        return entry[1]
    return None


def set_cached(key: str, value: Any) -> None:
    _CACHE[key] = (time.time(), value)

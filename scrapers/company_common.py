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


def set_cached_if_nonempty(key: str, value: list) -> list:
    """
    Like `set_cached`, but an empty list is never cached. A site returning
    "0 postings" is indistinguishable at parse time from a blocked/changed
    page (selectors matching nothing) — caching that for CACHE_TTL would
    silently hide a broken scraper for up to 10 minutes. Genuinely-empty
    listings just get re-fetched next time, which is cheap.
    """
    if value:
        set_cached(key, value)
    return value

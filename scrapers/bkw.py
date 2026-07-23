"""
BKW — careers powered by a custom TYPO3 module ("Jobs 3.0") that exposes its
listing as a plain JSON endpoint, no auth, no pagination (single response).
"""
from __future__ import annotations

from typing import AsyncGenerator

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, set_cached_if_nonempty

LISTING_URL = "https://jobs.bkw.com/_api/v1/structureddata?configFromContentElement=82381&language=de-ch"


def _as_text(value) -> str:
    """BKW's `relations.*` fields can be a string, a dict, or a list of
    either (multi-value taxonomy fields) — normalize any of them to text."""
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(_as_text(v) for v in value if v)
    if isinstance(value, dict):
        return str(value.get("title") or value.get("name") or value.get("label") or "")
    return str(value)


class BKWScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "BKW"

    async def _fetch_all(self) -> list[dict]:
        cached = get_cached("bkw")
        if cached is not None:
            return cached
        resp = await self._fetch(LISTING_URL)
        data = resp.json()
        jobs = data.get("data", [])
        return set_cached_if_nonempty("bkw", jobs)

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        # BKW's API returns the entire current listing in one response — there's
        # no per-keyword search or real pagination to honor, so every postings
        # is yielded and the app's scoring step (not title substring matching)
        # decides relevance.
        jobs = await self._fetch_all()

        for j in jobs:
            title = _as_text(j.get("title", ""))
            locations = j.get("locations") or []
            city = None
            if locations and isinstance(locations[0], dict):
                city = _as_text((locations[0].get("address") or {}).get("city")) or None
            job_location = city or location or "Switzerland"

            relations = j.get("relations", {}) or {}
            pensum = j.get("pensum", {}) or {}
            description_parts = [
                _as_text(relations.get("Berufsfeld")),
                _as_text(relations.get("Unternehmen")),
                f"{pensum.get('min')}–{pensum.get('max')}%" if pensum.get("min") else "",
            ]
            description = " · ".join(p for p in description_parts if p) or title

            yield ScrapedJob(
                title=title,
                company="BKW",
                location=job_location,
                description=description,
                url=j.get("url", "https://jobs.bkw.com/de/offene-stellen"),
                source=self.source_name,
                source_job_id=str(j.get("id", "")),
                employment_type=_as_text(relations.get("Anstellungsart")) or None,
                remote_ok=bool(j.get("Remotework")) or None,
            )

    async def fetch_full_description(self, source_job_id: str):
        """BKW's listing JSON has no per-job description field to enrich beyond
        what scrape() already provides — nothing further to fetch."""
        return None

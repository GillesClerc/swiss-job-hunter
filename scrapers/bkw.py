"""
BKW — careers powered by a custom TYPO3 module ("Jobs 3.0") that exposes its
listing as a plain JSON endpoint, no auth, no pagination (single response).
"""
from __future__ import annotations

from typing import AsyncGenerator

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, matches_keyword, set_cached

LISTING_URL = "https://jobs.bkw.com/_api/v1/structureddata?configFromContentElement=82381&language=de-ch"


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
        set_cached("bkw", jobs)
        return jobs

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        jobs = await self._fetch_all()
        yielded = 0
        limit = max_pages * 20

        for j in jobs:
            title = j.get("title", "")
            if not matches_keyword(title, keyword):
                continue

            locations = j.get("locations") or []
            city = locations[0].get("address", {}).get("city") if locations else None
            job_location = city or location or "Switzerland"

            relations = j.get("relations", {})
            pensum = j.get("pensum", {})
            description_parts = [
                relations.get("Berufsfeld", ""),
                relations.get("Unternehmen", ""),
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
                employment_type=relations.get("Anstellungsart"),
                remote_ok=bool(j.get("Remotework")) or None,
            )
            yielded += 1
            if yielded >= limit:
                break

    async def fetch_full_description(self, source_job_id: str):
        """BKW's listing JSON has no per-job description field to enrich beyond
        what scrape() already provides — nothing further to fetch."""
        return None

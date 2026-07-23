"""
Société des Forces Électriques de La Goule SA — tiny static careers page,
typically 0-1 open position described as free text rather than a
structured listing. Best-effort: treat each heading in the main content as
a job title with the following paragraph as its description.
"""
from __future__ import annotations

from typing import AsyncGenerator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, set_cached

LISTING_URL = "https://www.lagoule.ch/fr/jobs-et-carrieres"


class LaGouleScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "La Goule"

    async def _fetch_all(self) -> list[dict]:
        cached = get_cached("la-goule")
        if cached is not None:
            return cached

        page = await self._fetch(LISTING_URL)
        soup = BeautifulSoup(page.text, "lxml")
        jobs = []
        main = soup.select_one("main") or soup.body
        if main:
            for heading in main.find_all(["h2", "h3"]):
                title = heading.get_text(strip=True)
                if not title or len(title) < 5:
                    continue
                # Collect text of sibling paragraphs until the next heading.
                desc_parts = []
                for sib in heading.find_next_siblings():
                    if sib.name in ("h2", "h3"):
                        break
                    text = sib.get_text(" ", strip=True)
                    if text:
                        desc_parts.append(text)
                jobs.append({"title": title, "description": " ".join(desc_parts) or title})
        set_cached("la-goule", jobs)
        return jobs

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        jobs = await self._fetch_all()

        for j in jobs:
            yield ScrapedJob(
                title=j["title"],
                company="La Goule",
                location=location or "Saint-Imier, Switzerland",
                description=j["description"],
                url=LISTING_URL,
                source=self.source_name,
                source_job_id=j["title"],
            )

"""
MOVE Mobility AG — plain static careers page, no ATS. At research time it
showed no open vacancies, so this is a best-effort generic parser to be
revisited once a real posting appears.
"""
from __future__ import annotations

from typing import AsyncGenerator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, matches_keyword, set_cached

LISTING_URL = "https://move.ch/en/jobs/"


class MoveScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Move"

    async def _fetch_all(self) -> list[dict]:
        cached = get_cached("move")
        if cached is not None:
            return cached

        page = await self._fetch(LISTING_URL)
        soup = BeautifulSoup(page.text, "lxml")
        jobs = []
        main = soup.select_one("main") or soup.body
        if main:
            for link in main.find_all("a", href=True):
                href = link["href"]
                if "/jobs/" in href and href.rstrip("/") != "/en/jobs":
                    title = link.get_text(strip=True)
                    if title:
                        jobs.append({"title": title, "url": href if href.startswith("http") else "https://move.ch" + href})
        set_cached("move", jobs)
        return jobs

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        jobs = await self._fetch_all()
        yielded = 0
        limit = max_pages * 20

        for j in jobs:
            if not matches_keyword(j["title"], keyword):
                continue
            yield ScrapedJob(
                title=j["title"],
                company="Move",
                location=location or "Switzerland",
                description=j["title"],
                url=j["url"],
                source=self.source_name,
                source_job_id=j["url"],
            )
            yielded += 1
            if yielded >= limit:
                break

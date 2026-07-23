"""
Juice Technology AG — plain Shopify page, no ATS. At research time the page
showed "Currently no vacancies", so the exact markup of a real job listing
could not be observed — this is a best-effort parser (generic heading/link
scan) to be revisited once a real posting appears.
"""
from __future__ import annotations

from typing import AsyncGenerator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, set_cached_if_nonempty

LISTING_URL = "https://juice.world/en/pages/jobs"


class JuiceScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Juice"

    async def _fetch_all(self) -> list[dict]:
        cached = get_cached("juice")
        if cached is not None:
            return cached

        page = await self._fetch(LISTING_URL)
        soup = BeautifulSoup(page.text, "lxml")
        jobs = []
        # Best-effort: any link under the page's main content pointing at a
        # job-looking path. No confirmed markup exists yet (0 postings live).
        main = soup.select_one("main") or soup.body
        if main:
            for link in main.find_all("a", href=True):
                href = link["href"]
                if "/jobs/" in href and href.rstrip("/") != "/en/pages/jobs":
                    title = link.get_text(strip=True)
                    if title:
                        jobs.append({"title": title, "url": href if href.startswith("http") else "https://juice.world" + href})
        return set_cached_if_nonempty("juice", jobs)

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        jobs = await self._fetch_all()

        for j in jobs:
            yield ScrapedJob(
                title=j["title"],
                company="Juice",
                # No per-offer location scraped yet (0 postings observed at
                # implementation time) — the company's own HQ, never the
                # user's search location, which would mislabel real offers.
                location="Zürich, Switzerland",
                description=j["title"],
                url=j["url"],
                source=self.source_name,
                source_job_id=j["url"],
            )

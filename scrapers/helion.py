"""
Helion Energy AG — careers on rexx systems, plain server-rendered HTML,
no API needed.
"""
from __future__ import annotations

from typing import AsyncGenerator

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, matches_keyword, set_cached

LISTING_URL = "https://jobs.helion.ch/"


class HelionScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Helion"

    async def _fetch_all(self) -> list[dict]:
        cached = get_cached("helion")
        if cached is not None:
            return cached

        page = await self._fetch(LISTING_URL)
        soup = BeautifulSoup(page.text, "lxml")
        jobs = []
        for article in soup.select("article.joboffer_container"):
            link = article.find("a", href=True)
            title_el = article.select_one(".joboffer_title_text") or article.find(["h2", "h3"])
            loc_el = article.select_one(".job_standort")
            if not link or not title_el:
                continue
            jobs.append({
                "title": title_el.get_text(strip=True),
                "location": loc_el.get_text(strip=True) if loc_el else "",
                "url": link["href"] if link["href"].startswith("http") else LISTING_URL.rstrip("/") + "/" + link["href"].lstrip("/"),
            })
        set_cached("helion", jobs)
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
                company="Helion",
                location=j["location"] or location or "Switzerland",
                description=f"{j['title']} — {j['location']}",  # short preview; Enrich fetches the real JD
                url=j["url"],
                source=self.source_name,
                source_job_id=j["url"],
            )
            yielded += 1
            if yielded >= limit:
                break

    async def fetch_full_description(self, source_job_id: str):
        try:
            page = await self._fetch(source_job_id)
        except Exception:
            return None
        soup = BeautifulSoup(page.text, "lxml")
        main = soup.select_one("main") or soup.body
        text = main.get_text("\n", strip=True) if main else ""
        return (text, source_job_id) if len(text) > 100 else None

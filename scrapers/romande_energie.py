"""
Romande Énergie — careers page embeds a Vue widget (JoHDI Suite ATS) whose
auth token (`data-company-hash-key`) is present in the plain HTML, so the
listing API can be called directly in two steps without a headless browser.
"""
from __future__ import annotations

from typing import AsyncGenerator, Optional

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, matches_keyword, set_cached

CAREERS_URL = "https://www.romande-energie.ch/carrieres/nos-offres-demploi"


class RomandeEnergieScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Romande Énergie"

    async def _fetch_all(self) -> list[dict]:
        cached = get_cached("romande-energie")
        if cached is not None:
            return cached

        page = await self._fetch(CAREERS_URL)
        soup = BeautifulSoup(page.text, "lxml")
        widget = soup.find(attrs={"data-company-hash-key": True})
        if widget is None:
            set_cached("romande-energie", [])
            return []

        hash_key = widget["data-company-hash-key"]
        flow = widget.get("data-flow", "web")
        locale = widget.get("data-locale", "fr")

        api_url = f"https://ats.johdisuite.ch/api/company/{hash_key}/publicationFlows/{flow}/offers/{locale}"
        resp = await self._fetch(api_url)
        offers = resp.json()
        if isinstance(offers, dict):
            offers = offers.get("data", [])
        set_cached("romande-energie", offers)
        return offers

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        offers = await self._fetch_all()
        yielded = 0
        limit = max_pages * 20

        for o in offers:
            title = o.get("title", "")
            if not matches_keyword(title, keyword):
                continue

            intro_html = o.get("introduction") or ""
            description = BeautifulSoup(intro_html, "lxml").get_text("\n", strip=True) or title

            yield ScrapedJob(
                title=title,
                company="Romande Énergie",
                location=o.get("city") or o.get("work_place") or location or "Vaud, Switzerland",
                description=description,
                # No confirmed per-offer deep-link pattern from the JoHDI API — falls
                # back to the general listing page rather than guessing a URL.
                url=CAREERS_URL,
                source=self.source_name,
                source_job_id=str(o.get("id", o.get("slug", ""))),
                employment_type=o.get("contract_type"),
            )
            yielded += 1
            if yielded >= limit:
                break

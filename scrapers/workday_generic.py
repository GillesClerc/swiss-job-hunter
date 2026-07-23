"""
Generic scraper for companies whose careers site is backed by Workday.

Workday exposes a de-facto stable (if unofficial) JSON API under
`/wday/cxs/{tenant}/{site}/jobs` (POST, `limit`/`offset` pagination) used
here directly instead of rendering the React SPA. Concrete companies are
thin subclasses that only set the tenant/site config below.
"""
from __future__ import annotations

import re
from typing import AsyncGenerator, Optional

from scrapers.base import BaseScraper, ScrapedJob
from scrapers.company_common import get_cached, set_cached

PAGE_SIZE = 20


class WorkdayScraper(BaseScraper):
    """Base class — subclasses set the four class attrs below."""

    _tenant: str = ""
    _dc: str = ""            # data center / instance, e.g. "wd103"
    _site: str = ""          # career site name, e.g. "SwisscomExternalCareers"
    _company_display: str = ""
    _search_filter: Optional[str] = None  # optional Workday searchText to scope the tenant

    @property
    def source_name(self) -> str:
        return self._company_display

    @property
    def _base_url(self) -> str:
        return f"https://{self._tenant}.{self._dc}.myworkdayjobs.com"

    async def _fetch_all_postings(self) -> list[dict]:
        cache_key = f"workday:{self._tenant}:{self._dc}:{self._site}:{self._search_filter or ''}"
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

        postings: list[dict] = []
        offset = 0
        jobs_url = f"{self._base_url}/wday/cxs/{self._tenant}/{self._site}/jobs"
        while True:
            resp = await self._post(
                jobs_url,
                json={
                    "appliedFacets": {},
                    "limit": PAGE_SIZE,
                    "offset": offset,
                    "searchText": self._search_filter or "",
                },
                headers={"Content-Type": "application/json"},
            )
            data = resp.json()
            batch = data.get("jobPostings", [])
            postings.extend(batch)
            total = data.get("total", len(postings))
            offset += PAGE_SIZE
            if offset >= total or not batch:
                break

        set_cached(cache_key, postings)
        return postings

    @staticmethod
    def _normalize_job_path(external_path: str) -> str:
        """Workday external paths vary by tenant re: a leading '/job' segment."""
        if not external_path.startswith("/job/"):
            return "/job" + external_path
        return external_path

    async def scrape(
        self, keyword: str, location: str, max_pages: int
    ) -> AsyncGenerator[ScrapedJob, None]:
        # `_search_filter` (a real Workday-side query, e.g. "Switzerland") already
        # scopes the tenant — the per-profile `keyword` isn't applied client-side
        # on top of that: generic search phrases rarely match literal job titles,
        # so every current posting is yielded and the app's scoring step decides
        # relevance instead.
        postings = await self._fetch_all_postings()

        for posting in postings:
            title = posting.get("title", "")
            external_path = self._normalize_job_path(posting.get("externalPath", ""))
            job_id_match = re.search(r"_(R\d+|JR\d+|\d+)$", external_path)
            source_job_id = job_id_match.group(1) if job_id_match else external_path

            locations_text = posting.get("locationsText") or location or "Switzerland"

            yield ScrapedJob(
                title=title,
                company=self._company_display,
                location=locations_text,
                description=f"{title} — {locations_text}",  # short preview; Enrich fetches the real JD
                url=f"{self._base_url}/en-US/{self._site}{external_path}",
                source=self.source_name,
                source_job_id=external_path,  # kept as the path — used verbatim by fetch_full_description
            )

    async def fetch_full_description(self, external_path: str):
        """Fetch the full job description for the Enrich pipeline."""
        detail_path = self._normalize_job_path(external_path)
        try:
            resp = await self._fetch(f"{self._base_url}/wday/cxs/{self._tenant}/{self._site}{detail_path}")
        except Exception:
            return None
        data = resp.json()
        posting = data.get("jobPostingInfo", {})
        html = posting.get("jobDescription", "")
        if not html:
            return None
        from bs4 import BeautifulSoup
        text = BeautifulSoup(html, "lxml").get_text("\n", strip=True)
        canonical_url = f"{self._base_url}/en-US/{self._site}{detail_path}"
        return (text, canonical_url) if text else None


class SwisscomScraper(WorkdayScraper):
    _tenant = "swisscom"
    _dc = "wd103"
    _site = "SwisscomExternalCareers"
    _company_display = "Swisscom"


class SwisscomBroadcastScraper(WorkdayScraper):
    _tenant = "swisscom"
    _dc = "wd103"
    _site = "SwisscomExternalCareers"
    _company_display = "Swisscom Broadcast"
    _search_filter = "Broadcast"


class SamsungScraper(WorkdayScraper):
    _tenant = "sec"
    _dc = "wd3"
    _site = "Samsung_Careers"
    _company_display = "Samsung"
    _search_filter = "Switzerland"


class ABBScraper(WorkdayScraper):
    _tenant = "abb"
    _dc = "wd3"
    _site = "External_Career_Page"
    _company_display = "ABB"
    _search_filter = "Switzerland"


class HitachiEnergyScraper(WorkdayScraper):
    _tenant = "hitachi"
    _dc = "wd1"
    _site = "hitachi"
    _company_display = "Hitachi Energy"
    _search_filter = "Hitachi Energy Switzerland"


class LogitechScraper(WorkdayScraper):
    _tenant = "logitech"
    _dc = "wd5"
    _site = "Logitech"
    _company_display = "Logitech"
    _search_filter = "Switzerland"

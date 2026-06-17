"""Tests for scrapers — uses mocked HTTP responses."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_jobs_ch_scraper_parse():
    from scrapers.jobs_ch import JobsChScraper

    # Fields match actual jobs.ch API: flat strings, UUID slug, employment_grades
    doc = {
        "job_id": "12345",
        "title": "Senior ML Engineer",
        "company_name": "Acme AG",
        "place": "Zürich",
        "regions": [],
        "preview": "Join our AI team in Zürich.",
        "slug": "550e8400-e29b-41d4-a716-446655440000-senior-ml-engineer-acme",
        "publication_date": "2025-01-15T08:00:00Z",
        "employment_grades": [80, 100],
    }

    scraper = JobsChScraper()
    job = scraper._parse_document(doc)

    assert job is not None
    assert job.title == "Senior ML Engineer"
    assert job.company == "Acme AG"
    assert "Zürich" in job.location
    assert job.employment_type == "80–100%"
    assert job.source_job_id == "12345"


@pytest.mark.asyncio
async def test_jobup_ch_scraper_parse():
    from scrapers.jobup_ch import JobupChScraper

    doc = {
        "id": "99",
        "title": "Data Scientist",
        "company": {"name": "Swiss Bank"},
        "place": {"name": "Genève"},
        "teaser": "Exciting data science role",
        "slug": "data-scientist-swiss-bank",
        "publication_date": "2025-02-01T09:00:00Z",
    }

    scraper = JobupChScraper()
    job = scraper._parse(doc)

    assert job is not None
    assert job.title == "Data Scientist"
    assert job.company == "Swiss Bank"
    assert job.source == "jobup.ch"

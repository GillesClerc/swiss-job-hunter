"""
CV ↔ Job Description match scorer.

Two modes:
  1. Fast (keyword overlap) — no API call, runs on all new jobs.
  2. LLM (semantic)        — routes through llm.router, runs on shortlisted jobs.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config.settings import settings

# ── Skill keywords grouped by category ────────────────────────────────────────
# Each tuple: (pattern, weight)
# Weight > 1 = core skill (from Leo's CV), counted more heavily

_WEIGHTED_SKILLS: list[tuple[str, float]] = [
    # ── Core perception / AD (Leo's primary expertise) ────────────────────────
    (r"perception",                 2.0),
    (r"autonomous driving",         2.0),
    (r"self.?driving",              2.0),
    (r"adas",                       2.0),
    (r"bev",                        2.0),
    (r"bird.?s.?eye.?view",         2.0),
    (r"sparse4d",                   2.0),
    (r"sensor fusion",              2.0),
    (r"radar.?camera",              2.0),
    (r"camera.?radar",              2.0),
    (r"mmwave",                     2.0),
    (r"lidar",                      1.5),
    (r"3d detection",               2.0),
    (r"object detection",           1.5),
    (r"multi.?object tracking",     2.0),
    (r"\bmot\b",                    1.5),
    (r"trajectory prediction",      2.0),
    (r"wayformer",                  2.0),
    (r"vectornet",                  2.0),
    (r"detr",                       1.5),
    (r"deformable",                 1.5),
    (r"yolo",                       1.5),
    (r"c\-ncap",                    1.5),
    (r"fisheye",                    1.5),
    (r"surround.?view",             1.5),

    # ── Model optimization ─────────────────────────────────────────────────────
    (r"quantization",               2.0),
    (r"\bptq\b",                    2.0),
    (r"\bqat\b",                    2.0),
    (r"mixed.?precision",           2.0),
    (r"int8",                       1.5),
    (r"int16",                      1.5),
    (r"edge deployment",            1.5),
    (r"real.?time inference",       1.5),
    (r"latency",                    1.0),
    (r"model optimization",         1.5),
    (r"pruning",                    1.0),

    # ── Deep learning / ML ─────────────────────────────────────────────────────
    (r"deep learning",              1.5),
    (r"machine learning",           1.0),
    (r"computer vision",            1.5),
    (r"transformer",                1.5),
    (r"attention",                  1.0),
    (r"cross.?attention",           1.5),
    (r"multimodal",                 1.5),
    (r"multi.?modal",               1.5),
    (r"generative",                 1.0),
    (r"diffusion",                  1.0),
    (r"llm",                        1.0),
    (r"fine.?tun",                  1.0),
    (r"rlhf",                       1.0),
    (r"\blora\b",                   1.0),

    # ── Frameworks & tools ─────────────────────────────────────────────────────
    (r"pytorch",                    2.0),
    (r"python",                     1.0),
    (r"c\+\+",                      1.5),
    (r"opencv",                     1.5),
    (r"mmdetection",                1.5),
    (r"mmcv",                       1.5),
    (r"cuda",                       1.5),
    (r"tensorrt",                   1.5),
    (r"onnx",                       1.0),
    (r"docker",                     1.0),
    (r"kubernetes",                 1.0),
    (r"ros\b",                      1.0),
    (r"apollo",                     1.0),

    # ── Generic engineering ────────────────────────────────────────────────────
    (r"algorithm engineer",         1.0),
    (r"research engineer",          1.0),
    (r"ml engineer",                1.0),
    (r"ai engineer",                1.0),
    (r"software engineer",          0.8),
    (r"data scientist",             0.5),
]

_COMPILED: list[tuple[re.Pattern, float, str]] = [
    (re.compile(pat, re.IGNORECASE), weight, pat)
    for pat, weight in _WEIGHTED_SKILLS
]


@dataclass
class MatchResult:
    score: float
    matched_skills: list[str]
    missing_skills: list[str]
    explanation: str
    provider: str = "keyword"


def _compile_dynamic(raw: list[dict]) -> list[tuple[re.Pattern, float, str]]:
    """Convert LLM-extracted keyword dicts to compiled pattern tuples."""
    result = []
    for item in raw:
        kw = str(item.get("keyword", "")).strip()
        if not kw:
            continue
        weight = float(item.get("weight", 1.0))
        escaped = re.escape(kw)
        pattern = re.compile(r'(?<!\w)' + escaped + r'(?!\w)', re.IGNORECASE)
        result.append((pattern, weight, kw))
    return result


async def _extract_keywords_llm(cv_text: str) -> list[dict]:
    """Call LLM once to extract skill keywords from CV. Returns list of {keyword, weight}."""
    from llm.router import call_llm

    system = "You are a technical recruiter extracting skills from a candidate CV."
    user = f"""Extract all technical skills, tools, frameworks, and domain keywords from this CV.

Assign weight based on how central the skill is to the candidate's profile:
- 2.0: core expertise (used extensively, appears multiple times)
- 1.5: solid secondary skill (used regularly)
- 1.0: general/supporting skill (mentioned, familiar)

Rules:
- Use lowercase, simple terms that would literally appear in a job description
- Include multi-word phrases (e.g. "autonomous driving", "computer vision")
- Include abbreviations as separate entries (e.g. "bev", "adas", "mot")
- 30-60 keywords total
- Return ONLY valid JSON array, no markdown:

[{{"keyword": "pytorch", "weight": 2.0}}, {{"keyword": "python", "weight": 1.5}}, ...]

CV:
{cv_text[:5000]}"""

    raw, _ = await call_llm(user=user, system=system, max_tokens=1024)
    raw = re.sub(r'^```[a-z]*\n?', '', raw.strip())
    raw = re.sub(r'\n?```$', '', raw)
    m = re.search(r'\[.*\]', raw, re.DOTALL)
    if not m:
        return []
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return []


async def load_cv_keywords(
    profile_name: str,
    cv_text: Optional[str] = None,
) -> list[tuple[re.Pattern, float, str]]:
    """
    Load compiled keyword patterns for fast_score's pre-filter.
    Cache is the `scoring_keywords` column on the Profile row, invalidated by
    a hash of `cv_text`. Falls back to the hardcoded _COMPILED list if extraction fails.
    """
    from db.models import Profile
    from db.session import get_session

    with get_session() as session:
        row = session.query(Profile).filter(Profile.name == profile_name).first()
        if not row:
            raise FileNotFoundError(f"Profile '{profile_name}' not found.")
        text_ = cv_text or row.cv_text
        current_hash = hashlib.sha256(text_.encode()).hexdigest()

        if row.scoring_keywords and row.cv_text_hash == current_hash:
            compiled = _compile_dynamic(row.scoring_keywords)
            if compiled:
                return compiled

        keywords = await _extract_keywords_llm(text_)
        if keywords:
            row.scoring_keywords = keywords
            row.cv_text_hash = current_hash
            return _compile_dynamic(keywords)

    return _COMPILED  # fallback to hardcoded list


def fast_score(
    cv_text: str,
    jd_text: str,
    compiled: Optional[list[tuple[re.Pattern, float, str]]] = None,
) -> MatchResult:
    """
    Weighted keyword-overlap score.
    Score = sum(weights of matched skills) / sum(weights of all JD skills)
    Capped at 1.0.
    Pass `compiled` to use dynamic CV-extracted keywords instead of hardcoded list.
    """
    _patterns = compiled if compiled is not None else _COMPILED

    if not jd_text or len(jd_text.strip()) < 50:
        return MatchResult(
            score=0.0, matched_skills=[], missing_skills=[],
            explanation="JD too short — run Enrich first for better scoring.",
        )

    def _extract(text: str) -> dict[str, float]:
        found = {}
        for pat, weight, label in _patterns:
            if pat.search(text):
                found[label] = weight
        return found

    cv_skills  = _extract(cv_text)
    jd_skills  = _extract(jd_text)

    if not jd_skills:
        return MatchResult(
            score=0.2, matched_skills=[], missing_skills=[],
            explanation="No recognizable technical keywords found in JD.",
        )

    matched  = {k: w for k, w in jd_skills.items() if k in cv_skills}
    missing  = {k: w for k, w in jd_skills.items() if k not in cv_skills}

    total_jd_weight  = sum(jd_skills.values())
    matched_weight   = sum(matched.values())
    score = min(matched_weight / total_jd_weight, 1.0)

    matched_list = sorted(matched, key=lambda k: -matched[k])
    missing_list = sorted(missing, key=lambda k: -missing[k])

    explanation = (
        f"Matched {len(matched)}/{len(jd_skills)} keywords "
        f"(weighted score {score:.0%}). "
        + (f"Key matches: {', '.join(matched_list[:5])}. " if matched_list else "")
        + (f"Missing: {', '.join(missing_list[:4])}." if missing_list else "Perfect match!")
    )

    return MatchResult(
        score=round(score, 3),
        matched_skills=matched_list,
        missing_skills=missing_list,
        explanation=explanation,
    )


@dataclass
class DualMatchResult:
    """Result of score_job: technical fit + optional 'wish' fit + required language."""
    skill_score: float
    skill_explanation: str
    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    wish_score: Optional[float] = None
    wish_explanation: Optional[str] = None
    language_required: Optional[str] = None
    provider: str = "llm"


def _parse_json_object(raw: str) -> Optional[dict]:
    """Shared robust JSON-object parser used by score_job (and friends)."""
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw)

    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        return None

    json_str = m.group(0)
    json_str = json_str.replace('\u201c', '"').replace('\u201d', '"')
    json_str = json_str.replace('\u2018', "'").replace('\u2019', "'")
    json_str = re.sub(r'(?<=:)\s*"([^"]*?)\n([^"]*?)"',
                      lambda x: ': "' + x.group(1) + ' ' + x.group(2) + '"',
                      json_str)

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None


async def score_job(cv_text: str, wish_text: Optional[str], job_title: str, jd_text: str) -> DualMatchResult:
    """
    Deep LLM-based scoring via Claude / DeepSeek / etc \u2014 one combined call that returns:
    - skill_score: technical fit of the CV against the job description
    - wish_score: how well the job matches the candidate's stated wishes (only if wish_text given)
    - language_required: language(s) the job posting requires, if stated/implied
    """
    from llm.router import call_llm

    wish_block = ""
    if wish_text and wish_text.strip():
        wish_block = f"""

## What the candidate is looking for (mission type, culture, values, etc.)
{wish_text.strip()[:2000]}

Also set "wish_score" (0.0-1.0): how well this job matches what the candidate is looking for above,
independent of technical fit. Set "wish_explanation" to a 1-2 sentence justification."""

    system = (
        "You are an expert technical recruiter evaluating a candidate for a job in Switzerland. "
        "Respond only with valid JSON."
    )
    user = f"""Evaluate this candidate's fit for the job.

## Candidate CV
{cv_text}

## Job: {job_title}
{jd_text[:8000]}
{wish_block}

Also set "language_required": the language(s) required to perform this job, as stated or clearly
implied by the posting (e.g. "de", "en", "fr", "it", or a combination like "de/en"). Use null if
the posting doesn't specify.

Return ONLY valid JSON (no markdown):
{{
  "skill_score": <float 0.0-1.0>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3"],
  "skill_explanation": "2-3 sentence assessment focusing on technical fit and role alignment",
  "wish_score": <float 0.0-1.0 or null>,
  "wish_explanation": "<string or null>",
  "language_required": "<string or null>"
}}"""

    raw, provider = await call_llm(user=user, system=system, max_tokens=1024)
    data = _parse_json_object(raw)

    if data is None:
        return DualMatchResult(
            skill_score=0.0,
            skill_explanation=f"LLM returned unparseable response: {raw[:100]}",
            provider=provider,
        )

    wish_score = data.get("wish_score")
    return DualMatchResult(
        skill_score=float(data.get("skill_score") or 0.0),
        skill_explanation=data.get("skill_explanation", ""),
        matched_skills=data.get("matched_skills", []),
        missing_skills=data.get("missing_skills", []),
        wish_score=float(wish_score) if wish_score is not None else None,
        wish_explanation=data.get("wish_explanation"),
        language_required=data.get("language_required"),
        provider=provider,
    )


@dataclass
class ProfileData:
    """Plain snapshot of a Profile DB row \u2014 safe to use after the session closes."""
    name: str
    cv_text: str
    wish_description: Optional[str]
    search_keywords: list[str]
    scoring_keywords: Optional[list]
    cv_text_hash: Optional[str]


def load_profile(name: str) -> ProfileData:
    """Load a search profile (CV + wish description + keyword caches) from the DB."""
    from db.models import Profile
    from db.session import get_session

    if not name:
        raise FileNotFoundError("No profile specified. Create/select a profile in the Profiles tab.")

    with get_session() as session:
        row = session.query(Profile).filter(Profile.name == name).first()
        if not row:
            raise FileNotFoundError(f"Profile '{name}' not found. Create it in the Profiles tab.")
        return ProfileData(
            name=row.name,
            cv_text=row.cv_text,
            wish_description=row.wish_description,
            search_keywords=list(row.search_keywords or []),
            scoring_keywords=row.scoring_keywords,
            cv_text_hash=row.cv_text_hash,
        )


def load_cv_text(direction: Optional[str] = None) -> str:
    """Back-compat shim: return just the CV text of a profile by name."""
    return load_profile(direction).cv_text

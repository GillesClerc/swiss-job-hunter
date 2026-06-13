"""
CV tailoring — compare a job description against the candidate's CV and produce:
  1. Specific bullet-point rewrite suggestions (with reason)
  2. A full ATS-optimised plain-text version of the CV
"""
from __future__ import annotations

import json
import re

from db.models import Job
from llm.router import call_llm


async def tailor_cv(job: Job, cv_text: str) -> dict:
    """
    Returns:
    {
      "missing_keywords": ["kw1", ...],
      "suggestions": [
        {"section": "...", "original": "...", "rewrite": "...", "reason": "..."},
        ...
      ],
      "ats_cv": "full plain-text ATS-optimised CV"
    }
    """
    system = (
        "You are an expert technical resume coach specialising in ATS optimisation "
        "for Swiss tech and engineering jobs. You give concrete, actionable rewrites — "
        "not vague advice. Respond only with valid JSON."
    )

    user = f"""Tailor the candidate's CV for the job below.

## Job: {job.title} at {job.company}
{job.description[:4000]}

## Candidate CV
{cv_text[:4000]}

Return ONLY valid JSON (no markdown fences):
{{
  "missing_keywords": ["keyword from JD that is absent from CV but candidate likely has"],
  "suggestions": [
    {{
      "section": "which CV section / experience entry (e.g. 'Experience — Motovis 2021-2024')",
      "original": "exact original bullet or phrase from the CV",
      "rewrite": "improved version that naturally incorporates missing JD keywords",
      "reason": "which JD requirement this addresses"
    }}
  ],
  "ats_cv": "Complete rewritten CV in plain text, ATS-friendly, incorporating all suggestions. Keep all factual content accurate — only rephrase to match JD language."
}}

Rules:
- suggestions: 3-6 most impactful changes only
- Do NOT invent experience or skills the candidate doesn't have
- ats_cv must be complete (all sections), not just the changed parts
- Use plain text only in ats_cv — no markdown, no bullet symbols beyond hyphens"""

    raw, provider = await call_llm(user=user, system=system, max_tokens=3000)
    print(f"[cv_tailor] generated via {provider}")

    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return {"error": f"LLM returned unparseable response: {raw[:200]}"}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "raw": raw[:500]}

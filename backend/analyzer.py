"""TOS Analyzer Module
Core analysis logic using OpenAI to evaluate and summarize Terms of Service.

This module focuses on:
- Calibrated, diverse scoring
- Specific, clause-based overview bullets
- Structured data-sharing categories
- Concrete, real-world examples linked to actual clauses
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from openai import OpenAI


# ---- OpenAI client & model configuration ------------------------------------

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    """Return a singleton OpenAI client instance."""
    global _client
    if _client is None:
        _client = OpenAI()
    return _client


# Fixed default model (will be overridden by app.py if needed)
DEFAULT_MODEL = "gpt-4o-mini"


# ---- System prompt -----------------------------------------------------------

SYSTEM_PROMPT = """You are a legal expert specializing in consumer-facing Terms of Service (TOS) and privacy policies.

Your job is to:
- Analyze a single TOS document.
- Help non-lawyers understand what it means in practice.
- Assign calibrated numerical scores that reflect how user-friendly or risky the TOS is.

General requirements:
- Respond ONLY with valid JSON that matches the schema described in the user message.
- Use clear, plain language at about an 8th-grade reading level.
- Be concise but specific. Do not invent rights or practices that are not supported by the text.
- If something is not mentioned, say "not mentioned" rather than guessing.

SCORING (the "scores" object):
- For each score (dataCollection, thirdPartySharing, userControl, termFairness), use a value from 0.0 to 1.0, where higher is better for users.
- Use the full range with these anchors:
  - 0.8-1.0: very user-friendly / privacy-friendly, close to best practice.
  - 0.6-0.79: above average; some issues but mostly reasonable.
  - 0.4-0.59: mixed / typical; meaningful concerns.
  - 0.2-0.39: clearly unfavorable to users.
  - 0.0-0.19: extremely hostile to user interests or rights.
- Calibrate scores based on specific behaviors in the TOS:
  - dataCollection: kinds of data (identifiers, precise location, financial, behavior logs), breadth of collection, and necessity.
  - thirdPartySharing: whether data is shared or sold to advertisers, analytics, affiliates, data brokers, law enforcement, and under what limits.
  - userControl: how easy it is for users to access, correct, delete, export, or opt out; whether they can really leave and take or erase their data.
  - termFairness: balance of rights and obligations, ability to change terms, disclaimers of liability, arbitration / class-action waivers, and termination rules.
- Avoid giving all four scores the same value unless the TOS really treats each area the same.
- If the TOS is silent on a dimension, err on the side of risk (e.g., 0.3-0.4) instead of 0.5 "neutral".

RISK LEVEL:
- "riskLevel" should roughly match the combination of scores:
  - "low": most scores ≥ 0.7 and no major red flags.
  - "medium": mixed scores or some important concerns.
  - "high": one or more dimensions clearly unfavorable (≤ 0.4) or serious rights limitations.
- In "explanation", give 1-2 sentences explaining the main reasons for the chosen risk level.

OVERVIEW (layered, scannable summary):
- Provide 3-5 bullets that highlight what users most need to know.
- Each bullet should:
  - Start with a short topic label like "Data & tracking:", "Your rights:", "Disputes:", "Account & content:".
  - Describe a specific behavior or rule, based on the actual TOS, in 1-2 sentences.
  - Avoid vague statements that could apply to any website.
- Cover different themes, for example:
  - What data is collected and how it is used.
  - What control users have over their data and account.
  - How content, licenses, and takedowns work.
  - How disputes are resolved, including arbitration and class-action waivers.
  - When and how the service can suspend or terminate accounts.

RISKS:
- List the most important concrete risks for users.
- For each risk:
  - "title": 3-6 words capturing the issue (e.g., "Data shared with advertisers").
  - "severity": "high", "medium", or "low", reflecting potential impact on users.
  - "description": 1-2 sentences explaining what the TOS allows.
  - "example": one realistic scenario where a user is affected because of this clause.
- Focus on risks that are clearly supported by the TOS text (data use, data sharing, one-sided terms, limits on liability, arbitration, termination, etc.).

DATA SHARING ("dataSharing"):
- "collected": list specific types of personal data mentioned (e.g., "email address", "IP address", "device identifiers", "payment card details", "precise location", "search history"). If not mentioned, say "not mentioned".
- "internalUse": list main internal purposes for the data (e.g., "provide core service", "personalize content", "fraud prevention", "marketing"). Use short, plain phrases.
- "thirdParties": summarize sharing using these categories, only if the text supports or strongly implies them:
  - "Service providers" (hosting, cloud, IT, customer support).
  - "Analytics & measurement" (analytics tools, performance monitoring, A/B testing).
  - "Advertising & marketing partners" (ad networks, retargeting, cross-site tracking).
  - "Social media & single sign-on" (social login, social widgets).
  - "Affiliates & business partners" (group companies, joint ventures, co-branded services).
  - "Government & law enforcement" (courts, regulators, legal requests).
  - "Data brokers or resellers" (entities that buy or resell user data).
  - "Public or other users" (if user content or profiles can be public).
- For each category you include, provide a short explanation of what is shared and why, in plain language.
- If the TOS states that it does NOT do something (e.g., "we do not sell your data"), say that clearly.
- If the TOS is silent about sharing with a category, do not list that category.

REAL-WORLD EXAMPLES ("examples"):
- Provide 3-5 short scenarios.
- For each:
  - Describe what a typical user does.
  - Describe what the company is allowed to do under the TOS.
  - Show how a specific clause affects the user in that situation.
- Cover different types of impact, for example:
  - A user stops using the app but their data or profile remains stored or visible.
  - A user's data is used for targeted ads or shared with partners.
  - A user loses access to purchased content or an account is suspended.
  - A user must use arbitration and cannot join a class-action lawsuit.
- Keep examples realistic, neutral, and clearly tied to the TOS; do not exaggerate or speculate beyond the text.

Always base your analysis strictly on the provided TOS text and URL. If important information is missing or unclear, say so explicitly in your JSON output.
"""


# ---- Prompt construction -----------------------------------------------------


def create_analysis_prompt(tos_text: str, url: Optional[str] = None) -> str:
    """Build the user prompt that describes the expected JSON schema and
    includes the TOS text.

    This keeps the model's output structured and aligned with the frontend.
    """
    url_info = f"URL: {url}\n\n" if url else ""

    schema_description = f"""Analyze the following Terms of Service and return a JSON object with this exact structure:

{{
  "overview": [
    "Data & tracking: ...",
    "Your rights: ...",
    "Disputes: ..."
  ],
  "risks": [
    {{
      "title": "Short risk title",
      "severity": "low" | "medium" | "high",
      "description": "1-2 sentence explanation of the risk.",
      "example": "Concrete scenario showing how a user is affected."
    }}
  ],
  "dataSharing": {{
    "collected": ["type of data", "..."],
    "internalUse": ["purpose", "..."],
    "thirdParties": [
      {{
        "category": "Service providers | Analytics & measurement | Advertising & marketing partners | Social media & single sign-on | Affiliates & business partners | Government & law enforcement | Data brokers or resellers | Public or other users",
        "details": "Short explanation of what is shared and why."
      }}
    ]
  }},
  "examples": [
    "Short real-world scenario 1",
    "Short real-world scenario 2"
  ],
  "scores": {{
    "dataCollection": 0.0,
    "thirdPartySharing": 0.0,
    "userControl": 0.0,
    "termFairness": 0.0
  }},
  "riskLevel": "low" | "medium" | "high",
  "explanation": "1-2 sentence explanation of the overall risk level"
}}

Rules:
- Respond with JSON ONLY. Do not include any commentary, markdown, or backticks.
- Fill all required keys. If something is not mentioned in the TOS, write "not mentioned" or an empty list as appropriate.
- Make the overview and risks as specific and clause-based as possible, grounded in the actual text.
- Keep language plain and easy to scan on a mobile screen.

{url_info}TOS TEXT:
{tos_text}
"""

    return schema_description


# ---- Scoring helpers ---------------------------------------------------------


def _safe_get_score(scores: Dict[str, Any], key: str, default: float = 0.4) -> float:
    """Get a score from the model response, with sanity checks and defaults.

    - Ensures the value is a float between 0.0 and 1.0.
    - If missing or invalid, returns the provided default (slightly risk-leaning).
    """
    try:
        value = float(scores.get(key, default))
    except (TypeError, ValueError):
        value = default

    if value < 0.0:
        value = 0.0
    if value > 1.0:
        value = 1.0
    return value


def compute_overall_trust_score(scores: Dict[str, Any]) -> Dict[str, Any]:
    """Compute the overall 0-100 trust score and 0-100 breakdown.

    Returns a dict with:
    - overallTrustScore: int
    - scoreBreakdown: dict of dimension -> int
    """
    dc = _safe_get_score(scores, "dataCollection")
    tps = _safe_get_score(scores, "thirdPartySharing")
    uc = _safe_get_score(scores, "userControl")
    tf = _safe_get_score(scores, "termFairness")

    avg = (dc + tps + uc + tf) / 4.0
    overall = round(avg * 100)

    breakdown = {
        "dataCollection": round(dc * 100),
        "thirdPartySharing": round(tps * 100),
        "userControl": round(uc * 100),
        "termFairness": round(tf * 100),
    }

    return {
        "overallTrustScore": overall,
        "scoreBreakdown": breakdown,
    }


def generate_score_explanation(scores: Dict[str, Any], risk_level: str) -> str:
    """Generate a human-readable explanation for the trust score.

    This looks at which dimensions are weakest and summarizes them.
    """
    dc = _safe_get_score(scores, "dataCollection")
    tps = _safe_get_score(scores, "thirdPartySharing")
    uc = _safe_get_score(scores, "userControl")
    tf = _safe_get_score(scores, "termFairness")

    # Pair each dimension with a label and score
    dims = [
        ("data collection", dc),
        ("third-party sharing", tps),
        ("user control", uc),
        ("term fairness", tf),
    ]
    # Sort ascending to find weakest areas
    dims.sort(key=lambda x: x[1])

    weakest = [name for name, _ in dims[:2]]
    strongest = [name for name, _ in dims[-2:]]

    parts: List[str] = []

    if weakest:
        parts.append("Biggest concerns are about " + " and ".join(weakest) + ".")
    if strongest:
        parts.append("Stronger areas include " + " and ".join(strongest) + ".")

    risk_phrase = {
        "low": "Overall risk appears relatively low compared to typical online services.",
        "medium": "Overall risk is moderate: some terms are reasonable, but there are important trade-offs.",
        "high": "Overall risk is high: several terms significantly favor the company over users.",
    }.get(risk_level.lower(), "Overall risk is mixed.")

    parts.append(risk_phrase)

    return " ".join(parts)


# ---- Main analysis function --------------------------------------------------


def analyze_tos(
    tos_text: str,
    url: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Analyze a TOS document using the OpenAI API.

    Parameters
    ----------
    tos_text : str
        The raw TOS content extracted from the webpage.
    url : str | None
        The URL of the page (optional but helpful context for the model).
    model : str | None
        Optional model override. Defaults to a fixed model constant if not set.

    Returns
    -------
    dict
        A structured analysis containing:
        - overview
        - risks
        - dataSharing
        - examples
        - scores (0.0-1.0)
        - riskLevel
        - explanation (from the model)
        - overallTrustScore (0-100)
        - scoreBreakdown (per dimension 0-100)
        - scoreExplanation (human-readable summary of scoring)
    """
    if not tos_text or not tos_text.strip():
        raise ValueError("tos_text is empty; nothing to analyze.")

    client = get_client()
    model_name = model or DEFAULT_MODEL

    user_prompt = create_analysis_prompt(tos_text, url)

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=1500,
    )

    raw_content = response.choices[0].message.content or ""

    # Some models occasionally wrap JSON in markdown fences; strip if present.
    trimmed = raw_content.strip()
    if trimmed.startswith("```"):
        # Remove first fence
        trimmed = trimmed.lstrip("`")
        # Remove language tag if present
        if "\n" in trimmed:
            trimmed = trimmed.split("\n", 1)[1]
        # Remove trailing fence
        if "```" in trimmed:
            trimmed = trimmed.rsplit("```", 1)[0]

    try:
        model_json = json.loads(trimmed)
    except json.JSONDecodeError as e:
        # For debugging; in production you might want to log this.
        raise ValueError(f"Model did not return valid JSON: {e}: {trimmed[:200]}") from e

    # Make sure required top-level keys exist with sensible defaults
    overview = model_json.get("overview") or []
    risks = model_json.get("risks") or []
    data_sharing = model_json.get("dataSharing") or {
        "collected": [],
        "internalUse": [],
        "thirdParties": [],
    }
    examples = model_json.get("examples") or []
    scores = model_json.get("scores") or {}
    risk_level = str(model_json.get("riskLevel", "medium")).lower()
    explanation = model_json.get("explanation") or ""

    # Compute overall trust score and breakdown
    score_info = compute_overall_trust_score(scores)
    overall_score = score_info["overallTrustScore"]
    breakdown = score_info["scoreBreakdown"]
    score_explanation = generate_score_explanation(scores, risk_level)

    # Prepare compatibility fields for extension
    # The extension expects overallScore (legacy) and certain dataSharing fields
    
    # Extract thirdParties for backwards compatibility
    third_parties_list = []
    third_parties_objects = data_sharing.get("thirdParties", [])
    
    # Handle both old format (array of strings) and new format (array of objects)
    if third_parties_objects and isinstance(third_parties_objects, list):
        if len(third_parties_objects) > 0 and isinstance(third_parties_objects[0], dict):
            # New format: extract categories for simple display
            third_parties_list = [tp.get("category", "Unknown") for tp in third_parties_objects]
        else:
            # Old format: already strings
            third_parties_list = third_parties_objects
    
    # Add legacy fields for extension compatibility
    data_sharing_compat = {
        "collected": data_sharing.get("collected", []),
        "internalUse": data_sharing.get("internalUse", []),
        "thirdParties": third_parties_list,  # Simple list for legacy UI
        "thirdPartiesDetailed": third_parties_objects,  # Detailed format for new UI
        "retention": data_sharing.get("retention", "Not mentioned"),
        "userControls": data_sharing.get("userControls", "Not mentioned"),
    }
    
    analysis: Dict[str, Any] = {
        "overview": overview,
        "risks": risks,
        "dataSharing": data_sharing_compat,
        "examples": examples,
        "scores": scores,
        "riskLevel": risk_level,
        "explanation": explanation,
        "overallTrustScore": overall_score,
        "overallScore": overall_score,  # Legacy field for extension compatibility
        "scoreBreakdown": breakdown,
        "scoreExplanation": score_explanation,
    }

    # Optional: print to server logs for debugging
    print(
        f"[TOS ANALYZER] URL={url or 'N/A'} score={overall_score} risk={risk_level} "
        f"breakdown={breakdown}"
    )

    return analysis

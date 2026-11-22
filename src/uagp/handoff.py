"""Portable UAGP civic handoff and a public-only research catalogue.

A handoff is data prepared by a citizen's own AI app, not a submitted
petition or an administrative act. Never include user credentials or secrets.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from pydantic import BaseModel, ConfigDict, Field

HANDOFF_VERSION = "uagp.civic.handoff.v1"
CATEGORY = Literal["transport", "energy", "services", "other"]
SCOPE = Literal["community", "intercommunity", "krai_concept", "national"]
KIND = Literal[
    "policy_idea", "citizen_appeal", "information_request",
    "petition", "administrative_application", "other"
]


class CivicHandoff(BaseModel):
    """Machine-readable interchange without an identity or publication consent."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    version: Literal["uagp.civic.handoff.v1"] = HANDOFF_VERSION
    category: CATEGORY
    scope: SCOPE
    problem: str = Field(min_length=10, max_length=2000)
    desired_outcome: str = Field(min_length=10, max_length=2000)
    proposed_solution: str | None = Field(default=None, max_length=2000)
    legal_kind: KIND = "policy_idea"


def prepare_handoff(
    category: CATEGORY, scope: SCOPE, problem: str,
    desired_outcome: str, proposed_solution: str | None = None,
    legal_kind: KIND = "policy_idea",
) -> dict:
    """Validate and return an artifact only. No data is sent or stored."""

    handoff = CivicHandoff(
        category=category, scope=scope, problem=problem,
        desired_outcome=desired_outcome,
        proposed_solution=proposed_solution, legal_kind=legal_kind,
    )
    return {
        "handoff": handoff.model_dump(mode="json"),
        "submitted": False,
        "publication_requested": False,
        "review_required": True,
        "next_step": (
            "Відкрийте локальний портал UAGP (/ui), імпортуйте JSON, "
            "перевірте зміст і окремо підтвердьте тестове подання."
        ),
    }


def public_catalog(
    db_path: str | None, category: str = "all", limit: int = 12
) -> dict:
    """Return allowlisted public demo fields, never a full database row."""

    if category not in ("all", "transport", "energy", "services", "other"):
        raise ValueError("Unknown public category")
    if not isinstance(limit, int) or not 1 <= limit <= 30:
        raise ValueError("Limit must be between 1 and 30")
    if not db_path or not Path(db_path).is_file():
        return {"items": [], "sandbox": True, "reason": "no_local_catalog"}

    db_url = "file:" + quote(str(Path(db_path).resolve()), safe="/") + "?mode=ro"
    sql = (
        "SELECT case_id, category, scope, public_summary "
        "FROM civic_drafts WHERE published=1 AND legal_kind='policy_idea' "
    )
    params: tuple = ()
    if category != "all":
        sql += "AND category=? "
        params = (category,)
    sql += "ORDER BY updated_at DESC LIMIT ?"
    try:
        with sqlite3.connect(db_url, uri=True, timeout=2.0) as db:
            db.row_factory = sqlite3.Row
            results = db.execute(sql, (*params, limit)).fetchall()
    except sqlite3.DatabaseError:
        return {"items": [], "sandbox": True, "reason": "catalog_not_ready"}
    return {
        "items": [
            {
                "case_id": row["case_id"],
                "category": row["category"],
                "scope": row["scope"],
                "public_summary": row["public_summary"],
                "status": "demo_published",
                "sandbox": True,
            }
            for row in results
        ],
        "sandbox": True,
        "count": len(results),
    }

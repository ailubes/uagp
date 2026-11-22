"""UAGP Civic Participation Protocol v0.2, fictional two-node sandbox.

Human review is simulated. No request is filed with a real authority.
The LLM is NOT involved in authentication, approval, publication or state changes.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from .models import Category
from .policy import canonical_json
from .settings import Settings

Scope = Literal["community", "intercommunity", "krai_concept", "national"]
LegalKind = Literal[
    "policy_idea", "citizen_appeal", "information_request",
    "petition", "administrative_application", "other",
]


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CivicStart(StrictInput):
    category: Category
    scope: Scope
    problem: str = Field(min_length=10, max_length=2000)


class CivicClarification(StrictInput):
    desired_outcome: str = Field(min_length=10, max_length=2000)
    proposed_solution: str | None = Field(default=None, max_length=2000)
    legal_kind: LegalKind


class CivicConfirmation(StrictInput):
    preview_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    request_publication: bool = False
    public_summary: str | None = Field(default=None, max_length=600)
    share_federated_category: bool = False


class CivicDecision(StrictInput):
    verdict: Literal["accept_demo", "reject_demo", "request_clarification"]
    reason: str = Field(min_length=12, max_length=800)


class CivicAppeal(StrictInput):
    reason: str = Field(min_length=12, max_length=800)


class CivicAppealDecision(StrictInput):
    verdict: Literal["uphold_demo", "deny_demo"]
    reason: str = Field(min_length=12, max_length=800)


class CivicOutcome(StrictInput):
    observation: str = Field(min_length=20, max_length=800)
    evidence_reference: str | None = Field(default=None, max_length=350)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


class CivicStore:
    """Single-node SQLite, transactional transitions, metadata-only hash chain."""

    def __init__(self, database_path: str) -> None:
        self.database_path = database_path
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        with self.db(write=True) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS civic_drafts (
                    id TEXT PRIMARY KEY,
                    case_id TEXT UNIQUE,
                    author_key_hash TEXT NOT NULL,
                    category TEXT NOT NULL,
                    scope TEXT NOT NULL,
                    private_problem TEXT NOT NULL,
                    desired_outcome TEXT,
                    proposed_solution TEXT,
                    legal_kind TEXT,
                    status TEXT NOT NULL DEFAULT 'draft',
                    request_publication INTEGER NOT NULL DEFAULT 0,
                    public_summary TEXT,
                    share_federated_category INTEGER NOT NULL DEFAULT 0,
                    published INTEGER NOT NULL DEFAULT 0,
                    decision_reason TEXT,
                    outcome_observation TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS civic_audit (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    draft_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    actor_role TEXT NOT NULL,
                    from_status TEXT,
                    to_status TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    event_hash TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS civic_audit_by_draft
                ON civic_audit(draft_id, seq);
                """
            )

    @contextmanager
    def db(self, write: bool = False) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.database_path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            if write:
                conn.execute("BEGIN IMMEDIATE")
            yield conn
            if write:
                conn.commit()
        except Exception:
            if write:
                conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def key_hash(key: str) -> str:
        return hashlib.sha256(key.encode("utf-8")).hexdigest()

    @staticmethod
    def find(conn: sqlite3.Connection, field: str, value: str):
        if field not in {"id", "case_id"}:
            raise ValueError("Disallowed lookup key")
        return conn.execute(
            f"SELECT * FROM civic_drafts WHERE {field} = ?", (value,)
        ).fetchone()

    def audit(
        self, conn: sqlite3.Connection, row, event_type: str,
        actor_role: str, to_status: str
    ) -> None:
        previous = conn.execute(
            "SELECT event_hash FROM civic_audit WHERE draft_id=? ORDER BY seq DESC LIMIT 1",
            (row["id"],),
        ).fetchone()
        prev_hash = previous["event_hash"] if previous else "0" * 64
        metadata = {
            "draft_id": row["id"],
            "event_type": event_type,
            "actor_role": actor_role,
            "from_status": row["status"],
            "to_status": to_status,
            "occurred_at": now_utc(),
        }
        chain = hashlib.sha256(
            prev_hash.encode("ascii") + canonical_json(metadata)
        ).hexdigest()
        conn.execute(
            """INSERT INTO civic_audit
            (draft_id,event_type,actor_role,from_status,to_status,occurred_at,prev_hash,event_hash)
            VALUES (?,?,?,?,?,?,?,?)""",
            (row["id"], event_type, actor_role, row["status"], to_status,
             metadata["occurred_at"], prev_hash, chain),
        )

    def start(self, body: CivicStart) -> tuple[str, str]:
        draft_id, author_key = str(uuid4()), secrets.token_urlsafe(32)
        with self.db(write=True) as conn:
            when = now_utc()
            conn.execute(
                """INSERT INTO civic_drafts
                (id, author_key_hash, category, scope, private_problem, status, created_at, updated_at)
                VALUES (?,?,?,?,?,'draft',?,?)""",
                (draft_id, self.key_hash(author_key), body.category,
                 body.scope, body.problem, when, when),
            )
            row = self.find(conn, "id", draft_id)
            self.audit(conn, row, "draft_created", "demo_operator", "draft")
        return draft_id, author_key

    def authorized(self, conn: sqlite3.Connection, field: str,
                   record_id: str, author_key: str | None):
        row = self.find(conn, field, record_id)
        if row is None or not author_key:
            raise HTTPException(status_code=404, detail="Draft or case not found")
        if not hmac.compare_digest(
            row["author_key_hash"], self.key_hash(author_key)
        ):
            raise HTTPException(status_code=404, detail="Draft or case not found")
        return row

    def snapshot(self, row) -> dict:
        return {
            "category": row["category"],
            "scope": row["scope"],
            "problem_statement": row["private_problem"],
            "desired_outcome": row["desired_outcome"],
            "proposed_solution": row["proposed_solution"],
            "legal_kind": row["legal_kind"],
        }

    def preview(self, row) -> dict:
        document = self.snapshot(row)
        return {
            "draft_id": row["id"],
            "preview": document,
            "preview_fingerprint": hashlib.sha256(
                canonical_json(document)
            ).hexdigest(),
            "publication_is_separate": True,
            "official_submission": False,
            "demo_only": True,
        }

    def events(self, conn: sqlite3.Connection, draft_id: str) -> list[dict]:
        records = conn.execute(
            """SELECT event_type,actor_role,from_status,to_status,occurred_at,
            prev_hash,event_hash FROM civic_audit
            WHERE draft_id=? ORDER BY seq""",
            (draft_id,),
        ).fetchall()
        return [dict(record) for record in records]


def create_civic_router(settings: Settings) -> APIRouter:
    store = CivicStore(settings.db_path)
    router = APIRouter(prefix="/v1/civic", tags=["Civic sandbox"])

    def operator_only(
        token: str | None = Header(default=None, alias="X-Demo-Operator-Token")
    ) -> None:
        if not hmac.compare_digest(token or "", settings.operator_token):
            raise HTTPException(401, detail="Demo operator authorization required")

    def reviewer_only(
        token: str | None = Header(default=None, alias="X-Demo-Reviewer-Token")
    ) -> None:
        if not settings.reviewer_token:
            raise HTTPException(503, detail="Independent demo reviewer not configured")
        if not hmac.compare_digest(token or "", settings.reviewer_token):
            raise HTTPException(401, detail="Independent reviewer authorization required")

    @router.post("/drafts", status_code=status.HTTP_201_CREATED)
    def start_draft(
        payload: CivicStart, _: None = Depends(operator_only)
    ) -> dict:
        draft_id, key = store.start(payload)
        return {
            "draft_id": draft_id, "author_key": key, "status": "draft",
            "mode": "private_sandbox", "official_submission": False,
            "warning": "Author key is a demo capability. Protect it as a secret.",
        }

    @router.post("/drafts/{draft_id}/clarify")
    def clarify(
        draft_id: str, payload: CivicClarification,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.authorized(conn, "id", draft_id, author_key)
            if row["status"] not in ("draft", "clarified", "needs_clarification"):
                raise HTTPException(409, detail="Draft can no longer be changed")
            store.audit(conn, row, "author_clarified", "citizen", "clarified")
            conn.execute(
                """UPDATE civic_drafts SET desired_outcome=?, proposed_solution=?,
                legal_kind=?, status='clarified', updated_at=? WHERE id=?""",
                (payload.desired_outcome, payload.proposed_solution,
                 payload.legal_kind, now_utc(), draft_id),
            )
        return {"draft_id": draft_id, "status": "clarified"}

    @router.get("/drafts/{draft_id}/preview")
    def preview(
        draft_id: str,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        with store.db() as conn:
            row = store.authorized(conn, "id", draft_id, author_key)
            if row["status"] != "clarified":
                raise HTTPException(409, detail="Clarification required for preview")
            return store.preview(row)

    @router.post("/drafts/{draft_id}/confirm")
    def confirm(
        draft_id: str, payload: CivicConfirmation,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        if payload.request_publication:
            if not payload.public_summary or len(payload.public_summary.strip()) < 20:
                raise HTTPException(422, detail="Explicit public summary required")
            # Cheap early guard, NOT a substitute for human privacy review.
            import re
            if re.search(r"[\w.+-]+@[\w.-]+\.\w+|(?:\+?\d[\d ()-]{8,}\d)", payload.public_summary):
                raise HTTPException(422, detail="Public summary appears to contain contact details")
        elif payload.public_summary is not None:
            raise HTTPException(422, detail="Summary requires explicit publication opt-in")
        with store.db(write=True) as conn:
            row = store.authorized(conn, "id", draft_id, author_key)
            if row["status"] != "clarified":
                raise HTTPException(409, detail="Draft is not ready for confirmation")
            expected = store.preview(row)["preview_fingerprint"]
            if not hmac.compare_digest(payload.preview_fingerprint, expected):
                raise HTTPException(409, detail="Stale preview, review the latest draft")
            store.audit(conn, row, "author_confirmed", "citizen", "confirmed")
            conn.execute(
                """UPDATE civic_drafts SET status='confirmed',
                request_publication=?, public_summary=?, share_federated_category=?,
                updated_at=? WHERE id=?""",
                (int(payload.request_publication),
                 payload.public_summary.strip() if payload.public_summary else None,
                 int(payload.share_federated_category), now_utc(), draft_id),
            )
        return {
            "draft_id": draft_id, "status": "confirmed",
            "publicly_visible": False, "official_submission": False,
        }

    @router.post("/drafts/{draft_id}/submit")
    def submit(
        draft_id: str,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.authorized(conn, "id", draft_id, author_key)
            if row["status"] != "confirmed":
                raise HTTPException(409, detail="Confirmed draft required")
            case_id = str(uuid4())
            store.audit(conn, row, "sandbox_submitted", "citizen", "submitted_demo")
            conn.execute(
                """UPDATE civic_drafts SET status='submitted_demo', case_id=?,
                updated_at=? WHERE id=?""", (case_id, now_utc(), draft_id),
            )
            routing = (
                "demo_policy_review"
                if row["legal_kind"] == "policy_idea"
                else "real_official_channel_required"
            )
            if row["scope"] in ("krai_concept", "national"):
                routing = "human_competence_check_required"
        return {
            "case_id": case_id, "status": "submitted_demo", "routing": routing,
            "legal_effect": "none", "registered_with_authority": False,
        }

    @router.get("/cases/{case_id}")
    def case_details(
        case_id: str,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        with store.db() as conn:
            row = store.authorized(conn, "case_id", case_id, author_key)
            return {
                "case_id": case_id,
                "status": row["status"],
                "private_preview": store.snapshot(row),
                "publication_requested": bool(row["request_publication"]),
                "published": bool(row["published"]),
                "decision_reason": row["decision_reason"],
                "outcome_observation": row["outcome_observation"],
                "events": store.events(conn, row["id"]),
                "official_submission": False,
            }

    @router.post("/cases/{case_id}/review")
    def demo_review(
        case_id: str, payload: CivicDecision,
        _: None = Depends(operator_only),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.find(conn, "case_id", case_id)
            if row is None:
                raise HTTPException(404, detail="Unknown sandbox case")
            if row["status"] != "submitted_demo":
                raise HTTPException(409, detail="Review not available in current state")
            if (payload.verdict == "accept_demo" and
                    row["legal_kind"] != "policy_idea"):
                raise HTTPException(409, detail="Cannot approve a formal legal route in sandbox")
            new_status = {
                "accept_demo": "accepted_demo",
                "reject_demo": "rejected_demo",
                "request_clarification": "needs_clarification",
            }[payload.verdict]
            store.audit(conn, row, "operator_reviewed", "demo_operator", new_status)
            conn.execute(
                """UPDATE civic_drafts SET status=?, decision_reason=?,
                updated_at=? WHERE case_id=?""",
                (new_status, payload.reason, now_utc(), case_id),
            )
        return {
            "case_id": case_id, "status": new_status,
            "legal_effect": "none", "published": False,
        }

    @router.post("/cases/{case_id}/appeal")
    def appeal(
        case_id: str, body: CivicAppeal,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.authorized(conn, "case_id", case_id, author_key)
            if row["status"] != "rejected_demo":
                raise HTTPException(409, detail="Only rejected demo cases can be appealed")
            # Do not store private appeal free text in the hash-chain metadata.
            store.audit(conn, row, "author_appealed", "citizen", "appealed_demo")
            conn.execute(
                """UPDATE civic_drafts SET status='appealed_demo',
                decision_reason=?, updated_at=? WHERE case_id=?""",
                (body.reason, now_utc(), case_id),
            )
        return {"case_id": case_id, "status": "appealed_demo", "legal_effect": "none"}

    @router.post("/cases/{case_id}/appeal-decision")
    def decide_appeal(
        case_id: str, payload: CivicAppealDecision,
        _: None = Depends(reviewer_only),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.find(conn, "case_id", case_id)
            if row is None:
                raise HTTPException(404, detail="Unknown sandbox case")
            if row["status"] != "appealed_demo":
                raise HTTPException(409, detail="No pending appeal")
            final_status = (
                "accepted_demo" if payload.verdict == "uphold_demo"
                else "appeal_denied_demo"
            )
            # A legal route cannot become "accepted" through the demo appeal path.
            if final_status == "accepted_demo" and row["legal_kind"] != "policy_idea":
                raise HTTPException(409, detail="Formal legal routes require external authority")
            store.audit(conn, row, "independent_appeal_review", "demo_reviewer", final_status)
            conn.execute(
                """UPDATE civic_drafts SET status=?, decision_reason=?, updated_at=?
                WHERE case_id=?""",
                (final_status, payload.reason, now_utc(), case_id),
            )
        return {"case_id": case_id, "status": final_status, "legal_effect": "none"}

    @router.post("/cases/{case_id}/publish")
    def publish(
        case_id: str, _: None = Depends(reviewer_only)
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.find(conn, "case_id", case_id)
            if row is None:
                raise HTTPException(404, detail="Unknown sandbox case")
            if row["status"] not in ("accepted_demo", "outcome_recorded_demo"):
                raise HTTPException(409, detail="Human policy review required")
            if not row["request_publication"] or not row["public_summary"]:
                raise HTTPException(409, detail="No explicit author publication request")
            if row["legal_kind"] != "policy_idea":
                raise HTTPException(409, detail="Only civic policy ideas can be published here")
            if row["published"]:
                raise HTTPException(409, detail="Already published")
            store.audit(conn, row, "reviewer_published", "demo_reviewer", row["status"])
            conn.execute(
                "UPDATE civic_drafts SET published=1, updated_at=? WHERE case_id=?",
                (now_utc(), case_id),
            )
        return {"case_id": case_id, "published": True, "sandbox": True}

    @router.post("/cases/{case_id}/unpublish")
    def unpublish(
        case_id: str,
        author_key: str | None = Header(default=None, alias="X-UAGP-Author-Key"),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.authorized(conn, "case_id", case_id, author_key)
            if not row["published"]:
                raise HTTPException(409, detail="Not currently published")
            store.audit(conn, row, "author_unpublished", "citizen", row["status"])
            conn.execute(
                """UPDATE civic_drafts SET published=0, request_publication=0,
                updated_at=? WHERE case_id=?""", (now_utc(), case_id),
            )
        return {"case_id": case_id, "published": False,
                "warning": "Prior copies outside this sandbox cannot be recalled"}

    @router.get("/public/{case_id}")
    def public_card(case_id: str) -> dict:
        with store.db() as conn:
            row = store.find(conn, "case_id", case_id)
            if not row or not row["published"]:
                raise HTTPException(404, detail="No public sandbox record")
            # Critical allowlist. Never serialize the internal SQLite row here.
            return {
                "case_id": case_id,
                "category": row["category"],
                "scope": row["scope"],
                "public_summary": row["public_summary"],
                "status": "demo_published",
                "sandbox": True,
            }

    @router.post("/cases/{case_id}/outcome")
    def outcome(
        case_id: str, body: CivicOutcome,
        _: None = Depends(operator_only),
    ) -> dict:
        with store.db(write=True) as conn:
            row = store.find(conn, "case_id", case_id)
            if row is None:
                raise HTTPException(404, detail="Unknown sandbox case")
            if row["status"] != "accepted_demo":
                raise HTTPException(409, detail="Only accepted demo idea can have an outcome")
            store.audit(conn, row, "demo_outcome_recorded", "demo_operator",
                        "outcome_recorded_demo")
            conn.execute(
                """UPDATE civic_drafts SET status='outcome_recorded_demo',
                outcome_observation=?, updated_at=? WHERE case_id=?""",
                (body.observation, now_utc(), case_id),
            )
        return {"case_id": case_id, "status": "outcome_recorded_demo",
                "evidence_reference": body.evidence_reference, "legal_effect": "none"}

    return router

"""BYOAI handoff contract, public-only catalogue and optional frontend."""

import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from uagp.app import create_app
from uagp.handoff import CivicHandoff, prepare_handoff, public_catalog
from uagp.settings import Settings


def test_handoff_is_portable_and_never_submits():
    result = prepare_handoff(
        category="transport",
        scope="intercommunity",
        problem="Автобус не встигає на електричку кожного ранку.",
        desired_outcome="Зменшити очікування пересадки для всіх пасажирів.",
        proposed_solution="Узгодити розклади перевізників.",
    )
    assert result["handoff"]["version"] == "uagp.civic.handoff.v1"
    assert result["submitted"] is False
    assert result["publication_requested"] is False
    assert result["review_required"] is True
    assert "author_key" not in str(result)
    assert "api_key" not in str(result)


@pytest.mark.parametrize("invalid", [
    {"category": "unknown"},
    {"scope": "sovereign-state"},
    {"problem": "short"},
    {"legal_kind": "automatic_law_change"},
])
def test_handoff_rejects_unknown_or_malformed_inputs(invalid):
    data = {
        "category": "transport",
        "scope": "community",
        "problem": "Автобус запізнюється на прибуття поїзда.",
        "desired_outcome": "Скоротити час очікування пасажирів.",
        **invalid,
    }
    with pytest.raises((ValidationError, ValueError)):
        CivicHandoff(**data)


def test_handoff_rejects_identity_fields():
    with pytest.raises(ValidationError):
        CivicHandoff(
            category="transport", scope="community",
            problem="Автобус не прибуває до станції вчасно.",
            desired_outcome="Поліпшити пересадку для людей.",
            passport_number="do-not-transfer",
        )


def create_test_client(tmp_path):
    return TestClient(create_app(Settings(
        node_id="portal-a",peer_id="portal-b",
        db_path=str(tmp_path/"node.db"),
        operator_token="demo-operator-secret",
        reviewer_token="demo-reviewer-secret",
        shared_key="demo-shared-signing-secret",
        policy_signing_key="demo-policy-signing-secret",
    )))


def test_portal_is_served_same_origin_with_explicit_sandbox_label(tmp_path, monkeypatch):
    for v in ("UAGP_AI_BASE_URL", "UAGP_AI_MODEL", "UAGP_AI_API_KEY"):
        monkeypatch.delenv(v, raising=False)
    c = create_test_client(tmp_path)
    r = c.get("/ui")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Громадянський простір" in r.text
    assert "Дослідницький прототип" in r.text
    assert "Мій AI / MCP" in r.text
    assert "Content-Security-Policy" in r.headers
    assert "no-store" in r.headers["Cache-Control"]


def test_public_catalog_does_not_expose_private_drafts(tmp_path, monkeypatch):
    for v in ("UAGP_AI_BASE_URL", "UAGP_AI_MODEL", "UAGP_AI_API_KEY"):
        monkeypatch.delenv(v, raising=False)
    c = create_test_client(tmp_path)
    body = {
        "category": "transport", "scope": "community",
        "problem": "Private phone 111 222 333 444 must not be public"
    }
    r = c.post("/v1/civic/drafts",
               headers={"X-Demo-Operator-Token":"demo-operator-secret"}, json=body)
    assert r.status_code == 201
    response = c.get("/v1/public/proposals")
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert "Private phone" not in response.text
    assert c.get("/v1/public/proposals?category=unknown").status_code == 422


def test_public_catalog_only_allowlisted_fields(tmp_path):
    import sqlite3

    path = str(tmp_path / "node.db")
    c = create_test_client(tmp_path)
    with sqlite3.connect(path) as db:
        db.execute(
            """INSERT INTO civic_drafts
               (id,case_id,author_key_hash,category,scope,private_problem,
                desired_outcome,proposed_solution,legal_kind,status,
                request_publication,public_summary,published,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                "private-id", "public-case-id", "private-hash",
                "transport", "community",
                "Hidden address and sensitive text must not appear.",
                "Improve connectivity", "Private secret alternative", "policy_idea",
                "accepted_demo", 1,
                "Improve bus and train connectivity across the community.",
                1, "2026-11-22", "2026-11-22",
            ),
        )
        db.commit()
    r = c.get("/v1/public/proposals")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert set(items[0]) == {
        "case_id", "category", "scope", "public_summary", "status", "sandbox"
    }
    assert "Hidden address" not in r.text
    assert "private-hash" not in r.text
    assert "Private secret" not in r.text


def test_catalog_missing_database_is_empty(tmp_path):
    assert public_catalog(str(tmp_path / "no.db"))["items"] == []

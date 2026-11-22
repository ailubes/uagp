"""Citizen Assistant never changes civic case state or bypasses author controls."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from uagp.app import create_app
from uagp.assistant import (
    DraftSuggestion, ModelConfiguration, create_assistant_router
)
from uagp.settings import Settings


def test_settings(tmp_path):
    return Settings(
        node_id="assistant-a",
        peer_id="assistant-b",
        db_path=str(tmp_path / "assistant.db"),
        operator_token="demo-operator-secret",
        reviewer_token="demo-reviewer-secret",
        shared_key="demo-federation-signing-secret",
        policy_signing_key="demo-policy-signing-secret",
    )


def new_draft(c):
    created = c.post(
        "/v1/civic/drafts",
        headers={"X-Demo-Operator-Token": "demo-operator-secret"},
        json={
            "category": "transport",
            "scope": "intercommunity",
            "problem": "My bus does not connect with the local train.",
        },
    )
    assert created.status_code == 201
    data = created.json()
    return data["draft_id"], {"X-UAGP-Author-Key": data["author_key"]}


def respond(c, draft_id, headers, **kwargs):
    return c.post(
        f"/v1/assistant/drafts/{draft_id}/respond",
        headers=headers,
        json={"message": "Help me clarify the problem", **kwargs},
    )


def test_local_assistant_requires_author_key_and_does_not_save(tmp_path, monkeypatch):
    for key in ("UAGP_AI_BASE_URL", "UAGP_AI_MODEL", "UAGP_AI_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    c = TestClient(create_app(test_settings(tmp_path)))
    draft, headers = new_draft(c)
    assert respond(c, draft, {}).status_code == 404
    answer = respond(c, draft, headers)
    assert answer.status_code == 200
    payload = answer.json()
    assert payload["engine"] == "local_rules"
    assert payload["draft_unchanged"] is True
    assert payload["official_submission"] is False
    assert payload["external_processing"] is False
    assert payload["requires_author_confirmation"] is True
    assert payload["suggestion"]["clarification_questions"]
    preview = c.get(f"/v1/civic/drafts/{draft}/preview", headers=headers)
    assert preview.status_code == 409  # Still unclarified


def test_configured_model_requires_separate_explicit_consent(tmp_path, monkeypatch):
    for key in ("UAGP_AI_BASE_URL", "UAGP_AI_MODEL", "UAGP_AI_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    c = TestClient(create_app(test_settings(tmp_path)))
    draft, headers = new_draft(c)
    r = respond(c, draft, headers, use_model=True)
    assert r.status_code == 409
    r = respond(c, draft, headers, use_model=True, allow_external_processing=True)
    assert r.status_code == 503


def test_model_provider_contract_with_injected_adapter(tmp_path):
    s = test_settings(tmp_path)
    c = TestClient(create_app(s))
    draft, author = new_draft(c)

    class FakeProvider:
        calls = 0

        def generate(self, context, message, history):
            self.calls += 1
            assert "author_key" not in str(context)
            assert "case_id" not in str(context)
            assert "My bus does not connect" in context["problem_statement"]
            assert message == "Help me clarify the problem"
            return DraftSuggestion(
                assistant_message="Можемо уточнити місце і час виникнення проблеми.",
                clarification_questions=["На якій зупинці виникає проблема?"],
                proposed_desired_outcome=None,
                proposed_solution=None,
                procedure_hint="policy_idea",
                evidence_questions=["Чи є розклад або інші перевірні дані?"],
            )

    mock = FakeProvider()
    app = FastAPI()
    app.include_router(create_assistant_router(s, mock))
    assistant = TestClient(app)
    a = respond(assistant, draft, author, use_model=True, allow_external_processing=True)
    assert a.status_code == 200
    assert a.json()["engine"] == "configured_model"
    assert mock.calls == 1
    assert respond(assistant, draft, author, use_model=True).status_code == 409
    assert mock.calls == 1


def test_assistant_fails_closed_on_unstructured_or_mutating_output(tmp_path):
    s = test_settings(tmp_path)
    c = TestClient(create_app(s))
    draft, author = new_draft(c)

    class BadProvider:
        def generate(self, context, message, history):
            return {"assistant_message": "Submitted!", "clarification_questions": [],
                    "official_submission": True}

    app = FastAPI()
    app.include_router(create_assistant_router(s, BadProvider()))
    assistant = TestClient(app)
    response = respond(assistant, draft, author,
                       use_model=True, allow_external_processing=True)
    assert response.status_code == 502
    assert "Submitted" not in response.text
    assert c.get(f"/v1/civic/drafts/{draft}/preview", headers=author).status_code == 409


def test_assistant_denied_after_confirmed_draft(tmp_path, monkeypatch):
    for key in ("UAGP_AI_BASE_URL", "UAGP_AI_MODEL", "UAGP_AI_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    c = TestClient(create_app(test_settings(tmp_path)))
    draft, author = new_draft(c)
    assert c.post(f"/v1/civic/drafts/{draft}/clarify", headers=author, json={
        "desired_outcome": "Shorter transfers from the bus to commuter train",
        "legal_kind": "policy_idea",
    }).status_code == 200
    preview = c.get(f"/v1/civic/drafts/{draft}/preview", headers=author).json()
    assert c.post(f"/v1/civic/drafts/{draft}/confirm", headers=author, json={
        "preview_fingerprint": preview["preview_fingerprint"],
    }).status_code == 200
    assert respond(c, draft, author).status_code == 409


def test_provider_url_rejects_insecure_external_http_or_embedded_credentials():
    with pytest.raises(ValueError):
        ModelConfiguration(base_url="http://example.org/v1", model="mock", api_key="x")
    with pytest.raises(ValueError):
        ModelConfiguration(base_url="https://user:pw@example.org/v1", model="mock", api_key="x")
    with pytest.raises(ValueError):
        ModelConfiguration(base_url="https://example.org/v1", model="mock", api_key="")
    assert ModelConfiguration(base_url="http://127.0.0.1:8000/v1", model="mock").enabled


def test_reject_extra_fields_or_oversized_history(tmp_path, monkeypatch):
    for key in ("UAGP_AI_BASE_URL", "UAGP_AI_MODEL", "UAGP_AI_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    c = TestClient(create_app(test_settings(tmp_path)))
    draft, author = new_draft(c)
    r = respond(c, draft, author, tool_command="submit_now")
    assert r.status_code == 422
    r = respond(c, draft, author, history=[
        {"role": "citizen", "content": "hello"} for _ in range(7)
    ])
    assert r.status_code == 422

"""Tests run only against fictional, isolated UAGP nodes."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
import pytest

from uagp.app import create_app
from uagp.models import DemoPolicy
from uagp.policy import canonical_json, sign_document
from uagp.settings import Settings


def pair(tmp_path):
    key = "test-federation-signing-secret"
    policy_key = "test-policy-signing-secret"
    app_a = create_app(Settings(
        node_id="community-a", peer_id="community-b",
        db_path=str(tmp_path / "community-a.db"),
        operator_token="operator-a-secret-token", shared_key=key,
        policy_signing_key=policy_key,
    ))
    app_b = create_app(Settings(
        node_id="community-b", peer_id="community-a",
        db_path=str(tmp_path / "community-b.db"),
        operator_token="operator-b-secret-token", shared_key=key,
        policy_signing_key=policy_key,
    ))

    client_b = TestClient(app_b)

    def deliver(raw: bytes, headers: dict[str, str]) -> int:
        return client_b.post("/v1/federation/events", content=raw, headers=headers).status_code

    app_a.dependency_overrides.clear()
    app_a = create_app(
        Settings(
            node_id="community-a", peer_id="community-b",
            db_path=str(tmp_path / "community-a.db"),
            operator_token="operator-a-secret-token", shared_key=key,
            policy_signing_key=policy_key,
        ), delivery=deliver,
    )
    return (
        TestClient(app_a),
        client_b,
        {"X-Demo-Operator-Token": "operator-a-secret-token"},
        {"X-Demo-Operator-Token": "operator-b-secret-token"},
        key,
        policy_key,
    )


def new_draft(client, headers):
    response = client.post(
        "/v1/drafts",
        headers=headers,
        json={
            "category": "transport",
            "problem": "A local bus always misses the commuter train.",
            "desired_outcome": "Reduce transfer waits for all passengers.",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_auth_required_and_node_isolation(tmp_path):
    a, b, ha, hb, _, _ = pair(tmp_path)
    assert a.post("/v1/drafts", json={
        "category": "transport", "problem": "A local bus misses the train.",
        "desired_outcome": "Reduce waiting times substantially.",
    }).status_code == 401
    id_ = new_draft(a, ha)
    assert b.get(f"/v1/proposals/{id_}", headers=hb).status_code == 404
    assert a.get(f"/v1/proposals/{id_}", headers=ha).json()["status"] == "draft"


def test_explicit_opt_in_and_minimized_event(tmp_path):
    a, b, ha, hb, _, _ = pair(tmp_path)
    id_ = new_draft(a, ha)
    assert a.post(f"/v1/proposals/{id_}/share", headers=ha).status_code == 409
    assert a.post(f"/v1/drafts/{id_}/confirm", headers=ha, json={
        "share_federated": True
    }).status_code == 200
    first = a.post(f"/v1/proposals/{id_}/share", headers=ha)
    assert first.status_code == 200
    assert first.json()["status"] == "delivered"
    assert b.get("/v1/inbox", headers=hb).json() == {
        "total": 1, "by_category": {"transport": 1},
    }
    second = a.post(f"/v1/proposals/{id_}/share", headers=ha)
    assert second.json()["status"] == "already_delivered"
    assert b.get("/v1/inbox", headers=hb).json()["total"] == 1


def test_no_opt_in_no_federation(tmp_path):
    a, b, ha, hb, _, _ = pair(tmp_path)
    id_ = new_draft(a, ha)
    assert a.post(f"/v1/drafts/{id_}/confirm", headers=ha, json={
        "share_federated": False,
    }).status_code == 200
    assert a.post(f"/v1/proposals/{id_}/share", headers=ha).status_code == 409
    assert b.get("/v1/inbox", headers=hb).json()["total"] == 0
    assert a.post(f"/v1/drafts/{id_}/confirm", headers=ha, json={
        "share_federated": True,
    }).status_code == 409


def test_rejects_unsigned_or_extra_fields(tmp_path):
    a, b, _, hb, key, _ = pair(tmp_path)
    from datetime import datetime, timezone
    from uuid import uuid4

    event = {
        "specversion": "1.0", "id": str(uuid4()), "source": "uagp://community-a",
        "type": "ua.gov.problem.signal.v1",
        "time": datetime.now(timezone.utc).isoformat(),
        "datacontenttype": "application/json",
        "data": {"signal": "problem_category", "category": "transport"},
    }
    raw = canonical_json(event)
    assert b.post("/v1/federation/events", content=raw).status_code == 401
    invalid = dict(event)
    invalid["private_dialogue"] = "Private, must never leave a node."
    signed = canonical_json(invalid)
    response = b.post(
        "/v1/federation/events",
        content=signed,
        headers={"X-UAGP-Signature": sign_document(signed, key)},
    )
    assert response.status_code == 422
    assert b.get("/v1/inbox", headers=hb).json()["total"] == 0


def test_replay_is_idempotent(tmp_path):
    _, b, _, hb, key, _ = pair(tmp_path)
    from uuid import uuid4

    event = {
        "specversion": "1.0", "id": str(uuid4()), "source": "uagp://community-a",
        "type": "ua.gov.problem.signal.v1",
        "time": datetime.now(timezone.utc).isoformat(),
        "datacontenttype": "application/json",
        "data": {"signal": "problem_category", "category": "energy"},
    }
    raw = canonical_json(event)
    headers = {"X-UAGP-Signature": sign_document(raw, key)}
    assert b.post("/v1/federation/events", content=raw, headers=headers).status_code == 202
    assert b.post("/v1/federation/events", content=raw, headers=headers).json()["status"] == "duplicate"
    assert b.get("/v1/inbox", headers=hb).json()["total"] == 1


def test_policy_gateway_denies_untrusted_or_high_risk_tools(tmp_path):
    a, _, ha, _, _, secret = pair(tmp_path)
    policy = DemoPolicy(
        policy_id="demo", version="0.1",
        allowed_tools=["sandbox.read"], risk_ceiling=1,
        valid_until=datetime.now(timezone.utc) + timedelta(days=1),
    )
    signed = sign_document(canonical_json(policy.model_dump(mode="json")), secret)
    body = {
        "policy": policy.model_dump(mode="json"),
        "signature": signed,
        "tool_id": "sandbox.read", "risk_class": 1,
    }
    assert a.post("/v1/policy/check", headers=ha, json=body).json()["allowed"] is True
    body["tool_id"] = "sandbox.write"
    assert a.post("/v1/policy/check", headers=ha, json=body).json()["allowed"] is False
    body["tool_id"] = "sandbox.read"
    body["risk_class"] = 4
    assert a.post("/v1/policy/check", headers=ha, json=body).json()["allowed"] is False
    body["risk_class"] = 1
    body["signature"] = "sha256=bad"
    assert a.post("/v1/policy/check", headers=ha, json=body).json()["allowed"] is False

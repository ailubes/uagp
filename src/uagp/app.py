"""Two-node UAGP demonstration API. Only fictional authority and local data."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Callable
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .models import Confirmation, DraftInput, FederationEvent, PolicyCheck
from .policy import authorize_demo_tool, canonical_json, sign_document, verify_document
from .settings import Settings
from .storage import Database

Delivery = Callable[[bytes, dict[str, str]], int]


def create_app(settings: Settings | None = None, delivery: Delivery | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    database = Database(settings.db_path)
    app = FastAPI(
        title="UAGP Sandbox Node",
        version="0.1.0",
        description="Non-governmental research prototype. No production identity or legal authority.",
    )

    def operator_only(
        token: str | None = Header(default=None, alias="X-Demo-Operator-Token")
    ) -> None:
        from hmac import compare_digest

        if not compare_digest(token or "", settings.operator_token):
            raise HTTPException(status_code=401, detail="Demo operator token required")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "node": settings.node_id, "mode": "sandbox"}

    @app.post("/v1/drafts", status_code=201)
    def create_draft(
        payload: DraftInput, _: None = Depends(operator_only)
    ) -> dict:
        proposal_id = database.create_draft(payload)
        return {"id": proposal_id, "status": "draft", "federated": False}

    @app.post("/v1/drafts/{draft_id}/confirm")
    def confirm_draft(
        draft_id: str, body: Confirmation, _: None = Depends(operator_only)
    ) -> dict:
        try:
            record = database.confirm(draft_id, body.share_federated)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if record is None:
            raise HTTPException(status_code=404, detail="Unknown draft")
        return {
            "id": record["id"],
            "status": record["status"],
            "share_federated": bool(record["share_federated"]),
        }

    @app.get("/v1/proposals/{proposal_id}")
    def read_proposal(
        proposal_id: str, _: None = Depends(operator_only)
    ) -> dict:
        record = database.get_proposal(proposal_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Unknown proposal")
        # This is an operator-only LOCAL response, never a federated payload.
        return {
            "id": record["id"],
            "category": record["category"],
            "problem": record["problem"],
            "desired_outcome": record["desired_outcome"],
            "status": record["status"],
            "share_federated": bool(record["share_federated"]),
        }

    @app.post("/v1/proposals/{proposal_id}/share")
    def share_category(
        proposal_id: str, _: None = Depends(operator_only)
    ) -> dict:
        record = database.get_proposal(proposal_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Unknown proposal")
        if record["status"] != "confirmed" or not record["share_federated"]:
            raise HTTPException(
                status_code=409,
                detail="Author confirmation and federation opt-in required",
            )

        # Deliberate allowlist: NO problem, name, address, or desired_outcome.
        event = {
            "specversion": "1.0",
            "id": str(uuid4()),
            "source": "uagp://" + settings.node_id,
            "type": "ua.gov.problem.signal.v1",
            "time": datetime.now(timezone.utc).isoformat(),
            "datacontenttype": "application/json",
            "data": {"signal": "problem_category", "category": record["category"]},
        }
        raw = canonical_json(event)
        outgoing = database.get_or_create_outgoing(proposal_id, event["id"], raw)
        if outgoing["delivered"]:
            return {"status": "already_delivered", "event_id": outgoing["event_id"]}

        raw = outgoing["raw_event"]
        signature = sign_document(raw, settings.shared_key)
        headers = {
            "X-UAGP-Signature": signature,
            "Content-Type": "application/cloudevents+json",
        }
        try:
            if delivery is not None:
                status = delivery(raw, headers)
            else:
                if not settings.peer_url:
                    raise RuntimeError("Peer URL has not been configured")
                response = httpx.post(
                    settings.peer_url.rstrip("/") + "/v1/federation/events",
                    content=raw,
                    headers=headers,
                    timeout=3.0,
                )
                status = response.status_code
        except (httpx.HTTPError, RuntimeError, TimeoutError) as exc:
            raise HTTPException(
                status_code=502, detail="Federation peer unavailable"
            ) from exc
        if status not in (200, 202):
            raise HTTPException(status_code=502, detail="Federation peer rejected the event")
        database.mark_delivered(proposal_id)
        return {"status": "delivered", "event_id": outgoing["event_id"]}

    @app.post("/v1/federation/events", status_code=202)
    async def receive_event(request: Request):
        raw = await request.body()
        if len(raw) > 2048:
            raise HTTPException(status_code=413, detail="Event too large")
        if not verify_document(
            raw, request.headers.get("X-UAGP-Signature", ""), settings.shared_key
        ):
            raise HTTPException(status_code=401, detail="Invalid federation signature")
        try:
            event = FederationEvent.model_validate_json(raw)
        except (ValueError, ValidationError) as exc:
            raise HTTPException(status_code=422, detail="Invalid event schema") from exc
        if event.source != "uagp://" + settings.peer_id:
            raise HTTPException(status_code=403, detail="Untrusted source node")
        if event.time.tzinfo is None:
            raise HTTPException(status_code=422, detail="Timezone required")
        # Retried outbox events may be old; persistent event-id de-duplication
        # handles replay. Only dates too far in the future are rejected.
        if event.time > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise HTTPException(status_code=422, detail="Event date is in the future")
        created = database.record_incoming(
            str(event.id), event.source, event.data.category
        )
        if not created:
            return JSONResponse(status_code=200, content={"status": "duplicate"})
        return {"status": "accepted", "event_id": str(event.id)}

    @app.get("/v1/inbox")
    def inbox(_: None = Depends(operator_only)) -> dict:
        # Aggregated counts only, not foreign citizen drafts.
        return database.inbox_counts()

    @app.post("/v1/policy/check")
    def policy_check(
        payload: PolicyCheck, _: None = Depends(operator_only)
    ) -> dict:
        # Checks only: no real tools or registries can be executed.
        return authorize_demo_tool(payload, settings.policy_signing_key)

    return app

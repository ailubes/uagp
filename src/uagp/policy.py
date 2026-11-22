"""A verification-only, deny-by-default policy gateway for the sandbox.

This does NOT establish legal authority. It demonstrates separation between
untrusted model suggestions and permissions signed by a different service.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone

from .models import PolicyCheck


def canonical_json(document: dict) -> bytes:
    return json.dumps(
        document, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")


def sign_document(raw: bytes, key: str) -> str:
    return "sha256=" + hmac.new(
        key.encode("utf-8"), raw, hashlib.sha256
    ).hexdigest()


def verify_document(raw: bytes, signature: str, key: str) -> bool:
    expected = sign_document(raw, key)
    return hmac.compare_digest(expected, signature)


def authorize_demo_tool(request: PolicyCheck, signing_key: str) -> dict:
    bundle = request.policy.model_dump(mode="json")
    if not verify_document(
        canonical_json(bundle), request.signature, signing_key
    ):
        return {"allowed": False, "reason": "invalid_policy_signature"}

    if request.policy.valid_until.tzinfo is None:
        return {"allowed": False, "reason": "invalid_expiration"}
    if request.policy.valid_until <= datetime.now(timezone.utc):
        return {"allowed": False, "reason": "expired_policy"}

    if request.risk_class >= 4:
        return {"allowed": False, "reason": "non_delegable_decision"}
    if request.tool_id not in request.policy.allowed_tools:
        return {"allowed": False, "reason": "tool_not_authorized"}
    if request.risk_class > request.policy.risk_ceiling:
        return {"allowed": False, "reason": "risk_exceeds_policy"}
    if request.risk_class >= 3 and not request.human_approved:
        return {"allowed": False, "reason": "human_approval_required"}
    return {"allowed": True, "reason": "sandbox_policy_check_only"}

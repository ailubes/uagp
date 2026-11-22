"""Explicit settings: the demo refuses to start without credentials."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

NODE_ID = re.compile(r"[a-z0-9][a-z0-9-]{1,62}\Z")


@dataclass(frozen=True)
class Settings:
    node_id: str
    peer_id: str
    db_path: str
    operator_token: str
    shared_key: str
    policy_signing_key: str
    peer_url: str = ""

    def __post_init__(self) -> None:
        if not NODE_ID.fullmatch(self.node_id) or not NODE_ID.fullmatch(self.peer_id):
            raise ValueError("Node IDs must be lowercase DNS-style labels.")
        if self.node_id == self.peer_id:
            raise ValueError("The peer must be a different node.")
        if len(self.operator_token) < 12:
            raise ValueError("UAGP_OPERATOR_TOKEN is missing or too short.")
        if len(self.shared_key) < 16 or len(self.policy_signing_key) < 16:
            raise ValueError("Demo signing keys must be explicitly configured (>=16 chars).")
        if not self.db_path:
            raise ValueError("A separate database path is required per node.")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            node_id=os.environ["UAGP_NODE_ID"],
            peer_id=os.environ["UAGP_PEER_ID"],
            db_path=os.environ["UAGP_DB_PATH"],
            operator_token=os.environ["UAGP_OPERATOR_TOKEN"],
            shared_key=os.environ["UAGP_SHARED_KEY"],
            policy_signing_key=os.environ["UAGP_POLICY_SIGNING_KEY"],
            peer_url=os.environ.get("UAGP_PEER_URL", ""),
        )

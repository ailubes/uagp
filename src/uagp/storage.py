"""Per-node SQLite storage. No global database and no public personal-data index."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from uuid import uuid4

from .models import DraftInput


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str) -> None:
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS proposals (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    problem TEXT NOT NULL,
                    desired_outcome TEXT NOT NULL,
                    status TEXT NOT NULL,
                    share_federated INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS outbox (
                    proposal_id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL UNIQUE,
                    raw_event BLOB NOT NULL,
                    delivered INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS inbox (
                    event_id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    category TEXT NOT NULL,
                    received_at TEXT NOT NULL
                );
                """
            )

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def create_draft(self, data: DraftInput) -> str:
        proposal_id = str(uuid4())
        with self.connection() as conn:
            conn.execute(
                """INSERT INTO proposals (
                    id, category, problem, desired_outcome, status, created_at
                ) VALUES (?, ?, ?, ?, 'draft', ?)""",
                (proposal_id, data.category, data.problem, data.desired_outcome, utc_now()),
            )
        return proposal_id

    def get_proposal(self, proposal_id: str) -> dict | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM proposals WHERE id = ?", (proposal_id,)
            ).fetchone()
        return dict(row) if row is not None else None

    def confirm(self, proposal_id: str, consent: bool) -> dict | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM proposals WHERE id = ?", (proposal_id,)
            ).fetchone()
            if row is None:
                return None
            if row["status"] == "confirmed" and bool(row["share_federated"]) != consent:
                raise ValueError("Confirmed consent cannot be silently changed.")
            if row["status"] == "draft":
                conn.execute(
                    """UPDATE proposals SET status = 'confirmed',
                    share_federated = ? WHERE id = ?""",
                    (int(consent), proposal_id),
                )
        return self.get_proposal(proposal_id)

    def get_or_create_outgoing(
        self, proposal_id: str, event_id: str, raw_event: bytes
    ) -> dict:
        with self.connection() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO outbox
                (proposal_id, event_id, raw_event) VALUES (?, ?, ?)""",
                (proposal_id, event_id, raw_event),
            )
            row = conn.execute(
                "SELECT * FROM outbox WHERE proposal_id = ?", (proposal_id,)
            ).fetchone()
        assert row is not None
        return dict(row)

    def mark_delivered(self, proposal_id: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE outbox SET delivered = 1 WHERE proposal_id = ?", (proposal_id,)
            )

    def record_incoming(self, event_id: str, source: str, category: str) -> bool:
        with self.connection() as conn:
            result = conn.execute(
                """INSERT OR IGNORE INTO inbox
                (event_id, source, category, received_at) VALUES (?, ?, ?, ?)""",
                (event_id, source, category, utc_now()),
            )
            return result.rowcount == 1

    def inbox_counts(self) -> dict:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT category, COUNT(*) AS count FROM inbox GROUP BY category"
            ).fetchall()
        by_category = {row["category"]: row["count"] for row in rows}
        return {"total": sum(by_category.values()), "by_category": by_category}

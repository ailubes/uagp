"""Portable read-only UAGP MCP tools for citizen-owned AI applications.

Transport defaults to stdio. The host application runs this locally and owns
the language model and its billing. No service tokens or government actions.
"""

from __future__ import annotations

import os

from mcp.server.fastmcp import FastMCP

from .handoff import prepare_handoff, public_catalog

mcp = FastMCP(
    "UAGP Citizen Bridge",
    instructions=(
        "UAGP is a research sandbox, not a government service. "
        "Use prepare_civic_proposal to build a structured draft after discussing "
        "the citizen's own goals. It does NOT submit, publish, or approve anything. "
        "Return the draft to the citizen for manual review in the UAGP portal. "
        "Never send secrets, identities, medical data or precise addresses. "
        "Public idea discovery returns only explicitly published demo summaries."
    ),
)


@mcp.tool()
def prepare_civic_proposal(
    category: str,
    scope: str,
    problem: str,
    desired_outcome: str,
    proposed_solution: str | None = None,
    legal_kind: str = "policy_idea",
) -> dict:
    """Create a validated portable civic JSON draft; NO network, save or submission.

    category: transport, energy, services, other.
    scope: community, intercommunity, krai_concept, national.
    legal_kind: policy_idea, citizen_appeal, information_request, petition,
                administrative_application, other.
    """
    return prepare_handoff(
        category=category, scope=scope, problem=problem,
        desired_outcome=desired_outcome, proposed_solution=proposed_solution,
        legal_kind=legal_kind,
    )


@mcp.tool()
def explore_public_proposals(category: str = "all", limit: int = 12) -> dict:
    """Read only human-reviewed PUBLIC demo summaries, no private drafts.

    This uses a local database when UAGP_DB_PATH is configured and returns
    no results if that database does not exist. It never connects to citizens.
    """
    return public_catalog(os.environ.get("UAGP_DB_PATH"), category, limit)


@mcp.tool()
def explain_uagp_participation() -> dict:
    """Explain how a citizen can participate safely without handing over AI access."""
    return {
        "status": "sandbox",
        "steps": [
            "Обговоріть суспільну потребу у власному AI-застосунку.",
            "Попросіть AI викликати prepare_civic_proposal, перевірте JSON.",
            "Відкрийте локальний портал /ui та імпортуйте JSON.",
            "Перевірте текст і окремо підтвердьте демонстраційне подання.",
            "Публічність потребує окремої згоди та незалежного перегляду.",
        ],
        "prohibitions": [
            "MCP не надсилає звернення до державних органів.",
            "MCP не публікує дані та не отримує токенів громадянина.",
            "MCP не змінює Harness, політики та правові повноваження.",
        ],
        "ai_billing": "Визначається стороннім клієнтом та моделлю користувача.",
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")

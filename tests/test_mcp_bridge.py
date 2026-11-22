"""Smoke tests for a local, read-only MCP integration."""

from uagp.mcp_server import (
    explain_uagp_participation,
    explore_public_proposals,
    prepare_civic_proposal,
    mcp,
)


def test_mcp_server_has_only_non_privileged_tools(tmp_path, monkeypatch):
    assert mcp is not None
    result = prepare_civic_proposal(
        category="transport", scope="community",
        problem="Bus schedules do not connect to commuter trains.",
        desired_outcome="Make transport transfers more convenient.",
    )
    assert result["submitted"] is False
    assert result["publication_requested"] is False
    assert "problem" in result["handoff"]
    assert "author_key" not in str(result)

    monkeypatch.setenv("UAGP_DB_PATH", str(tmp_path / "empty.db"))
    assert explore_public_proposals()["items"] == []
    guide = explain_uagp_participation()
    assert guide["status"] == "sandbox"
    assert all("MCP" in x for x in guide["prohibitions"])

from fastapi.testclient import TestClient
from uagp.app import create_app
from uagp.settings import Settings


def setup(tmp_path):
    settings = Settings(
        node_id="demo-a",peer_id="demo-b",db_path=str(tmp_path/"civic.db"),
        operator_token="operator-secret-test",reviewer_token="reviewer-secret-test",
        shared_key="federation-secret-test",policy_signing_key="policy-secret-test",
    )
    c=TestClient(create_app(settings))
    return c,{"X-Demo-Operator-Token":"operator-secret-test"},{"X-Demo-Reviewer-Token":"reviewer-secret-test"}


def make_case(c,op,kind="policy_idea",publish=False):
    r=c.post("/v1/civic/drafts",headers=op,json={
        "category":"transport","scope":"community",
        "problem":"Private text must never appear in a public proposal"})
    assert r.status_code==201
    did=r.json()["draft_id"]
    a={"X-UAGP-Author-Key":r.json()["author_key"]}
    r=c.post(f"/v1/civic/drafts/{did}/clarify",headers=a,json={
        "desired_outcome":"Make transfers more accessible for local passengers",
        "proposed_solution":"Review available timetables","legal_kind":kind})
    assert r.status_code==200
    p=c.get(f"/v1/civic/drafts/{did}/preview",headers=a)
    assert p.status_code==200
    payload={"preview_fingerprint":p.json()["preview_fingerprint"],
             "request_publication":publish}
    if publish:
        payload["public_summary"]="Review bus-to-rail transfers across nearby settlements."
    assert c.post(f"/v1/civic/drafts/{did}/confirm",headers=a,json=payload).status_code==200
    r=c.post(f"/v1/civic/drafts/{did}/submit",headers=a)
    assert r.status_code==200
    return did,r.json()["case_id"],a


def test_private_lifecycle_and_status(tmp_path):
    c,op,review=setup(tmp_path)
    did,case,a=make_case(c,op)
    assert c.get(f"/v1/civic/public/{case}").status_code==404
    assert c.get(f"/v1/civic/cases/{case}").status_code==404
    v=c.get(f"/v1/civic/cases/{case}",headers=a)
    assert v.status_code==200
    assert v.json()["official_submission"] is False
    assert len(v.json()["events"]) >= 4


def test_publication_requires_distinct_reviewer_and_author_opt_in(tmp_path):
    c,op,review=setup(tmp_path)
    did,case,a=make_case(c,op,publish=True)
    assert c.post(f"/v1/civic/cases/{case}/publish",headers=review).status_code==409
    assert c.post(f"/v1/civic/cases/{case}/review",headers=op,json={
        "verdict":"accept_demo","reason":"Approved only as a fictional demonstration"}).status_code==200
    assert c.post(f"/v1/civic/cases/{case}/publish",headers=op).status_code==401
    assert c.post(f"/v1/civic/cases/{case}/publish",headers=review).status_code==200
    public=c.get(f"/v1/civic/public/{case}").json()
    assert "Private text" not in str(public)
    assert set(public)=={"case_id","category","scope","public_summary","status","sandbox"}
    assert c.post(f"/v1/civic/cases/{case}/unpublish",headers=a).status_code==200
    assert c.get(f"/v1/civic/public/{case}").status_code==404


def test_appeal_separate_role(tmp_path):
    c,op,review=setup(tmp_path)
    _,case,a=make_case(c,op)
    assert c.post(f"/v1/civic/cases/{case}/review",headers=op,json={
        "verdict":"reject_demo","reason":"Insufficient simulated evidence for this case"}).status_code==200
    assert c.post(f"/v1/civic/cases/{case}/appeal",headers=a,json={
        "reason":"Please consider the missing evidence"}).status_code==200
    body={"verdict":"uphold_demo","reason":"Independent sandbox review considered the appeal"}
    assert c.post(f"/v1/civic/cases/{case}/appeal-decision",headers=op,json=body).status_code==401
    assert c.post(f"/v1/civic/cases/{case}/appeal-decision",headers=review,json=body).status_code==200


def test_official_procedure_not_approved_in_sandbox(tmp_path):
    c,op,_=setup(tmp_path)
    _,case,_=make_case(c,op,kind="administrative_application")
    assert c.post(f"/v1/civic/cases/{case}/review",headers=op,json={
        "verdict":"accept_demo","reason":"Sandbox must refuse legal approval"}).status_code==409


def test_stale_preview_rejected(tmp_path):
    c,op,_=setup(tmp_path)
    r=c.post("/v1/civic/drafts",headers=op,json={
        "category":"services","scope":"community",
        "problem":"The opening hours do not match residents needs"})
    did=r.json()["draft_id"];a={"X-UAGP-Author-Key":r.json()["author_key"]}
    assert c.post(f"/v1/civic/drafts/{did}/clarify",headers=a,json={
        "desired_outcome":"Improve residents access to services",
        "legal_kind":"policy_idea"}).status_code==200
    assert c.post(f"/v1/civic/drafts/{did}/confirm",headers=a,json={
        "preview_fingerprint":"a"*64}).status_code==409


def test_no_publication_without_opt_in(tmp_path):
    c,op,review=setup(tmp_path)
    _,case,_=make_case(c,op)
    assert c.post(f"/v1/civic/cases/{case}/review",headers=op,json={
        "verdict":"accept_demo","reason":"Hypothetical case reviewed positively"}).status_code==200
    assert c.post(f"/v1/civic/cases/{case}/publish",headers=review).status_code==409


def test_reviewer_can_inspect_public_summary_but_not_private_text(tmp_path):
    c, op, reviewer = setup(tmp_path)
    _, case, _ = make_case(c, op, publish=True)
    url = f"/v1/civic/cases/{case}/publication-review"
    assert c.get(url, headers=op).status_code == 401
    preview = c.get(url, headers=reviewer)
    assert preview.status_code == 200
    assert preview.json()["publication_requested"] is True
    assert "Private text" not in str(preview.json())


def test_appeal_keeps_original_and_appeal_motives(tmp_path):
    c, op, reviewer = setup(tmp_path)
    _, case, author = make_case(c, op)
    first = "The fictional evidence is insufficient for this proposal"
    assert c.post(f"/v1/civic/cases/{case}/review", headers=op, json={
        "verdict": "reject_demo", "reason": first,
    }).status_code == 200
    assert c.post(f"/v1/civic/cases/{case}/appeal", headers=author, json={
        "reason": "Additional evidence should be considered",
    }).status_code == 200
    assert c.post(f"/v1/civic/cases/{case}/appeal-decision", headers=reviewer, json={
        "verdict": "uphold_demo",
        "reason": "The independent test reviewer reconsidered the case",
    }).status_code == 200
    details = c.get(f"/v1/civic/cases/{case}", headers=author).json()
    assert details["decision_reason"] == first
    assert details["appeal_reason"] == "Additional evidence should be considered"
    assert details["appeal_decision_reason"].startswith("The independent")


def test_requested_clarification_preserves_case_id(tmp_path):
    c, op, reviewer = setup(tmp_path)
    r = c.post("/v1/civic/drafts", headers=op, json={
        "category": "services", "scope": "community",
        "problem": "Evening service hours are inconvenient for residents",
    })
    assert r.status_code == 201
    draft, author = r.json()["draft_id"], {"X-UAGP-Author-Key": r.json()["author_key"]}
    def clarify_and_confirm(goal):
        assert c.post(f"/v1/civic/drafts/{draft}/clarify", headers=author, json={
            "desired_outcome": goal, "legal_kind": "policy_idea",
        }).status_code == 200
        preview = c.get(f"/v1/civic/drafts/{draft}/preview", headers=author).json()
        assert c.post(f"/v1/civic/drafts/{draft}/confirm", headers=author, json={
            "preview_fingerprint": preview["preview_fingerprint"],
        }).status_code == 200
    clarify_and_confirm("Improve citizens access to existing services")
    original = c.post(f"/v1/civic/drafts/{draft}/submit", headers=author).json()["case_id"]
    assert c.post(f"/v1/civic/cases/{original}/review", headers=op, json={
        "verdict": "request_clarification",
        "reason": "Please explain the exact desired improvement",
    }).status_code == 200
    clarify_and_confirm("Extend city hall opening hours into the evening")
    same = c.post(f"/v1/civic/drafts/{draft}/submit", headers=author).json()["case_id"]
    assert original == same

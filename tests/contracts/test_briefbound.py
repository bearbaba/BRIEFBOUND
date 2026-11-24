"""Actual GenVM direct-mode contract logic; AI and external views are mocked."""
import json

SOURCE = "Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English only."
LAYOUT = "Deliver one landing page in desktop + mobile layouts."
ROUNDS = "Two rounds of layout revisions are included."
LANGUAGE = "Final delivery is in English only."
AMENDMENT = "Japanese-language delivery is included alongside English for the same landing page. This replaces the previous English-only restriction."
MESSAGE = "Please tighten the spacing on mobile and add a Japanese version."

def clauses(amended=False):
    rows = [{"kind": "layout", "quote": LAYOUT, "meaning": "Desktop and mobile layout"},
            {"kind": "rounds", "quote": ROUNDS, "meaning": "Two rounds included"},
            {"kind": "language", "quote": LANGUAGE, "meaning": "English only"}]
    if amended:
        rows.append({"kind": "language", "quote": AMENDMENT, "meaning": "Japanese and English"})
    return rows

def setup_anchor(vm, deploy, alice, bob):
    anchor = deploy("contracts/ScopeAnchor.py")
    from genlayer import Address
    vm.sender = alice
    vm.mock_llm(r"(?s).*Identify all material design-scope facts.*SOURCE:.*", json.dumps({"clauses": clauses()}))
    vm.mock_llm(r"(?s).*You are an independent validator.*", '{"valid":true}')
    anchor.create_brief("brief-a", SOURCE, Address(alice).as_hex, Address(bob).as_hex)
    return anchor

def test_distinct_signers_and_immutable_lock(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    anchor = setup_anchor(direct_vm, direct_deploy, direct_alice, direct_bob)
    assert not json.loads(anchor.get_version("brief-a", 1))["locked"]
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("signatories"):
        anchor.approve_version("brief-a", 1)
    direct_vm.sender = direct_alice
    anchor.approve_version("brief-a", 1)
    with direct_vm.expect_revert("already approved"):
        anchor.approve_version("brief-a", 1)
    assert not json.loads(anchor.get_version("brief-a", 1))["locked"]
    direct_vm.sender = direct_bob
    anchor.approve_version("brief-a", 1)
    assert json.loads(anchor.get_version("brief-a", 1))["locked"]
    with direct_vm.expect_revert("already locked"):
        anchor.approve_version("brief-a", 1)

def test_amendment_requires_two_fresh_signatures(direct_vm, direct_deploy, direct_alice, direct_bob):
    anchor = setup_anchor(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.expect_revert("both approvals"):
        anchor.propose_amendment("brief-a", AMENDMENT)
    anchor.approve_version("brief-a", 1)
    direct_vm.sender = direct_bob
    anchor.approve_version("brief-a", 1)
    v1 = anchor.get_version("brief-a", 1)
    # The earlier mock may match the amended source; either valid quoted extraction still
    # permits verification of immutable source and approval state.
    anchor.propose_amendment("brief-a", AMENDMENT)
    v2 = json.loads(anchor.get_version("brief-a", 2))
    assert AMENDMENT in v2["source"] and v2["source"].startswith(SOURCE)
    assert not v2["locked"] and not v2["client_approved"] and not v2["freelancer_approved"]
    anchor.approve_version("brief-a", 2)
    direct_vm.sender = direct_alice
    anchor.approve_version("brief-a", 2)
    assert json.loads(anchor.get_version("brief-a", 2))["locked"]
    assert anchor.get_version("brief-a", 1) == v1

def desk_fixture(vm, deploy, alice, bob, monkeypatch):
    desk = deploy("contracts/ChangeDesk.py", "0x" + "9" * 40)
    from genlayer import Address
    records = {}
    for v in (1, 2):
        rows = clauses(v == 2)
        for i, row in enumerate(rows):
            row["clause_id"] = f"brief-a:{v}:c{i+1}"
        records[v] = {"brief_id": "brief-a", "version": v, "source": SOURCE + ("\n" + AMENDMENT if v == 2 else ""),
                      "client": Address(alice).as_hex.lower(), "freelancer": Address(bob).as_hex.lower(),
                      "locked": True, "client_approved": True, "freelancer_approved": True, "clauses": rows}
    # Stub external view only; all ChangeDesk state and public methods are actual contract code.
    monkeypatch.setattr(type(desk._instance), "_load", lambda self, brief_id, version: records[version])
    current = [1]
    def require_current(self, brief_id, version):
        from genlayer import gl
        if version != current[0]:
            raise gl.vm.UserError("Revision rounds require the current locked version")
    monkeypatch.setattr(type(desk._instance), "_require_current_version", require_current)
    return desk, current

def test_rounds_require_other_signer_and_survive_amendment(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    desk, current = desk_fixture(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Invalid"):
        desk.propose_round("brief-a:v1:counter", "brief-a", 1)
    desk.propose_round("round-one", "brief-a", 1)
    assert desk.get_remaining_rounds("brief-a", 1) == 2
    with direct_vm.expect_revert("Other signatory"):
        desk.confirm_round("round-one")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not a brief signatory"):
        desk.confirm_round("round-one")
    direct_vm.sender = direct_bob
    desk.confirm_round("round-one")
    assert desk.get_remaining_rounds("brief-a", 1) == 1
    current[0] = 2
    assert desk.get_remaining_rounds("brief-a", 2) == 1
    desk.propose_round("round-two", "brief-a", 2)
    direct_vm.sender = direct_alice
    desk.confirm_round("round-two")
    assert desk.get_remaining_rounds("brief-a", 2) == 0
    with direct_vm.expect_revert("No verified"):
        desk.propose_round("round-three", "brief-a", 2)

def test_grounded_decision_is_immutable(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    desk, _ = desk_fixture(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    items = [{"request_quote": "tighten the spacing on mobile", "label": "INCLUDED", "clause_id": "brief-a:1:c1", "source_quote": LAYOUT, "reason": "Mobile layout covered."},
             {"request_quote": "add a Japanese version", "label": "CHANGE_ORDER", "clause_id": "brief-a:1:c3", "source_quote": LANGUAGE, "reason": "English only."}]
    direct_vm.mock_llm(r"(?s).*Split a client message.*CLIENT MESSAGE:.*", json.dumps({"items": items}))
    direct_vm.mock_llm(r"(?s).*Independent evidence review.*", '{"valid":true}')
    desk.adjudicate("decision-a", "brief-a", 1, MESSAGE)
    result = json.loads(desk.get_decision("decision-a"))
    assert result["remaining_rounds_at_decision"] == 2
    assert [i["label"] for i in result["items"]] == ["INCLUDED", "CHANGE_ORDER"]
    with direct_vm.expect_revert("already recorded"):
        desk.adjudicate("decision-a", "brief-a", 1, MESSAGE)

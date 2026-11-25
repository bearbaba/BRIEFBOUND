"""GenVM direct-mode regression suite; mocked AI, explicit view boundary."""
import json

SOURCE = "Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English only."
V2 = "Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English and Japanese."
MESSAGE = "Please tighten the spacing on mobile and add a Japanese version."
PATTERN = r"(?s).*Split a client message.*CLIENT MESSAGE:.*"

def setup_anchor(vm, deploy, alice, bob, source=SOURCE):
    anchor = deploy("contracts/ScopeAnchor.py")
    from genlayer.types import Address
    vm.sender = alice
    anchor.create_brief("brief-a", source, Address(alice).as_hex, Address(bob).as_hex)
    return anchor

def lock(vm, anchor, alice, bob, version):
    vm.sender = alice
    anchor.approve_version("brief-a", version)
    vm.sender = bob
    anchor.approve_version("brief-a", version)

def read(anchor, version):
    return json.loads(anchor.get_version("brief-a", version))

def test_distinct_signers_immutable_lock_and_exact_spans(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    a = setup_anchor(direct_vm, direct_deploy, direct_alice, direct_bob)
    assert a.get_protocol_version() == "briefbound-snapshot-v3"
    assert a.get_active_version("brief-a") == 0
    assert read(a, 1)["round_limit"] == 2
    assert all(c["quote"] in SOURCE for c in read(a, 1)["clauses"])
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("signatories"):
        a.approve_version("brief-a", 1)
    direct_vm.sender = direct_alice
    a.approve_version("brief-a", 1)
    with direct_vm.expect_revert("already approved"):
        a.approve_version("brief-a", 1)
    assert not read(a, 1)["locked"]
    direct_vm.sender = direct_bob
    a.approve_version("brief-a", 1)
    assert read(a, 1)["locked"] and a.get_active_version("brief-a") == 1
    with direct_vm.expect_revert("already locked"):
        a.approve_version("brief-a", 1)

def test_replacement_requires_fresh_signatures_and_preserves_history(direct_vm, direct_deploy, direct_alice, direct_bob):
    a = setup_anchor(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.expect_revert("both approvals"):
        a.propose_amendment("brief-a", V2)
    lock(direct_vm, a, direct_alice, direct_bob, 1)
    old = a.get_version("brief-a", 1)
    a.propose_amendment("brief-a", V2)
    draft = read(a, 2)
    assert draft["source"] == V2 and draft["previous_version"] == 1
    assert not draft["locked"] and not draft["client_approved"] and not draft["freelancer_approved"]
    assert "English only" not in draft["source"]
    assert a.get_active_version("brief-a") == 1
    with direct_vm.expect_revert("pending amendment"):
        a.propose_amendment("brief-a", SOURCE + " Another term.")
    lock(direct_vm, a, direct_alice, direct_bob, 2)
    assert a.get_active_version("brief-a") == 2
    assert a.get_version("brief-a", 1) == old
    for version in (1, 2):
        actual = read(a, version)
        assert actual == snapshot(version, actual["client"], actual["freelancer"])

def test_cancel_draft_does_not_reuse_version(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    a = setup_anchor(direct_vm, direct_deploy, direct_alice, direct_bob)
    lock(direct_vm, a, direct_alice, direct_bob, 1)
    a.propose_amendment("brief-a", V2)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("signatories"):
        a.cancel_amendment("brief-a", 2)
    direct_vm.sender = direct_alice
    a.cancel_amendment("brief-a", 2)
    assert a.get_active_version("brief-a") == 1 and read(a, 2)["cancelled"]
    with direct_vm.expect_revert("cancelled"):
        a.approve_version("brief-a", 2)
    a.propose_amendment("brief-a", V2)
    assert a.get_latest_version("brief-a") == 3 and read(a, 3)["previous_version"] == 1

def test_round_caps_fail_closed(direct_vm, direct_deploy, direct_alice, direct_bob):
    a = setup_anchor(direct_vm, direct_deploy, direct_alice, direct_bob,
                     "Deliver mobile layout. Two rounds of layout revisions are included. No revisions are allowed.")
    assert read(a, 1)["round_limit"] == -1
    lock(direct_vm, a, direct_alice, direct_bob, 1)
    a.propose_amendment("brief-a", "Deliver mobile layout. Two rounds of layout revisions are not included.")
    assert read(a, 2)["round_limit"] == -1

def snapshot(version, client, freelancer):
    source = SOURCE if version == 1 else V2
    parts = source.split(". ")
    parts = [p + "." if not p.endswith(".") else p for p in parts]
    return {
        "brief_id": "brief-a", "version": version, "source": source,
        "amendment": "" if version == 1 else source,
        "previous_version": version - 1, "client": client, "freelancer": freelancer,
        "round_limit": 2, "locked": True, "cancelled": False,
        "client_approved": True, "freelancer_approved": True,
        "clauses": [
            {"clause_id": f"brief-a:{version}:c{i+1}", "kind": kind,
             "quote": p, "meaning": p, "introduced_in": version}
            for i, (kind, p) in enumerate(zip(("layout", "rounds", "language"), parts))
        ]
    }

def desk_fixture(vm, deploy, alice, bob, monkeypatch):
    # Direct mode can load only one contract class per test. Mock the external
    # view boundary, not ChangeDesk's validation/authorization methods.
    desk = deploy("contracts/ChangeDesk.py", "0x" + "9" * 40)
    import genlayer as gl
    from genlayer.types import Address
    records = {v: snapshot(v, Address(alice).as_hex.lower(), Address(bob).as_hex.lower()) for v in (1, 2)}
    current = [1]
    class ExternalView:
        def view(self):
            return self
        def get_protocol_version(self):
            return "briefbound-snapshot-v3"
        def get_version(self, brief_id, version):
            if brief_id != "brief-a" or version not in records:
                return ""
            return json.dumps(records[version])
        def get_active_version(self, brief_id):
            return current[0] if brief_id == "brief-a" else 0
    monkeypatch.setattr(gl.contract, "get_at", lambda address: ExternalView())
    return desk, current

def mock(vm, items):
    vm.clear_mocks()
    vm.mock_llm(PATTERN, json.dumps(json.dumps({"items": items})))

def decisions(version=1):
    return [
        {"request_quote": "tighten the spacing on mobile", "label": "INCLUDED", "clause_id": f"brief-a:{version}:c1", "requires_round": True},
        {"request_quote": "add a Japanese version", "label": "CHANGE_ORDER" if version == 1 else "INCLUDED", "clause_id": f"brief-a:{version}:c3", "requires_round": False}
    ]

def test_rounds_require_other_signer_and_survive_amendment(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    desk, current = desk_fixture(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    desk.propose_round("round-one", "brief-a", 1)
    assert desk.get_remaining_rounds("brief-a", 1) == 2
    with direct_vm.expect_revert("Other signatory"):
        desk.confirm_round("round-one")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not a brief signatory"):
        desk.confirm_round("round-one")
    direct_vm.sender = direct_bob
    desk.confirm_round("round-one")
    current[0] = 2
    assert desk.get_remaining_rounds("brief-a", 2) == 1
    with direct_vm.expect_revert("current locked version"):
        desk.propose_round("stale", "brief-a", 1)
    desk.propose_round("round-two", "brief-a", 2)
    direct_vm.sender = direct_alice
    desk.confirm_round("round-two")
    assert desk.get_remaining_rounds("brief-a", 2) == 0
    with direct_vm.expect_revert("No verified"):
        desk.propose_round("round-three", "brief-a", 2)
    mock(direct_vm, decisions(2))
    with direct_vm.expect_revert("Classification missing"):
        desk.adjudicate("exhausted", "brief-a", 2, MESSAGE)

def test_v1_v2_and_validator_replay(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    desk, _ = desk_fixture(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("not a brief signatory"):
        desk.adjudicate("unauthorized", "brief-a", 1, MESSAGE)
    direct_vm.sender = direct_alice
    items = decisions()
    mock(direct_vm, items)
    desk.adjudicate("v1", "brief-a", 1, MESSAGE)
    assert direct_vm.run_validator() is True
    v1 = desk.get_decision("v1")
    assert [i["label"] for i in json.loads(v1)["items"]] == ["INCLUDED", "CHANGE_ORDER"]
    def replay(rows):
        mock(direct_vm, rows)
        return direct_vm.run_validator()
    assert replay([items[1], dict(items[0], request_quote="Please tighten the spacing on mobile")]) is True
    assert replay([items[0], dict(items[1], label="INCLUDED")]) is False
    assert replay([items[0]]) is False
    assert replay([items[0], dict(items[1], clause_id="fabricated")]) is False
    assert replay([items[0], dict(items[1], clause_id="brief-a:1:c1")]) is False
    assert replay([dict(items[0], requires_round=False), items[1]]) is False
    mock(direct_vm, decisions(2))
    desk.adjudicate("v2", "brief-a", 2, MESSAGE)
    assert direct_vm.run_validator() is True
    assert [i["label"] for i in json.loads(desk.get_decision("v2"))["items"]] == ["INCLUDED", "INCLUDED"]
    assert desk.get_decision("v1") == v1
    with direct_vm.expect_revert("already recorded"):
        desk.adjudicate("v1", "brief-a", 1, MESSAGE)

def test_bad_provider_json_and_forged_evidence(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    desk, _ = desk_fixture(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    direct_vm.clear_mocks()
    direct_vm.mock_llm(PATTERN, json.dumps("not JSON"))
    with direct_vm.expect_revert("Classification missing"):
        desk.adjudicate("bad-json", "brief-a", 1, MESSAGE)
    assert desk.get_decision("bad-json") == ""
    mock(direct_vm, [dict(decisions()[0], source_quote="fabricated", reason="invented"), decisions()[1]])
    desk.adjudicate("safe", "brief-a", 1, MESSAGE)
    stored = json.loads(desk.get_decision("safe"))["items"][0]
    assert stored["source_quote"] == "Deliver one landing page in desktop + mobile layouts."
    assert stored["reason"] != "invented"

def test_view_rejects_unknown_brief(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    desk, _ = desk_fixture(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    with direct_vm.expect_revert("Unknown anchor version"):
        desk.get_remaining_rounds("unknown", 1)

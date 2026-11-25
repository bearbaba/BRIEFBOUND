# { "Depends": "py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0" }
"""BRIEFBOUND contract 1/2: versioned, two-party-approved design briefs.

Deterministically stores exact source spans; only two signatories lock a version.
AI semantic decisions belong to ChangeDesk, not the signing state machine.
"""
import genlayer as gl
from genlayer.types import Address, u32
from genlayer.storage import TreeMap
import json

# The signed source is authoritative. Clause boundaries are deterministic,
# not an LLM interpretation. Semantic adjudication lives in ChangeDesk.
import re

NUMBERS = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
           "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}


def capture(source: str) -> tuple[list[dict], int]:
    if not source.strip() or len(source) > 6000:
        raise gl.vm.UserError("Source must be 1-6000 characters")
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+|\n+", source) if p.strip()]
    if not 1 <= len(parts) <= 48:
        raise gl.vm.UserError("Source must contain 1-48 clause spans")
    rows = []
    caps = []
    ambiguous = False
    for p in parts:
        lower = p.lower()
        cap = re.fullmatch(r"(zero|one|two|three|four|five|six|seven|eight|nine|ten|[0-9]{1,2}) rounds? of layout revisions? (?:is|are) included[.!]?", lower)
        explicit = re.fullmatch(r"layout revision rounds:\s*([0-9]{1,2})[.!]?", lower)
        if cap or explicit:
            value = (cap or explicit).group(1)
            caps.append(NUMBERS[value] if value in NUMBERS else int(value))
            kind = "rounds"
        elif re.search(r"\b(rounds?|revisions?|edits?|changes?|adjustments?)\b", lower):
            # Unknown or conflicting wording must never grant a numeric budget.
            ambiguous = True
            kind = "other"
        elif re.search(r"\b(mobile|desktop|responsive|layout)\b", lower):
            kind = "layout"
        elif re.search(r"\b(language|languages|english|japanese|translation)\b", lower):
            kind = "language"
        else:
            kind = "other"
        rows.append({"kind": kind, "quote": p, "meaning": p})
    return rows, caps[0] if len(caps) == 1 and not ambiguous else -1


class ScopeAnchor(gl.contract.Contract):
    # Each version is immutable after signatures; stored as compact JSON for easy calldata.
    versions: TreeMap[str, str]
    latest: TreeMap[str, u32]
    active: TreeMap[str, u32]

    def __init__(self):
        pass

    def _key(self, brief_id: str, version: int) -> str:
        return brief_id + ":" + str(version)

    def _require_party(self, record: dict) -> str:
        sender = gl.message.sender_address.as_hex.lower()
        if sender not in (record["client"], record["freelancer"]):
            raise gl.vm.UserError("Only brief signatories may perform this action")
        return sender

    def _draft(self, brief_id: str, version: int, source: str,
               client: str, freelancer: str, amendment: str, previous_version: int) -> None:
        clauses, round_limit = capture(source)
        evidence = [
            {"clause_id": self._key(brief_id, version) + ":c" + str(i + 1),
             "kind": c["kind"], "quote": c["quote"], "meaning": c["meaning"],
             "introduced_in": version}
            for i, c in enumerate(clauses)
        ]
        record = {
            "brief_id": brief_id, "version": version, "source": source,
            "amendment": amendment, "previous_version": previous_version,
            "client": client, "freelancer": freelancer,
            "clauses": evidence, "round_limit": round_limit,
            "client_approved": False, "freelancer_approved": False,
            "locked": False, "cancelled": False
        }
        self.versions[self._key(brief_id, version)] = json.dumps(record, sort_keys=True)
        self.latest[brief_id] = u32(version)

    @gl.public.write
    def create_brief(self, brief_id: str, source: str,
                     client_wallet: str, freelancer_wallet: str) -> None:
        if not 1 <= len(brief_id) <= 64 or ":" in brief_id or brief_id.strip() != brief_id:
            raise gl.vm.UserError("Invalid brief_id")
        if int(self.latest.get(brief_id, u32(0))) != 0:
            raise gl.vm.UserError("Brief already exists")
        client = Address(client_wallet).as_hex.lower()
        freelancer = Address(freelancer_wallet).as_hex.lower()
        if client == "0x" + "0" * 40 or freelancer == "0x" + "0" * 40:
            raise gl.vm.UserError("Zero address cannot sign a brief")
        if client == freelancer:
            raise gl.vm.UserError("Two distinct signatories required")
        if gl.message.sender_address.as_hex.lower() != client:
            raise gl.vm.UserError("Client wallet must create the brief")
        self._draft(brief_id, 1, source, client, freelancer, "", 0)

    @gl.public.write
    def propose_amendment(self, brief_id: str, amendment: str) -> None:
        """The amendment is the COMPLETE replacement scope, not a delta."""
        current = int(self.active.get(brief_id, u32(0)))
        if current < 1:
            raise gl.vm.UserError("Previous version requires both approvals")
        previous = json.loads(self.versions[self._key(brief_id, current)])
        self._require_party(previous)
        latest = int(self.latest.get(brief_id, u32(0)))
        if latest != current:
            draft = json.loads(self.versions[self._key(brief_id, latest)])
            if not draft.get("cancelled"):
                raise gl.vm.UserError("Resolve the pending amendment first")
        if amendment.strip() == previous["source"].strip():
            raise gl.vm.UserError("Replacement scope must change")
        self._draft(brief_id, latest + 1, amendment, previous["client"],
                    previous["freelancer"], amendment, current)

    @gl.public.write
    def cancel_amendment(self, brief_id: str, version: int) -> None:
        if version <= 1 or version != int(self.latest.get(brief_id, u32(0))):
            raise gl.vm.UserError("Only the latest pending amendment can be cancelled")
        key = self._key(brief_id, version)
        record = json.loads(self.versions[key])
        self._require_party(record)
        if record["locked"] or record["cancelled"]:
            raise gl.vm.UserError("Amendment is not pending")
        record["cancelled"] = True
        self.versions[key] = json.dumps(record, sort_keys=True)

    @gl.public.write
    def approve_version(self, brief_id: str, version: int) -> None:
        if version != int(self.latest.get(brief_id, u32(0))):
            raise gl.vm.UserError("Only the latest draft can be approved")
        key = self._key(brief_id, version)
        raw = self.versions.get(key, "")
        if not raw:
            raise gl.vm.UserError("Unknown brief version")
        record = json.loads(raw)
        sender = self._require_party(record)
        if record["locked"]:
            raise gl.vm.UserError("Version already locked")
        if record["cancelled"]:
            raise gl.vm.UserError("Version was cancelled")
        if sender == record["client"]:
            if record["client_approved"]:
                raise gl.vm.UserError("Client already approved")
            record["client_approved"] = True
        else:
            if record["freelancer_approved"]:
                raise gl.vm.UserError("Freelancer already approved")
            record["freelancer_approved"] = True
        record["locked"] = record["client_approved"] and record["freelancer_approved"]
        if record["locked"]:
            self.active[brief_id] = u32(version)
        self.versions[key] = json.dumps(record, sort_keys=True)

    @gl.public.view
    def get_latest_version(self, brief_id: str) -> int:
        return int(self.latest.get(brief_id, u32(0)))

    @gl.public.view
    def get_active_version(self, brief_id: str) -> int:
        return int(self.active.get(brief_id, u32(0)))

    @gl.public.view
    def get_protocol_version(self) -> str:
        return "briefbound-snapshot-v3"

    @gl.public.view
    def get_version(self, brief_id: str, version: int) -> str:
        return self.versions.get(self._key(brief_id, version), "")

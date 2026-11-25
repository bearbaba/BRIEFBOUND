"""Read-only preflight against the exact Studio RPC; no wallet or signed writes."""
import json
from pathlib import Path
import urllib.request
import time

RPC = "https://studio.genlayer.com/api"

def call(method, params):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    for attempt in range(3):
        try:
            req = urllib.request.Request(RPC, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.load(response)
            if data.get("error"):
                raise RuntimeError(str(data["error"]))
            if "result" not in data or data["result"] is None:
                raise RuntimeError("Missing result")
            return data["result"]
        except Exception as exc:
            print(f"{method} attempt {attempt+1}: {exc}", flush=True)
            if attempt == 2:
                raise
            time.sleep(3)

chain = call("eth_chainId", [])
assert int(chain, 16) == 61999, f"Wrong network: {chain}"
print("PASS chain ID 61999", flush=True)
fees = call("sim_getFeeConfig", [])
assert isinstance(fees, dict) and fees, "Missing fee config"
print("PASS current fee policy available", flush=True)
for name in ("ScopeAnchor", "ChangeDesk"):
    code = Path(f"contracts/{name}.py").read_bytes()
    schema = call("gen_getContractSchemaForCode", ["0x" + code.hex()])
    assert isinstance(schema, (str, dict)) and schema, f"{name}: missing schema"
    if isinstance(schema, str):
        schema = json.loads(schema)
    assert isinstance(schema, dict) and schema, f"{name}: invalid schema"
    expected = ("create_brief", "approve_version", "get_version") if name == "ScopeAnchor" else ("adjudicate", "get_decision", "get_anchor_address")
    encoded = json.dumps(schema)
    for method in expected:
        assert method in encoded, f"{name}: missing method {method}"
    print(f"PASS {name}: hosted GenVM schema loaded; expected methods present", flush=True)
print("PASS read-only preflight. Constructor execution, actual fee quote and signed writes remain separate checks.", flush=True)

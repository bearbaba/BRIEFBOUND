# BRIEFBOUND — Studio deployment gate

## Studio v0.123 migration (candidate)

- Target: genlayer-js 2.0.0, genlayer-test 0.30.0 and the announced GenVM v0.4 runner.
- Every deploy and write requires a fee estimate and explicit fee distribution; verify status, consensus and execution separately.
- Legacy/unknown fee policy blocks signing. Do not deploy the migration candidate until the new runner passes CI.
- For manual Studio deployment, inspect the fee estimate in the Studio UI before approving. If unavailable, stop.

- Current runner API: explicit imports, gl.contract.Contract, gl.vm.run_nondet and gl.contract.get_at. Linter 0.11.1rc2 and manager release v0.6.0-rc14 are pinned for this migration.
- Reference: https://github.com/genlayerlabs/skills/blob/main/plugins/genlayer-dev/skills/write-contract/SKILL.md

## Before signing

- The source release must pass frontend tests/typecheck/build, Python compile, GenVM lint/check and direct-mode regression tests.
- Use GenLayer Studionet (chain 61999), not mainnet. No private keys or paid AI services are required.
- Deployment is not complete until the user signs and confirms actual execution on the supported explorer.

## Order

1. Deploy `contracts/ScopeAnchor.py` in GenLayer Studio. Constructor: no arguments.
2. Wait for FINALIZED, accepted consensus and successful execution; record the contract address and deployment transaction.
3. Deploy `contracts/ChangeDesk.py`. Constructor `anchor_address`: the exact address from step 1.
4. Verify `get_anchor_address()` equals ScopeAnchor and that the two contracts are readable.
5. Configure Vercel public variables `NEXT_PUBLIC_SCOPE_ANCHOR_ADDRESS` and `NEXT_PUBLIC_CHANGE_DESK_ADDRESS`. Deploy and verify the production website. Keep signing disabled until correct addresses are configured.
6. Run a new test case with distinct client and freelancer test wallets. Create v1, approve twice, adjudicate v1, propose amendment, approve v2 twice, adjudicate the identical request with a fresh decision ID. Check both immutable decisions and quoted source evidence. Optional: propose and confirm a revision round with separate signers.

Direct-mode mocked AI tests are not live consensus or real cross-contract execution evidence. The app distinguishes transaction finalization from receipt success and from contract state returned by a public view.

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

## Hosted schema preflight

GitHub-hosted runner requests to the Studio RPC returned HTTP 403 (even eth_chainId). This is an external network access limitation, not a contract validation pass or fail. Use the hosted application's fixed-source read-only `/api/contract-preflight` endpoint instead. CI verifies that both bundled source strings exactly match the deployable Python files. A schema pass does not execute constructors or establish live consensus. The CLI preflight script remains available for environments authorized to reach Studio RPC.

## ChangeDesk consensus regression candidate

The initial live adjudication and one controlled retry finalized without consensus. The new candidate independently reclassifies the same source and compares one-to-one request labels and supporting quote spans, rejecting omitted requests, changed labels, fabricated evidence and ambiguous matching. Validator replay is required before deployment. Keep the existing ScopeAnchor and locked brief; if the candidate passes, deploy a new ChangeDesk instance pointing at the existing anchor. Do not upgrade or overwrite the old instance. No live consensus result is claimed until a new signed test completes.

## Amendment reliability candidate

Two live amendment calls failed: one majority disagreement and one provider JSON decoding exception. Preserve all approved historical clauses; extract only the proposed amendment, track introduced_in, and require two fresh signatures. Both contracts retry malformed provider JSON once, then fail closed. Existing conflicting round counts remain conservatively unknown. The candidate requires fresh deployment of both contracts if in-place upgrade cannot be independently established as safe; old addresses and their evidence must be retained. No live success claimed.

## Snapshot-v3 audit candidate (supersedes earlier candidates)

Anchor writes are deterministic: exact sentence/line spans, bounded explicit layout-round grammar, immutable full replacement snapshots, distinct signers, cancellable pending amendments, and separate active/latest pointers. ChangeDesk performs independent AI classification of the exact effective signed snapshot and compares normalized action, decision, exact signed clause, and revision flag. The contract derives citations and reasons itself. This deliberately changes amendment input semantics: provide the entire replacement source, not a delta. The new contract pair requires fresh deployment; retain the old pair and historical receipts. Do not deploy until all regression tests and schema preflight pass. Actual AI consensus is not guaranteed. No release has been made.

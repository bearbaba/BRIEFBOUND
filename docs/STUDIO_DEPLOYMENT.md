# BRIEFBOUND — Studio deployment gate

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

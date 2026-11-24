# BRIEFBOUND — Review the request, verify the clause

**One-liner:** BRIEFBOUND links each design revision to the signed-off brief so clients and freelancers can see what is included, extra, or still unclear.

## Exactly two GenLayer Intelligent Contracts

1. **contracts/ScopeAnchor.py** — A client proposes an original written brief. GenLayer extracts individually quoted clauses through LLM consensus with independent validator assessment. Client and freelancer must each approve to lock version 1. Amendments append to the source and require the same two signatures before version 2 becomes locked.
2. **contracts/ChangeDesk.py** — Accepts a natural-language change message and calls the deployed ScopeAnchor **directly** to read the specific locked version. GenLayer proposes separately classified tasks as INCLUDED, CHANGE_ORDER or NEEDS_CLARIFICATION, with source quotations and independent validator review. Each decision record stores the original version and is immutable. A revision round is consumed only after the other signer confirms. Separate typed counters prevent round-ID collisions; consumed rounds remain across amendments, and ambiguous or exhausted round limits fail closed. New rounds require the current locked version. Historical decisions remain readable.

All source and verdict information is publicly readable on-chain. Source statements are the signatories' assertions, not proof of legal obligations or a substitute for a signed contract.

## Reviewer case (3-minute walkthrough)

In the **Reviewer lab** tab:

1. Read the default brief: desktop + mobile landing page, two layout rounds, English-only handoff.
2. Read the default message: "Please tighten the spacing on mobile and add a Japanese version."
3. Confirm the bounded local preview classifies mobile spacing as INCLUDED and Japanese as CHANGE_ORDER with precise supporting brief quotes.
4. Toggle v2 with the addendum "Japanese-language delivery is included alongside English for the same landing page. This replaces the previous English-only restriction." The **same message** now gives INCLUDED for Japanese. v1 remains visible.
5. Replace the brief language with "We support multiple languages" without enumerating languages; Japanese must be NEEDS_CLARIFICATION.

The deterministic preview illustrates **expected behavior**, not the result of a real GenLayer validator vote.

## How to verify on GenLayer

**Deployment is not claimed or verified by this repository.** The project ships deployable-intent Python sources, not fabricated addresses.

1. Deploy ScopeAnchor (no constructor arguments). Then deploy ChangeDesk passing the actual ScopeAnchor address as constructor argument.
2. Set **NEXT_PUBLIC_SCOPE_ANCHOR_ADDRESS** and **NEXT_PUBLIC_CHANGE_DESK_ADDRESS** in Vercel. Public addresses only. Never enter any private key into an environment file.
3. Select the **Live GenLayer** tab. Client wallet creates the brief; both signer wallets approve v1.
4. A signer adjudicates v1 using a unique decision ID. Read the exact decision and its referenced version.
5. A signer proposes the Japanese amendment. Both signers approve v2. Rerun the **identical original message** using a new decision ID and version 2.
6. Check the public readbacks for both decision IDs, source quotations and version references. Check **FINALIZED and successful execution**, not transaction submission alone.
7. Optional: propose a round, then sign its confirmation with the other party. Unilateral proposal does not consume a round.

## Local development

Node 22+ recommended: **npm install**, **npm run dev**, **npm run test**, **npm run typecheck**, **npm run build**.

Files: **app/page.tsx** contains the compact UI; **lib/demo.ts** is deliberately bounded deterministic reviewer logic; **lib/genlayer.ts** uses the consensus-aware GenLayerJS v0.6/legacy wallet client; **fixtures/review.json** contains editable steward cases; **tests/demo.test.ts** tests preview behavior; **.github/workflows/ci.yml** verifies TypeScript/build and Python syntax, pinned GenVM SDK validation, and direct-mode regressions with mocked AI and external views.

No database, API key, paid model or wallet custody is required for the local preview. GenLayer transactions may consume network test tokens. The contracts still require actual compatible GenVM deployment and real consensus tests.

## Scope and caveats

- Only the holder of a specified signatory wallet can approve its role.
- Decisions are immutable; a change must use a new ID and may reference a different signed brief version.
- No automatic legal conclusion: ambiguous entitlement should receive NEEDS_CLARIFICATION.
- Content is untrusted data, not executable instruction. Validator quality and transaction finality must be tested on the target network.
- **Unverified:** contract addresses, cross-contract GenVM execution, finalization receipts and post-deployment E2E tests. Do not describe the source-only state as production-ready.

Official documentation: https://docs.genlayer.com/developers/intelligent-contracts/examples/snippets

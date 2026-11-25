# Studionet snapshot v3 — 25 November 2026

Builder-provided Studio and Explorer receipts: both deployments FINALIZED / Accepted / SUCCESS and all ten method calls FINALIZED / MAJORITY_AGREE / FINISHED_WITH_RETURN in Normal mode, with five initial validators. These are historical testnet records, not simulated preview output.

- ScopeAnchor: `0xF1680ca841121757D36943C49FF46e018FB02555`
- ChangeDesk: `0x12A3135aB8d18630c16eCc235EbCbD9679C78F46`
- Source: [tested commit a35d40a](https://github.com/bearbaba/BRIEFBOUND/tree/a35d40ad6a970196a1fbf770928394e8ba32f929); [CI run](https://github.com/bearbaba/BRIEFBOUND/actions/runs/45536611889).
- Brief: `briefbound-v3-01`

| Step | Transaction hash |
|---|---|
| Deploy ScopeAnchor | `0xba45f3183fee1bb8109102bdd1529abc0d9849a8e70dd86989c1042a9422017c` |
| Deploy ChangeDesk | `0xbc9e97110fdbf482f5f34db02fd4e14f32d9e608a6e3d50e3886fa48aa37430d` |
| Create brief v1 | `0x986f69d09390a70f0ed738e11ece32a35ff6d00b35cf12bc34f3d279e3b67346` |
| Client approve v1 | `0x31fa98f655b134dededfd03a3d9c30c77039faead7295d842032874f0ed1cffe` |
| Freelancer approve v1 | `0x78efbd20dc84054beba3113a01ab37a99066f744aebe1987658e692f38550151` |
| Adjudicate v1 | `0x0db14d541ab63961c89caac74abc53a330d0d2f829c4c002bbfe23d0d329a1ad` |
| Propose replacement v2 | `0x530c0f94c2c291c76b169bf87dcd99933b082fd9c86d2fd7c4a76209b034a19b` |
| Client approve v2 | `0xd2d8c9d4ca6841874d0bdf0b3e92a6a9fa4c44b8c7ad59f33a8cd8d1646087ab` |
| Freelancer approve v2 | `0xdb39f29b018e5170f25d9edcff7d13d137dbe259a153de5e0ccd7469147262ef` |
| Adjudicate v2 | `0x667ac3fa115ca64698a4aa7571d97197c482a167d41e06e10337d1ca84564541` |
| Propose round | `0xd6602ed33b942cb3dcd7d79577903e448069cea7fedcfb678896707a6d5f95e5` |
| Confirm round | `0x63d36481800cfbcbcade750cb78e8127abe6c5a5ba71f195760548bbb4b3ef81` |

Search the hashes at https://explorer-studio.genlayer.com/ or import the two contract addresses into https://studio.genlayer.com/.

## Readbacks

Original scope: Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English only.

Replacement scope: Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English and Japanese.

Identical message: Please tighten the spacing on mobile and add a Japanese version.

| Decision ID | Version | Mobile spacing | Japanese | Rounds at decision |
|---|---|---|---|---|
| briefbound-v3-01-v1 | 1 | INCLUDED | CHANGE_ORDER | 2 |
| briefbound-v3-01-v2 | 2 | INCLUDED | INCLUDED | 2 |

Both stored decisions cite the corresponding exact signed scope clauses. After v2 adjudication, reading v1 again returned the unchanged original verdict, version and source evidence. The v2 record returned the new language clause and both INCLUDED labels. The builder subsequently proposed and confirmed round `briefbound-v3-01-r1` with distinct signers, and reported `get_remaining_rounds("briefbound-v3-01", 2) = 1`.

## Limits

This demonstrates the happy-path versioned workflow and one round consumption. It is not an external security audit, an exhaustive adversarial live test, or evidence of a separate browser-signed production workflow. Direct-mode regression tests mock AI and cross-contract views; these receipts demonstrate actual cross-contract consensus in the tested case.

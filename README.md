# Kairo — the private wallet for Starknet

> A consumer wallet that makes STRK20 private balances feel like a normal wallet.
> Receive, hold, and send privately — the cryptography stays hidden.

Kairo is an **Umbra-style privacy wallet** built on the live [STRK20 privacy
pool](https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a)
on Starknet **mainnet**. It is the answer to the STRK20
[Privacy Wallet RFP](https://strk20.starknet.io/rfp/privacy-wallet): *"Whoever
builds it owns the default entry point to STRK20 for normal users."*

## Why

STRK20 gives Starknet real privacy — shielded balances, private transfers,
stealth accounts — but today a normal user has to understand viewing keys,
notes, nullifiers and discovery services to use any of it. Kairo hides all of
that behind a wallet that feels ordinary: you get a receive address, money
shows up, you send it privately. The complexity lives in the SDK, not in the
user's head.

## What it does

- **One-tap setup** — connect Ready, and your first shield registers your viewing key for you. No new seed, nothing extra to back up.
- **Private receive address** — publish a privacy-pool address anyone can pay to.
- **Incoming money discovery** — runs the discovery service against your viewing
  key to surface notes people have sent you.
- **Private send** — a private transfer through the pool. No STRK needed in
  your wallet — a small network fee is taken from your shielded balance.
- **Shield / unshield** — move funds between your public balance and your
  private balance.
- **Zero crypto jargon** — no keys, notes, or nullifiers shown to the user.

## How it works

```
first use        →  generate + register viewing key   (one-time, on-chain)
receive          →  publish pool receive address  →  discovery finds notes
hold             →  shielded balance = sum of your unspent notes
send (private)   →  Withdraw / CreateEncNote through the pool, paymaster gas
in / out         →  shield (public → private) · unshield (private → public)
```

## Architecture: two routes, one app

Kairo ships **both** STRK20 integration routes behind a route switch
(`Wallet | SDK key` in the navbar). Below is the transparent breakdown of how
each RFP requirement is delivered:

| RFP requirement | Wallet route (mainnet, Ready) | SDK route (in-app key) | Status |
|---|---|---|:---:|
| **1. Generate + register viewing keys on first use** | Capability probe on connect + guided first-use registration in Ready (registration is immutable; a dapp must never register for a wallet-held account). | `Generate throwaway key` → `Generate + register viewing key` in the app: canonical derivation + SDK `register()` → `ViewingKeySet` ([`lib/sdk.ts`](./lib/sdk.ts)). | ✅ Both |
| **2. Publish receive address anyone can pay to** | Receive screen (QR + address) + on-chain `get_public_key` pre-check. | Same screens, same pre-check (`isRegistered` over RPC). | ✅ 100% In-App |
| **3. Run discovery against the viewing key** | Ready runs discovery; Kairo surfaces `wallet_strk20Balances`. | Kairo runs `ContractDiscoveryProvider` over plain RPC — no hosted indexer needed ([verified live](./scripts/check-sdk.mjs)). | ✅ Both |
| **4. Sends as `Withdraw` / `CreateEncNote`, paymaster gas** | `strk20InvokeTransaction` via the AVNU forwarder (`0x0127…584f`) — Ready's own paymaster deal. | SDK-built proofs; sponsored relay via AVNU (`app/api/paymaster/*`, `sponsored_private`) with self-pay fallback. | ✅ Both |
| **5. Wallet-grade UI, crypto under the hood** | The entire product: dashboard, Shield, Transfer, Unshield, Receive, Activity, PWA, `?demo=1`, zero jargon. | Same UI — only the data source changes. | ✅ 100% In-App |

### Custody (SDK route)

The embedded key is encrypted with AES-GCM-256 (PBKDF2-SHA256, 600k
iterations) before anything touches storage ([`lib/keystore.ts`](./lib/keystore.ts)).
Plaintext lives only in memory while unlocked; lock wipes it, forget wipes
everything. Auditor disclosure (viewing key, detection-only) and diagnostics
export live in the SDK setup card.

### Why the wallet route still matters on mainnet

The standalone SDK route needs a hosted proving service. On **Sepolia** it's
public (`transaction-prover.alpha-sepolia.sw-dev.io`); on **mainnet it is
unpublished** (hackathon issue #124, open). So today every mainnet entry goes
through a wallet — Ready is currently the only one with the STRK20 dapp API,
and its proofs + AVNU submission are what the [`strk20.json`](./strk20.json)
hashes verify. The day StarkWare publishes the URL, mainnet SDK lights up via
one env var (`NEXT_PUBLIC_PROVING_URL_MAINNET`) with zero code changes.

### Env vars (all optional)

| Var | Purpose | Default |
|---|---|---|
| `PAYMASTER_API_KEY` (server-only) | Sponsored SDK submits via AVNU. Unset → self-pay fallback, wallet route unaffected. | unset |
| `NEXT_PUBLIC_PROVING_URL_MAINNET` | Mainnet SDK proving service, when published. | unset (Sepolia prover is public) |

No env vars needed for the wallet route or the Sepolia SDK demo:
`npm i && npm run dev` just works.

---

## Verified On-Chain Transactions

Kairo provides verified transaction proofs on both **Starknet Mainnet** and **Sepolia Testnet**:

### Mainnet Submission Transactions ([`strk20.json`](./strk20.json))
Verified via `node scripts/verify-txs.mjs`:

| Action | Mainnet Transaction Hash | Emitted Pool Events |
|---|---|---|
| **Register & Shield** | [`0x12e721f7…cacddd`](https://voyager.online/tx/0x12e721f700a3da9376e22ca0b08671f0d9850690629ad301f794e70f6cacddd) | `ViewingKeySet×1`, `Deposit×1`, `EncNoteCreated×1`, `Withdrawal×1` |
| **Private Transfer 1** | [`0x57c040e1…0e8379`](https://voyager.online/tx/0x57c040e1df55b25ddfc5ea92087b1b48e30e01b1e8a23bc8627b96ad40e8379) | `EncNoteCreated×2`, `Withdrawal×1` |
| **Private Transfer 2** | [`0x7d4fbdc1…1a6a94`](https://voyager.online/tx/0x7d4fbdc13606d38af79e0a1f0d0d54e43504ab55a43ba5f23ad28d0d11a6a94) | `EncNoteCreated×2`, `Withdrawal×1` |

### Sepolia Proof-of-Concept Transactions (Literal SDK Route)
Built and submitted directly by Kairo's own code — originally via
[`scripts/register-sepolia.mjs`](scripts/register-sepolia.mjs), now productized
in-app as the SDK route ([`lib/sdk.ts`](./lib/sdk.ts), [`lib/sdk-store.ts`](./lib/sdk-store.ts);
verify the read path live with `node scripts/check-sdk.mjs`):

| Flow | Sepolia Transaction Hash | Emitted Pool Event |
|---|---|---|
| Register | [`0x547902e6…3fa190`](https://sepolia.voyager.online/tx/0x547902e639fd45589a95f28748fc91dc051b44f487d3ece093c20eb023fa190) | `ViewingKeySet` |
| Shield | [`0x379324ff…630993`](https://sepolia.voyager.online/tx/0x379324ff830a7857a5dd5e15bc250c8adacefd61bab98cdeee19f69c2630993) | `Deposit` |
| Private Send | [`0x2cab08aa…1efbc`](https://sepolia.voyager.online/tx/0x2cab08aa1535537cd40d05ca2ef735814788671266d3a3ce9a95a1a2b51efbc) | `EncNoteCreated` |
| Unshield | [`0x42439753…e4ebf`](https://sepolia.voyager.online/tx/0x42439753e2d8d097d032fa2b5d3ec34d0ef15e976e7a8ebde65af19f80e4ebf) | `Withdrawal` |

---

## Built on

- **STRK20 privacy pool** (mainnet): `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- **STRK20 Wallet API** (`starknet.js@10.4.0`, `WalletAccountV6`) — the wallet
  holds the viewing key and builds the STARK proofs; Kairo drives it via
  `wallet_strk20Balances` / `wallet_strk20InvokeTransaction`.
- **Wallet discovery** — `@starknet-io/get-starknet` v6 (wallet-standard)
- **Fees** — every pool action costs ~6 STRK; Kairo shows the fee up front and
  reserves it from every Max
- **Starter kit reference** — [`Akashneelesh/strk20-starter-kit`](https://github.com/Akashneelesh/strk20-starter-kit)
- **Wallet** — [Ready](https://www.ready.co) (the only wallet with the STRK20
  dapp API on mainnet today; support is runtime-probed, and non-STRK20 wallets
  get a graceful explainer)

## Tech stack

- Next.js 16 (App Router) + React 19 + Tailwind v4
- `starknet@10.4.0` + `@starknet-io/get-starknet-*` v6 + zustand
- **Installable PWA** — manifest + icons; add to your phone's home screen for
  the "mobile" half of the RFP (web + installable, one codebase)
- Starknet mainnet — `CHAIN_ID = SN_MAIN`, keyless public RPC
  (`rpc.starknet.lava.build`) — no env vars needed; `npm i && npm run dev` just works
- `?demo=1` renders the full UI on sample data (no wallet needed)

## Verifying submission transactions

`node scripts/verify-txs.mjs` checks the transactions in `strk20.json` the way a
judge would: on mainnet, `SUCCEEDED`, and emitting a STRK20 pool event — now with
labelled events, so a pass shows exactly what each tx did
(`Deposit×1`, `EncNoteCreated×1`, `ViewingKeySet×1`, …).

```bash
$ node scripts/verify-txs.mjs
✅ 0x12e721f700a3da9376e22ca0b08671f0d9850690629ad301f794e70f6cacddd
   SUCCEEDED · ACCEPTED_ON_L2 · ViewingKeySet×1, Deposit×1, EncNoteCreated×1, Withdrawal×1
   viewing key registered ✓
✅ 0x57c040e1df55b25ddfc5ea92087b1b48e30e01b1e8a23bc8627b96ad40e8379
   SUCCEEDED · ACCEPTED_ON_L2 · 0x247fc60d…×1, EncNoteCreated×2, Withdrawal×1
✅ 0x7d4fbdc13606d38af79e0a1f0d0d54e43504ab55a43ba5f23ad28d0d11a6a94
   SUCCEEDED · ACCEPTED_ON_L2 · 0x247fc60d…×2, EncNoteCreated×2, Withdrawal×1

All 3 transaction(s) pass the submission checks.
```

## Status

🚧 Built for the STRK20 Private Sprint (Aug 14–31, 2026).

- [x] Viewing key setup — probe via `strk20Balances`; first in-Ready shield
      registers the key (there is deliberately no dapp-side register), with
      guided onboarding for unregistered users
- [x] Receive — QR + address, payments land in the shielded balance
- [x] Shield / unshield — real `deposit` / `withdraw` actions with confirmation
- [x] Private send — real `transfer` action; tx hash surfaced with copy +
      Voyager link
- [x] Real balances — shielded via the Wallet API, public via RPC
- [x] SDK route in-app — embedded key (password-encrypted), self-registration,
      contract discovery, SDK shield/send/unshield, AVNU sponsored relay with
      self-pay fallback, auditor disclosure, diagnostics export
- [x] P1 reliability — prover retry, simulate-first gas checks, bounded waits,
      background discovery polling
- [x] 3 mainnet proof transactions in `strk20.json` (`node scripts/verify-txs.mjs` checks them)
- [ ] 3-min demo video + deployed demo URL

## Hackathon submission

Verifiable submission data lives in [`strk20.json`](./strk20.json): three
mainnet transactions that touch the STRK20 pool, any contracts we deploy, and
the demo video/URL.

## Submission runbook (what's left, in order)

Requires a human (wallet approvals, funding, recording) — code is ready:

1. **Sepolia SDK click-through** — open the app, switch to `SDK key`,
   generate a throwaway with a password, fund it at `faucet.starknet.io`,
   `Generate + register viewing key`, then Shield → private Send → Unshield.
   Keep the tx hashes (proves the in-app literal route end to end).
2. **(Optional) Sponsored-mode footage** — set `PAYMASTER_API_KEY` on the
   deployment, redo one Send, confirm the footer reads
   `sends via paymaster relay`.
3. **Record the demo** — follow [`docs/demo-script.md`](./docs/demo-script.md)
   (≤3:00, real mainnet Ready pass for the scoring txs, `?demo=1` b-roll only).
4. **Deploy** — `npm run build` is green; deploy and put the URL in
   `strk20.json` → `demo_url`, video link in `demo_video`.
5. **Re-verify** — `node scripts/verify-txs.mjs` must print all-✅ before you
   submit.

## License

[MIT](./LICENSE)

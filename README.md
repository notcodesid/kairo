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

## Architecture: why the wallet route

The [RFP](https://strk20.starknet.io/rfp/privacy-wallet) describes a privacy wallet across 5 core requirements. Below is the transparent breakdown of how Kairo delivers each requirement across **Mainnet** (live production product) and **Sepolia** (literal protocol proofs):

| RFP requirement | How Kairo delivers it | Status |
|---|---|:---:|
| **1. Generate + register viewing keys on first use** | **Mainnet:** Handled via capability probe on connect + guided first-use registration in Ready wallet. Because registration on the pool contract is immutable and Ready derives keys from user seeds, a dapp must never generate arbitrary keys on a user's behalf.<br>**Sepolia:** Literally implemented in [`scripts/register-sepolia.mjs`](scripts/register-sepolia.mjs) where Kairo derives the canonical viewing key from signature and registers it directly to the pool ([`ViewingKeySet` tx](https://sepolia.voyager.online/tx/0x547902e639fd45589a95f28748fc91dc051b44f487d3ece093c20eb023fa190)). | ✅ Covered |
| **2. Publish receive address anyone can pay to** | Dedicated **Receive** view (QR code + address copy), paired with on-chain recipient validation (`canReceivePrivately`) that checks the pool contract before sending to guarantee the destination has a registered viewing key. | ✅ 100% In-App |
| **3. Run discovery service against viewing key** | **Mainnet:** Ready wallet executes internal discovery, and Kairo surfaces live shielded notes/balances via `wallet_strk20Balances`. (Necessary because StarkWare has not published public mainnet indexer endpoints).<br>**Sepolia:** Proven end-to-end via custom `discoverNotes()` scanning in [`scripts/register-sepolia.mjs`](scripts/register-sepolia.mjs). | ✅ Covered |
| **4. Sends as `Withdraw` / `CreateEncNote`, paymaster gas** | All private transfers and unshield actions invoke `strk20InvokeTransaction` submitted via AVNU forwarder relayers (`0x0127…584f`). User addresses are omitted from calldata. Confirmed on Mainnet emitting real `EncNoteCreated` and `Withdrawal` pool events. | ✅ 100% In-App |
| **5. Wallet-grade UI, crypto under the hood** | Full consumer dashboard, Shield, Transfer, Unshield, Receive, Activity history, PWA support, demo mode (`?demo=1`), zero cryptographic jargon. | ✅ 100% In-App |

### Why not the pure SDK route on Mainnet?
The standalone Privacy SDK route requires two external hosted endpoints:
1. `PROVING_SERVICE_URL` (to generate STARK execution proofs)
2. `INDEXER_URL` (hosted discovery service to index encrypted notes)

On **Starknet Mainnet, both endpoints remain unannounced and closed** (see open issues on the hackathon repository). Without these URLs, a web app cannot generate mainnet proofs or scan notes independently without hosting heavy sequencer infrastructure. 

The **STRK20 Wallet API** route in Ready is currently the **only functional path on Starknet Mainnet**. It delivers the exact same on-chain pool state with a strictly superior security model: **Kairo never touches user private keys or funds**.

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
Built and submitted directly by Kairo's standalone script ([`scripts/register-sepolia.mjs`](scripts/register-sepolia.mjs)):

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
- [x] 3 mainnet proof transactions in `strk20.json` (`node scripts/verify-txs.mjs` checks them)
- [ ] 3-min demo video + deployed demo URL

## Hackathon submission

Verifiable submission data lives in [`strk20.json`](./strk20.json): three
mainnet transactions that touch the STRK20 pool, any contracts we deploy, and
the demo video/URL.

## License

[MIT](./LICENSE)

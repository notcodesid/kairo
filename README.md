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

The [RFP](https://strk20.starknet.io/rfp/privacy-wallet)'s bullet list reads as
"the app holds the viewing key, runs discovery, and builds pool actions
itself" — the Privacy-SDK route. We deliberately built on the **STRK20 Wallet
API** instead, where the Ready wallet holds the key and builds the proofs:

| RFP requirement | How Kairo delivers it |
|---|---|
| Generate + register viewing keys on first use | Two implementations. **(a)** For wallet-held accounts: capability probe on connect + guided first-use registration — registration is immutable and Ready derives its own key, so a dapp must never register on a Ready user's behalf. **(b)** Literally, for accounts Kairo controls: [`scripts/register-sepolia.mjs`](scripts/register-sepolia.mjs) derives the canonical viewing key from the account's signature and registers it through the pool — proven on Sepolia: [`ViewingKeySet` tx `0x547902e6…3fa190`](https://sepolia.voyager.online/tx/0x547902e639fd45589a95f28748fc91dc051b44f487d3ece093c20eb023fa190). |
| Publish a receive address anyone can pay to | Receive screen (QR + address), plus an on-chain pre-check that a send recipient can actually receive privately. |
| Run discovery against the viewing key | Ready runs discovery; Kairo surfaces the results (`wallet_strk20Balances`). |
| Sends as `Withdraw` / `CreateEncNote`, paymaster gas | Kairo's send/unshield produce exactly `EncNoteCreated` / `Withdrawal` pool events, relayer-submitted — the user's address never appears in calldata. |
| Wallet-grade UI, crypto under the hood | The entire product. |

Why not the SDK route? Its two required endpoints — the mainnet proving
service and a hosted discovery indexer — are **not publicly available** (see
the hackathon repo's open issues). The wallet route ships the same on-chain
outcome on mainnet **today**, with a strictly smaller trust surface in the
dapp: Kairo never touches keys, proofs, or user funds. The on-chain result is
byte-for-byte what the RFP describes; only the executor differs.

On **Sepolia**, both endpoints *are* public — so we proved the entire RFP
loop end-to-end via the SDK route, every transaction built and submitted by
Kairo's own code ([`scripts/register-sepolia.mjs`](scripts/register-sepolia.mjs)):

| Flow | Sepolia tx |
|---|---|
| Register (`ViewingKeySet`) | [`0x547902e6…3fa190`](https://sepolia.voyager.online/tx/0x547902e639fd45589a95f28748fc91dc051b44f487d3ece093c20eb023fa190) |
| Shield (`Deposit`) | [`0x379324ff…630993`](https://sepolia.voyager.online/tx/0x379324ff830a7857a5dd5e15bc250c8adacefd61bab98cdeee19f69c2630993) |
| Private send (`CreateEncNote`) | [`0x2cab08aa…1efbc`](https://sepolia.voyager.online/tx/0x2cab08aa1535537cd40d05ca2ef735814788671266d3a3ce9a95a1a2b51efbc) |
| Unshield (`Withdrawal`) | [`0x42439753…e4ebf`](https://sepolia.voyager.online/tx/0x42439753e2d8d097d032fa2b5d3ec34d0ef15e976e7a8ebde65af19f80e4ebf) |

Discovery ran against our registered viewing key between each step, surfacing
the encrypted notes (`open=false`) with coherent balances (100 → 90 STRK).
Reproduce with `--generate` → register → `--deposit` → `--discover` → `--send`
→ `--withdraw`.

## Built on

- **STRK20 privacy pool** (mainnet): `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- **STRK20 Wallet API** (`starknet.js@10.4.0`, `WalletAccountV6`) — the wallet
  holds the viewing key and builds the STARK proofs; Kairo drives it via
  `wallet_strk20Balances` / `wallet_strk20InvokeTransaction`. No proving
  service or indexer of our own — by design.
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
(`Deposit×1`, `EncNoteCreated×1`, `ViewingKeySet×1`, …). The RFP task-1 evidence
(a throwaway Sepolia registration) can be checked with
`node scripts/verify-txs.mjs --sepolia <hash>`.

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
- [ ] 3 mainnet proof transactions in `strk20.json` (`node scripts/verify-txs.mjs` checks them)
- [ ] 3-min demo video + deployed demo URL

## Hackathon submission

Verifiable submission data lives in [`strk20.json`](./strk20.json): three
mainnet transactions that touch the STRK20 pool, any contracts we deploy, and
the demo video/URL.

## License

[MIT](./LICENSE)

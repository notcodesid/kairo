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
- Starknet mainnet — `CHAIN_ID = SN_MAIN`, keyless public RPC
  (`rpc.starknet.lava.build`) — no env vars needed; `npm i && npm run dev` just works
- `?demo=1` renders the full UI on sample data (no wallet needed)

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

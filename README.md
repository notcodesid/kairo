# Veil — the private wallet for Starknet

> A consumer wallet that makes STRK20 private balances feel like a normal wallet.
> Receive, hold, and send privately — the cryptography stays hidden.

Veil is an **Umbra-style privacy wallet** built on the live [STRK20 privacy
pool](https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a)
on Starknet **mainnet**. It is the answer to the STRK20
[Privacy Wallet RFP](https://strk20.starknet.io/rfp/privacy-wallet): *"Whoever
builds it owns the default entry point to STRK20 for normal users."*

## Why

STRK20 gives Starknet real privacy — shielded balances, private transfers,
stealth accounts — but today a normal user has to understand viewing keys,
notes, nullifiers and discovery services to use any of it. Veil hides all of
that behind a wallet that feels ordinary: you get a receive address, money
shows up, you send it privately. The complexity lives in the SDK, not in the
user's head.

## What it does

- **One-tap setup** — generates and registers your viewing key on first use.
- **Private receive address** — publish a privacy-pool address anyone can pay to.
- **Incoming money discovery** — runs the discovery service against your viewing
  key to surface notes people have sent you.
- **Private send** — spends notes as `Withdraw` / `CreateEncNote` through the
  pool, with **gas sponsored by a paymaster** so users never need STRK to move.
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
- **STRK20 Privacy SDK** — viewing keys, notes, discovery, proofs
- **Paymaster** — sponsored gas so users transact without holding STRK
- **Starter kit** — [`Akashneelesh/strk20-starter-kit`](https://github.com/Akashneelesh/strk20-starter-kit)
  (Next.js: wallet picker, shield, unshield, private transfer)
- **Wallets** — Ready (Xverse as fallback)

## Tech stack

- Next.js (App Router) front end
- STRK20 Privacy SDK for pool interaction
- Starknet mainnet — `CHAIN_ID = SN_MAIN`, RPC via Alchemy (key kept in `.env`, never committed)

## Status

🚧 Built for the STRK20 Private Sprint (Aug 14–31, 2026). Work in progress.

- [ ] Viewing key registration
- [ ] Receive address + discovery
- [ ] Shield / unshield
- [ ] Private send with paymaster
- [ ] 3-min demo + mainnet proof transactions

## Hackathon submission

Verifiable submission data lives in [`strk20.json`](./strk20.json): three
mainnet transactions that touch the STRK20 pool, any contracts we deploy, and
the demo video/URL.

## License

[MIT](./LICENSE)

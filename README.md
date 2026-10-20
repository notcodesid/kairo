# kairo — private wallet for starknet

> shield, send, and unshield strk privately on mainnet. feels like a normal wallet, hides real cryptography.

built for the strk20 privacy rfp: *"whoever builds it owns the default entry point to strk20 for normal users."*

## judge start here

- live app: https://kairo.notcodesid.com/
- demo video: https://youtu.be/f5IYXjikYns
- pool (mainnet): `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- proof: [`strk20.json`](./strk20.json) — 3 mainnet txs touching the pool

verify it yourself in 10 seconds:

```bash
npm i && node scripts/verify-txs.mjs
# 0x12e721f7…cacddd — SUCCEEDED · ViewingKeySet×1, Deposit×1, EncNoteCreated×1, Withdrawal×1
# 0x57c040e1…0e8379 — SUCCEEDED · EncNoteCreated×2, Withdrawal×1
# 0x7d4fbdc1…1a6a94 — SUCCEEDED · EncNoteCreated×2, Withdrawal×1
```

each hash also opens directly on voyager, e.g.
https://voyager.online/tx/0x12e721f700a3da9376e22ca0b08671f0d9850690629ad301f794e70f6cacddd

## what it does

- connect ready → first shield registers your viewing key for you. no new seed, nothing extra to back up.
- receive screen (qr + address) anyone can pay privately.
- shield (public → private), private send (no sender linkage onchain), unshield (private → public).
- real balances: shielded via the wallet api, public via rpc. live refresh, no reload needed.
- zero jargon: no keys, notes, or nullifiers on screen.
- auditor disclosure: viewing key reveal, detection only — sees everything, moves nothing.

## how it works

```
first use  →  connect → first shield registers viewing key (one-time, on-chain)
receive    →  publish address → discovery finds your notes
hold       →  shielded balance = sum of unspent notes
send       →  private transfer through the pool, only recipient detects it
in / out   →  shield · unshield, every step confirmed + linked on voyager
```

two routes, one ui:
- **wallet route** — ready holds the key and builds the stark proofs. mainnet works today.
- **sdk route** — the app holds its own password-encrypted key, runs discovery over plain rpc (no indexer), proves via the starkscan relay (`/api/prove-relay`, allowlisted). same screens, different engine.

every pool action costs ~6 strk fee, shown up front. submits wait on two rpc roads (zan + fallback) with a 5-min cap — never hangs, never double-submits.

## sepolia proof (sdk route, our own code end to end)

| flow | sepolia tx | pool event |
|---|---|---|
| register | [`0x547902e6…3fa190`](https://sepolia.voyager.online/tx/0x547902e639fd45589a95f28748fc91dc051b44f487d3ece093c20eb023fa190) | `ViewingKeySet` |
| shield | [`0x379324ff…630993`](https://sepolia.voyager.online/tx/0x379324ff830a7857a5dd5e15bc250c8adacefd61bab98cdeee19f69c2630993) | `Deposit` |
| private send | [`0x2cab08aa…1efbc`](https://sepolia.voyager.online/tx/0x2cab08aa1535537cd40d05ca2ef735814788671266d3a3ce9a95a1a2b51efbc) | `EncNoteCreated` |
| unshield | [`0x42439753…e4ebf`](https://sepolia.voyager.online/tx/0x42439753e2d8d097d032fa2b5d3ec34d0ef15e976e7a8ebde65af19f80e4ebf) | `Withdrawal` |

read path check: `node scripts/check-sdk.mjs`

## run it

```bash
npm i && npm run dev   # localhost:3000, no env needed for wallet route
```

env (all have working defaults, override only to move infra):

| var | what |
|---|---|
| `NEXT_PUBLIC_RPC_URL_MAINNET` | proof-capable rpc (default zan) |
| `NEXT_PUBLIC_RPC_URL_MAINNET_FALLBACK` | second road when the first dies |
| `NEXT_PUBLIC_PROVING_URL_MAINNET` | `/api/prove-relay` for sdk sends |
| `STARKSCAN_API_KEY` (server only) | relay auth, never `NEXT_PUBLIC_` |
| `PAYMASTER_API_KEY` (server only) | avnu sponsored sends; unset = self-pay |
| pool / explorer / sepolia vars | see [`.env.example`](./.env.example) |

`NEXT_PUBLIC_*` bakes at build time — redeploy after changing.

## stack

next.js 16 + react 19 + tailwind v4 · `starknet@10.4.0` · `@starknet-io/get-starknet` v6 · avnu paymaster · starkscan prover relay · installable pwa · `?demo=1` sample-data mode.

## status

built for the strk20 private sprint (aug 14–31, 2026).

- [x] viewing key setup, receive, shield / unshield, private send — all real mainnet txs
- [x] sdk route in-app — encrypted key, self-registration, contract discovery, relay proving, sponsored relay w/ self-pay fallback, auditor disclosure
- [x] reliability — rpc failover, prover retry, simulate-first gas checks, bounded waits, live balance polling, silent wallet reconnect
- [x] 3 mainnet proof txs in `strk20.json`
- [x] demo video + deployed url

## license

[MIT](./LICENSE)

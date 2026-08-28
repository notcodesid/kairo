# Day 0 — Can we reach the STRK20 pool on mainnet?

Goal: prove a private transaction is possible for us at all, before committing 8 days.
Budget: 1 hour. Real money — use an amount you would not mind losing.

## Verified mainnet values

```
CHAIN_ID     = SN_MAIN   (0x534e5f4d41494e)
RPC_URL      = https://rpc.starknet.lava.build
POOL_ADDRESS = 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
```

Pool on Voyager:
https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a

## Phase 0 — Prep

- [ ] Install **Ready** wallet (formerly Argent). NOT Braavos — confirmed `wallet_strk20Balances → Not implemented` on mainnet.
- [ ] Switch the wallet to **Mainnet**.
- [ ] Fund it with **STRK** via NEAR Intents (near.com / near-intents.org): Stellar USDC -> Starknet STRK.
      One hop, non-custodial, no KYC, ~30s. CEXes are a dead end below ~5 USDC.
      **Budget: 35-40 STRK minimum.** Verified costs per pool action:
        6 STRK protocol fee (get_fee_amount, read from mainnet) + ~3 STRK gas (median; observed up to 5.5)
        => three actions cost ~27 STRK floor, BEFORE anything you shield.
      2.1 USDC ~= 80 STRK, which is comfortable.

> [!WARNING]
> **Stellar deposits REQUIRE A MEMO.** The deposit address is shared by everyone
> (GDJ4JZXZ... holds 34k USDC from many senders). The memo is the ONLY thing tying
> the transfer to you. Sent 2026-08-26 03:00:16Z without one: 1 USDC lost to the pool.
> Paste the memo into Freighter's memo field and read it back before signing.

Ready wallet address (confirmed): 0x00cDfA296c7F37FE5515bf00F493C6e74fEe20cB9074A3d3ba0058a88e623B7e

## Phase 1 — The critical test

- [ ] Open https://strk20.starknet.io/app
- [ ] Connect the Ready wallet
- [ ] **Register viewing key** (one-time, on-chain, emits `ViewingKeySet`)
      -> tx hash: ________________________
- [ ] **Shield** a small amount of STRK (emits `Deposit(user_addr, token, amount)`)
      -> tx hash: ________________________
- [ ] Do a **third** pool action (second shield, or a private transfer)
      NOTE: do all three as SEPARATE transactions. The app can batch register+shield
      into one apply_actions call, which would leave you 2 hashes instead of 3.
      -> tx hash: ________________________

### DECISION POINT
If register + shield both succeed -> path confirmed, we build.
If they fail -> record the exact error and stop. No idea discussed is buildable without this.

## Phase 2 — Confirm the transactions counted

- [ ] Open your address on https://voyager.online
- [ ] Find the pool interactions, confirm each: exists, succeeded, carries a STRK20 pool event

Expected and NOT a bug: private transactions are submitted by **rotating shared relayers**.
The sender will be a relayer with a nonce in the hundreds of thousands, and your address
appears nowhere in the calldata. Eligibility is checked against the `user_addr` in the
pool's own `Deposit` event, not the tx sender.

## Phase 3 — Record them

- [ ] Put the three hashes in `strk20.json` at the root of our repo:

```json
{
  "transactions": ["0x...", "0x...", "0x..."]
}
```

- [ ] **Leave `contracts` empty for now.** Adding a contract address means every listed
      transaction must ALSO carry an event from one of our contracts — which would
      invalidate these three. Add contracts only once our own contract txs are live.

## If it fails

- [ ] Try **Xverse** — the STRK20 walkthroughs name "Ready or Xverse".
- [ ] Open an issue on https://github.com/starkience/strk20-hackathon (team reads daily).
- [ ] Note that 5 issues asking for the mainnet proving service URL are already open and
      unanswered: #121, #124, #135, #147, #158.

## Report back

1. Did Ready connect, and did the app show a shielded balance?
2. Register tx hash + result
3. Shield tx hash + result
4. Exact error text if anything failed

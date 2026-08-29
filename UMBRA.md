# Umbra — Deep Reference (0 → 100)

> Research dossier compiled to inform the **STRK20 Privacy Wallet** build (the RFP asks for
> "Umbra-style UX on Starknet's privacy pool"). Everything below is verified against the actual
> `ScopeLift/umbra-protocol` source, the ERC-5564/6538 specs, Starknet SNIPs, and STRK20's docs.
> Where a fact could not be confirmed from a primary source it is marked **[unverified]**.

---

## ⚠️ Read this first: there are TWO different "Umbra"s

The name collides. They share nothing but the word.

| | **Umbra** (`umbra.cash`) — **THE ONE WE CARE ABOUT** | **Umbra Privacy** (`umbraprivacy.com`) — the one you linked |
|---|---|---|
| Chain | EVM (Ethereum, Polygon, Optimism, Arbitrum, Base) | Solana |
| Mechanism | **Stealth addresses** (ECDH, secp256k1, on-chain announcements) | Shielded **pool** + zk-proofs + encrypted balances |
| Team | **ScopeLift** (Ethereum dev shop) | Umbraprivacy Ltd / Phoenix DAO, incubated by Arcium |
| Born | HackMoney 2020, mainnet 2021 | Mainnet alpha Feb 2026 |
| Token | None | UMBRA |
| App | Web only | Web + iOS + Android |

**Why this matters for us:** the STRK20 RFP phrase *"publish once, receive privately, spend freely"*
is **ScopeLift Umbra's** exact model. That is the **UX blueprint** we are asked to copy. So this
document is about **ScopeLift's Umbra**.

The irony worth knowing: STRK20's *underlying technology* (a shielded pool with a real anonymity
set) is actually closer to the **Solana** `umbraprivacy.com`. So the build is:
**ScopeLift-Umbra's receive/spend UX, layered on a shielded-pool backend.** (See §11.)

---

## Table of contents
1. What Umbra is (the one-paragraph mental model)
2. The user experience (setup → send → receive → spend)
3. The cryptography under the hood
4. Smart contracts (on-chain)
5. Discovery / scanning (how you find your money)
6. Gasless spending (relayers / meta-transactions)
7. The SDK (`umbra-js`)
8. Privacy & threat model (what it hides, what it leaks)
9. Standards: ERC-5564 & ERC-6538
10. Fees, chains, deployed addresses
11. **Mapping Umbra → STRK20** (the payoff section)
12. Sources

---

## 1. What Umbra is (mental model)

Umbra lets someone pay you in ETH or an ERC-20 **without the payment being publicly tied to your
identity**. You publish two public keys once (tied to your ENS name). Anyone can then pay you: their
wallet secretly derives a brand-new, single-use **stealth address**, sends the funds there, and posts
an on-chain **Announcement** that only you can recognize as yours. You scan announcements with a
**viewing key** to find your payments, and control the funds with a separate **spending key**.

**"Publish once, receive privately, spend freely":**
- **Publish once** — one-time on-chain registration of your spending + viewing public keys.
- **Receive privately** — each payment lands at a fresh address unlinked to you on-chain.
- **Spend freely** — only you can derive the private key of that address, so only you move the money, to wherever you want, whenever.

**Critical limitation to internalize:** Umbra hides *who owns the receiving address*. It does **not**
hide the **amount**, the **token**, or the **sender** — those are all public. There is **no anonymity
set** (it is *not* a mixer). This is the single biggest difference from STRK20 (§8, §11).

---

## 2. The user experience

### 2.1 First-time setup (once, ever)
1. Go to `app.umbra.cash`, **connect wallet** (MetaMask, Coinbase Wallet, Rainbow…).
2. Select a supported network.
3. On **Setup**: **sign a message**. Umbra hashes that signature to deterministically derive **two**
   keypairs — a **spending key** and a **viewing key**. (This keeps your main wallet's private key
   untouched by Umbra.)
4. **Submit one transaction** that publishes your two *public* keys on-chain in the
   `StealthKeyRegistry`. Done forever — senders now find you by ENS name/address.

### 2.2 Sending (the payer's flow)
1. On **Send**: enter recipient's **ENS name / CNS name / 0x address**. Umbra looks up their two published pubkeys.
2. Pick **amount** and **token** (ETH or ERC-20).
3. Confirm. Under the hood the wallet derives a one-time stealth address, sends funds there, and emits an encrypted Announcement.
4. **Minimum send** exists so the received amount can cover its own future withdrawal gas. No maximum. Batch-send is supported.

### 2.3 Receiving (the recipient's flow)
- On **Receive**: click **scan**. The app pulls **all** Announcement events and tests each with your
  viewing key. Matches are your payments.
- **This is the UX weak point:** scanning is O(n) over every announcement ever made — ScopeLift calls
  it "an open problem." No push notifications; you must actively scan.

### 2.4 Spending / withdrawing
- Once a payment is found, withdraw it to any address — **no lockup**.
- **ETH**: lands directly at the stealth address (which now holds ETH for gas) → self-withdraw.
- **ERC-20**: held by the Umbra contract; withdraw via a **relayer** who pays gas and takes a fee
  *in the received token* (so you never have to fund the anonymous address with ETH — §6).
- **Hygiene warning the app enforces:** do **not** withdraw to an address that owns an ENS name or
  POAPs, or you re-link the funds to your identity (§8).

---

## 3. The cryptography under the hood

Curve: **secp256k1**. Key agreement: **ECDH** (non-interactive — the recipient is never online).
`G` = generator, `n` = curve order, `·` = scalar-mult, `+` = point-add.

### 3.1 The two keys, and why there are two
| Keypair | Private / Public | Job |
|---|---|---|
| **Spending** | `p_spend` / `P_spend = p_spend·G` | Authorizes **spending**. Kept cold. |
| **Viewing** | `p_view` / `P_view = p_view·G` | **Detects** incoming payments by scanning. **Cannot spend.** |

The split is the whole point: you can hand `p_view` to a scanning service / auditor so it can find
(or reveal) your receipts **without any ability to move funds**. Detection needs only `p_view` +
public `P_spend`; spending additionally needs `p_spend`.

### 3.2 Umbra's ACTUAL scheme (v1, in production) — *multiplicative*
Verified from `umbra-js` source. This differs from the ERC-5564 standard scheme (§3.3).

**Sender** (paying recipient with pubkeys `P_spend`, `P_view`):
1. Draw a random 32-byte scalar `r` (the "random number").
2. **Stealth pubkey** `P_stealth = P_spend · r`; stealth address = `addr(P_stealth)`.
3. Ephemeral keypair `e` / `E = e·G`. Shared secret `s = sha256(ECDH(e, P_view))`.
4. **Encrypt** `r`: `ciphertext = r XOR s`.
5. Emit **Announcement**(`receiver = addr(P_stealth)`, `amount`, `token`, `pkx = E.x`, `ciphertext`).

**Recipient** (scanning):
1. `s = sha256(ECDH(p_view, E))`  (ECDH is symmetric: `e·P_view = p_view·E`).
2. `r = ciphertext XOR s`.
3. Candidate = `addr(P_spend · r)`. If it equals `receiver`, **this payment is mine**.

**Spend:** stealth private key `p_stealth = (p_spend · r) mod n`. Check: `p_stealth·G = p_spend·r·G = P_spend·r = P_stealth`. ✓

Note: Umbra only stores `pkx` (the x-coordinate); its shared-secret hash discards the point's parity
byte, so `pky` isn't needed.

### 3.3 The standardized scheme (ERC-5564 "scheme 1", used by Umbra **v2**) — *additive*
1. Ephemeral `e` / `E = e·G`. `s_h = keccak256(e·P_view)`.
2. **View tag** `v = s_h[0]` (1 byte, scanning speedup — §5).
3. `P_stealth = P_spend + s_h·G`; spend key `p_stealth = (p_spend + s_h) mod n`.

Difference in one line: **v1 multiplies by a random `r` sent encrypted; v2/ERC-5564 adds the hashed
ECDH secret and ships a view tag instead of a ciphertext.**

---

## 4. Smart contracts

Small, **non-upgradeable**, minimal admin. Two core contracts + two periphery helpers.

### 4.1 `Umbra.sol` (core payment hub, Solidity ^0.7.6, `Ownable`)
- **ETH sentinel:** `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`.
- **State:** `toll`, `tollCollector`, `tollReceiver`, and
  `mapping(stealthAddr => mapping(token => amount)) tokenPayments`.

**Send:**
```solidity
function sendEth(address payable receiver, uint256 tollCommitment, bytes32 pkx, bytes32 ciphertext) external payable;
function sendToken(address receiver, address tokenAddr, uint256 amount, bytes32 pkx, bytes32 ciphertext) external payable;
```
- `sendEth`: ETH is **forwarded straight to the stealth address** (not custodied).
- `sendToken`: tokens are **pulled into the contract and custodied**; `tokenPayments[receiver][token]`
  set. A given (stealth address, token) can be funded **only once**.

**The Announcement event (the only thing recipients scan):**
```solidity
event Announcement(
  address indexed receiver,  // stealth address
  uint256 amount,            // PLAINTEXT
  address indexed token,     // PLAINTEXT (ETH sentinel for native)
  bytes32 pkx,               // ephemeral pubkey x-coordinate
  bytes32 ciphertext         // encrypted random number (+ y-parity hint)
);
```

**Withdraw:**
```solidity
function withdrawToken(address acceptor, address tokenAddr) external;                 // self, pays own gas
function withdrawTokenOnBehalf(address stealthAddr, address acceptor, address tokenAddr,
                               address sponsor, uint256 sponsorFee,
                               uint8 v, bytes32 r, bytes32 s) external;                 // relayer pays gas
// + withdrawTokenAndCall / …AndCallOnBehalf variants with a post-withdraw hook
```

### 4.2 `StealthKeyRegistry.sol` (the "publish once" phone book, Solidity ^0.8.7)
- **No admin, not upgradeable.** Users fully own their records.
- Stores each user's spending + viewing pubkeys (compressed → prefix + 32-byte x).
- `setStealthKeys(...)` (self) and `setStealthKeysOnBehalf(..., v, r, s)` (**EIP-712** meta-registration).
- Emits `StealthKeyChanged(registrant, spendingPubKeyPrefix, spendingPubKey, viewingPubKeyPrefix, viewingPubKey)`.
- ⚠️ This is Umbra's **own** registry — conceptually ERC-6538-like but **predates and does not
  implement** the ERC-6538 interface.

### 4.3 Periphery
- **`UmbraBatchSend`** — pay many recipients in one tx (input must be sorted by token).
- **`UniswapWithdrawHook`** — example hook that swaps the withdrawn token via Uniswap on withdrawal.

### 4.4 Trust surface
Owner of `Umbra` can only set the toll + toll addresses — it **cannot touch user funds**, freeze,
or redirect withdrawals. `StealthKeyRegistry` has no admin at all.

---

## 5. Discovery / scanning (how you find your money)

**Verdict: fully client-side scanning, accelerated by an indexer.** This is the highest-risk layer to
reproduce and the one the RFP explicitly calls out ("run a discovery service against viewing keys").

- **The loop** (`umbra-js` `Umbra.scan(spendingPublicKey, viewingPrivateKey)`): fetch every
  announcement (paged), and for each: decrypt with `p_view` → get candidate `r` → compute
  `addr(P_spend · r)` → compare to the event's `receiver`. Match ⇒ yours. **O(n)**, ~2 EC-mults +
  a hash **per announcement**.
- **The viewing key never leaves the browser** in the official app. The hosted infra only serves
  **raw, still-encrypted** announcements — it never sees your viewing key and does no matching.
- **Scaling trick — an indexer, not less work:** Umbra puts a **subgraph / Ponder indexer** in front
  of the chain (reached via a hosted `/api/ponder` GraphQL proxy with rate limiting), so the wallet
  streams announcements page-by-page instead of hammering RPC.
  - Raw-RPC `getLogs` scanning is a **fallback that is deliberately banned on Optimism/Polygon/Base**
    (blocks too fast) — a subgraph URL is **required** there or the build fails.
- **No view tag in Umbra v1** → no early-exit filter → every announcement pays full crypto cost.
  (ERC-5564 view tags, in v2, cut this ~6× — §9.)
- **Latency:** no push. Visibility = indexer freshness + your poll cadence (seconds→~a minute after
  confirmation). Narrow `startBlock` (e.g. to your registration block) so each poll only tests new events.

**Design choice for STRK20:** Umbra proves you *can* keep discovery fully client-side (max privacy),
but it needs an indexer to be usable. A **hosted discovery service that ingests viewing keys** (what
the RFP describes) is easier + gives push-style UX, but the service then learns your **entire incoming
payment graph**. Pick a point on that spectrum deliberately.

---

## 6. Gasless spending (relayers / meta-transactions)

The core problem: a fresh stealth address holds an ERC-20 but **0 ETH for gas**, and topping it up
from your real wallet would **leak the link**.

**Umbra's answer — `withdrawTokenOnBehalf`:** the recipient signs an authorization; a **relayer**
submits the tx, pays ETH gas, and is reimbursed **in the withdrawn token** (`sponsorFee`).

**What is signed** (EIP-191 `personal_sign` over an ABI-encoded blob — *not* EIP-712):
```
keccak256(abi.encode(chainId, umbraAddress, acceptor, tokenAddr, sponsor, sponsorFee, hook, data))
```
- Binds destination, relayer, and fee → a relayer **cannot** redirect funds, inflate its fee, or swap the sponsor.
- **No nonce.** Replay is prevented structurally: the balance is `delete`d on withdrawal, so a re-submit finds 0 and reverts. A signature is effectively one-shot.
- **ETH vs ERC-20 asymmetry:** ETH goes straight to the stealth EOA (it has gas, self-withdraw). Only ERC-20s need the relayer. This asymmetry is an EVM/EOA limitation.
- Relayers are **permissionless at the contract level**; ScopeLift runs a default first-party relayer for the app. Historically compatible with GSN + a Uniswap swap-to-pay-gas path.

---

## 7. The SDK (`umbra-js`)

| Fact | Value |
|---|---|
| npm | `@umbracash/umbra-js` |
| Latest | **0.2.2** (2026-03-10) — **actively maintained** |
| Deps | `ethers@5.7.2` (⚠️ **v5**, not v6), `@noble/secp256k1`, `@unstoppabledomains/resolution` |
| Reference frontend | **Vue 3** (⚠️ **not React** — no official hooks; port the composables) |
| Exports | `Umbra`, `KeyPair`, `RandomNumber`, `StealthKeyRegistry`, `utils`, `ens`, `cns` |

```typescript
import { Umbra, KeyPair, StealthKeyRegistry } from '@umbracash/umbra-js';
const umbra = new Umbra(provider, chainId);

// 1. Derive keys from a wallet signature (no raw key management)
const { spendingKeyPair, viewingKeyPair } = await umbra.generatePrivateKeys(signer);
//    (signs "Sign this message to access your Umbra account…", sha256s each half of the sig)

// 2. Register once on-chain
const registry = new StealthKeyRegistry(signer);
await (await registry.setStealthKeys(spendingKeyPair.publicKeyHex, viewingKeyPair.publicKeyHex)).wait();

// 3. Send
const { tx, stealthKeyPair } = await umbra.send(signer, tokenAddrOr'ETH', amount, 'recipient.eth');

// 4. Scan (spending PUBLIC key + viewing PRIVATE key)
const { userAnnouncements } = await umbra.scan(spendingKeyPair.publicKeyHex, viewingKeyPair.privateKeyHex);

// 5. Withdraw — derive the stealth key first, then either self-withdraw or relay
const stealth = spendingKeyPair.mulPrivateKey(userAnnouncements[0].randomNumber);
await umbra.withdraw(stealth.privateKeyHex, 'ETH', destination);           // self (ETH)
const { v, r, s } = await Umbra.signWithdraw(stealth.privateKeyHex, chainId, umbraAddr,
                                             dest, token, sponsor, sponsorFee);
await umbra.withdrawOnBehalf(relayerSigner, stealth.address, dest, token, sponsor, sponsorFee, v, r, s);
```

`scan()` returns `UserAnnouncement { amount, from, isWithdrawn, randomNumber, receiver, timestamp, token, txHash }`.
Run `yarn docs` in `umbra-js` for the full TypeDoc.

---

## 8. Privacy & threat model

### 8.1 What it protects vs. leaks
| Property | Hidden? | Note |
|---|---|---|
| Recipient identity ↔ receiving address | ✅ (its **only** job) | …if hygiene is good |
| **Amount** | ❌ | Plaintext in the event |
| **Token** | ❌ | Plaintext in the event |
| **Sender** | ❌ | Public; sender always knows they paid you |
| Stealth address & that a payment happened | ❌ | Public → graph-analyzable |
| **Anonymity set** | ❌ **none** | Not a mixer — hiding = unlinkability, not a crowd |
| Selective disclosure to an auditor | ✅ | Hand over the viewing key → reveal receipts, no spend power |

### 8.2 Stealth addresses ≠ mixer/shielded pool
- **Stealth addresses (Umbra):** break the **receiver identity ↔ address** link. No anonymity set. Amounts public. No zk.
- **Mixer / shielded pool (Tornado, Aztec, Zcash, STRK20):** break the **sender ↔ receiver** link via a shared pool + zk-proofs; can hide amounts; strength grows with the anonymity set.

### 8.3 Real-world deanonymization (empirical)
The arXiv paper *"Anonymity Analysis of the Umbra Stealth Address Scheme"* (Kovács & Seres, 2308.01703)
recovered the real recipient of **~26–66%** of Umbra payments (48.5% mainnet) using four behavioral
heuristics. Translate these into **hard rules for our wallet**:
1. **Never fund a stealth address's gas from a doxxed wallet** (ERC-5564: the funding wallet MUST have no link to the owner). → use relayers.
2. **Don't consolidate** multiple stealth receipts into one destination (links them).
3. **Never withdraw to an ENS/POAP-owning or otherwise known address** (the app warns on this).
4. **Amount & timing correlation:** public round amounts and unique priority-fee values link in↔out. (Relayer withdrawals defeat the fee heuristic, since the relayer sets the fee — another reason relayers are core, not optional.)
5. **RPC/indexer sees your scanning** — metadata leak to whoever serves announcement data. **[partly inferred]**

### 8.4 Compliance posture
Stealth addresses are viewed differently from mixers (no pooling/co-mingling). Umbra does **client-side
OFAC/sanctioned-address filtering**, and the viewing/spending key split enables **voluntary selective
disclosure** to an auditor without surrendering custody.

---

## 9. Standards: ERC-5564 & ERC-6538

- **ERC-5564 (Stealth Addresses)** — co-authored by ScopeLift + Nerolation + Vitalik. Standardizes
  `generateStealthAddress` / `checkStealthAddress` / `computeStealthKey`, a singleton **Announcer**
  contract, and **view tags** (1 byte of the hashed shared secret published per announcement → skip
  full parsing ~255/256 of the time, ~6× faster scan; security margin 128→124 bits, privacy-only cost).
- **ERC-6538 (Stealth Meta-Address Registry)** — the standardized "publish once" registry mapping an
  identity → stealth **meta-address** `st:eth:0x<spendPub><viewPub>`, keyed by `schemeId`.
  `registerKeys` / `registerKeysOnBehalf` (EIP-712 / EIP-1271, with a nonce).
- Umbra **v2** (in progress, ~90%) migrates onto both standards.

---

## 10. Fees, chains, deployed addresses

- **Fees:** a per-payment **toll** (owner-set flat ETH fee, historically **~0**) + a **relayer fee**
  taken in-token on ERC-20 withdrawals. Exact live values **[unverified]** — read `toll()` on-chain.
- **Chains:** Ethereum, Optimism, Polygon, Arbitrum, Base (Gnosis historically; Sepolia testnet).
- **Deployed addresses (same on every chain, CREATE2):**
  - Umbra core: `0xFb2dc580Eed955B528407b4d36FfaFe3da685401`
  - StealthKeyRegistry: `0x31fe56609C65Cd0C510E7125f051D440424D38f3`
  - UmbraBatchSend: `0xDbD0f5EBAdA6632Dde7d47713ea200a7C2ff91EB`
- **Lifetime scale** (ScopeLift, Feb 2026): ~350k txs, ~$500M transacted, ~100k unique senders.
- **Audit:** Consensys Diligence, March 2021.

---

## 11. Mapping Umbra → STRK20 (the payoff)

**STRK20 is a note-based shielded pool on Starknet** (encrypted notes, Cairo + Stwo STARK proofs,
mandatory viewing keys, an FPI-operated auditor master key). It has the privacy properties Umbra
*lacks*. The RFP asks us to put **Umbra's receive/spend UX** on top of it.

### 11.1 What comes from the POOL vs. the Umbra-style UX layer
- **From the STRK20 pool (crypto core — Umbra has none of these):** real **anonymity set**, **hidden
  amounts inside the pool**, **sender↔receiver unlinkability**, double-spend safety via zk-proofs.
  ⚠️ But the pool **boundary still leaks**: deposit/withdraw amounts and "someone touched the pool"
  stay visible — only what happens *inside* is hidden. (Same shape as Tornado's deposit/withdraw edges.)
- **From the Umbra-style UX layer (what we build):** publish-once viewing-key registration,
  scan-to-discover receiving, and gasless withdrawal. These are **usability + anti-linkage** wins;
  they do **not** by themselves create privacy — the pool does that.

### 11.2 Concept-by-concept map
| Umbra (EVM) | STRK20 / Starknet equivalent | Notes |
|---|---|---|
| `generatePrivateKeys` (sig → spend/view keys) | Viewing-key setup at first use | STRK20 viewing key is **mandatory** to deposit |
| `StealthKeyRegistry.setStealthKeys` | On-chain `ViewingKeySet` registration | Emitted per DAY0 notes |
| `send` → Announcement event | Pool **`Deposit(user_addr, token, amount)`** / `CreateEncNote` | Eligibility checked against `user_addr` in the event, not tx sender |
| `scan` (client-side, O(n)) | **Discovery service run against viewing keys** (RFP) | Umbra keeps it client-side + indexer; RFP suggests a hosted discovery service |
| `withdrawTokenOnBehalf` (signature relayer) | **Paymaster-sponsored withdrawal** (SNIP-9 + SNIP-29) | Starknet-native, strictly simpler & more capable (below) |
| Rotating first-party relayer | **AVNU paymaster forwarder** (`0x0127021a…584f`) | on-chain sender is a rotating whitelisted relayer; your address absent from calldata — verify sends via pool events (`Deposit(user_addr,…)`), never via tx sender |

### 11.3 Gasless spend: Starknet is *easier* than Umbra
Umbra hand-rolls a signature-relayer in Solidity because EVM EOAs can't be moved by third parties.
**Starknet has native account abstraction**, so this is a platform feature:
- **SNIP-9 "Execute From Outside"** = the direct analog of `withdrawTokenOnBehalf`, but with a **real
  nonce + time window** and **arbitrary calls** (withdraw + transfer + swap in one signed object).
- **SNIP-29 "Paymaster API"** standardizes the relayer/fee handshake. Two modes:
  - **sponsored** → user pays **zero** gas (the literal "paymaster-sponsored gas" of the RFP),
  - **default** → user pays the fee in any ERC-20 (the analog of Umbra's "pay gas in the received token").
- **AVNU** runs a production paymaster (`https://starknet.paymaster.avnu.fi`, open-source/self-hostable);
  **`starknet.js`** consumes it directly (`feeMode: { mode: 'sponsored' }`). **No bespoke relayer contract needed.**

### 11.4 The five things the wallet must do (RFP), each grounded in Umbra
1. **Generate + register a viewing key** ← Umbra §2.1 / §7 `generatePrivateKeys` + registry.
2. **Publish a receive address** ← Umbra "publish once" / ENS identity (§1).
3. **Discovery service against viewing keys** ← Umbra scanning (§5) — decide client-side vs hosted.
4. **Sends = pool withdrawals w/ paymaster gas** ← Umbra `withdrawOnBehalf` → Starknet paymaster (§11.3).
5. **UI hides all crypto** ← Umbra's key-split + relayer + "as easy as Venmo" (§2, §6).

### 11.5 Pitfalls to carry over (or fix)
- **Scanning is the UX bottleneck** — don't reproduce Umbra's "scan everything" slowness naively;
  lean on STRK20's discovery service / an indexer, and scan only from the registration block.
- **Amounts leak at the pool boundary** — set user expectations; the "private" part is inside the pool.
- **Withdrawal-destination hygiene** — the same deanonymization heuristics (§8.3) apply at the unshield edge.
- **STRK20 fee is unsettled** — the Starknet blog says ~4 STRK/shielded tx; this repo's `DAY0-CHECK.md`
  measured ~6 STRK protocol fee + ~3 STRK gas per action. Confirm on mainnet before designing UX. **[unverified]**

### 11.6 The gate that precedes all of this
None of the above is buildable until STRK20's mainnet primitives (register viewing key + shield +
paymaster/relayer withdrawal) are proven to work for us. That is exactly what
[`DAY0-CHECK.md`](DAY0-CHECK.md) tests. Run it first.

---

## 12. Sources

**ScopeLift Umbra (code & docs)**
- https://github.com/ScopeLift/umbra-protocol
- `Umbra.sol`, `StealthKeyRegistry.sol`, `UmbraBatchSend.sol`, `umbra-js/src/classes/{Umbra,KeyPair,StealthKeyRegistry}.ts`, `umbra-js/src/utils/sharedSecret.ts`, `netlify/functions/ponder.mjs` (all on `raw.githubusercontent.com/ScopeLift/umbra-protocol/master/…`)
- https://www.npmjs.com/package/@umbracash/umbra-js
- https://scopelift.co/blog/introducing-umbra • …/introducing-umbra-v2-architecture • …/umbra-2025-in-review-and-the-year-ahead
- https://www.bankless.com/sending-stealth-payments-with-umbra
- Deployed contracts: etherscan / polygonscan / optimistic.etherscan / arbiscan / basescan `0xFb2dc580…` & `0x31fe5660…`

**Standards & crypto**
- https://eips.ethereum.org/EIPS/eip-5564 • https://eips.ethereum.org/EIPS/eip-6538
- https://vitalik.eth.limo/general/2023/01/20/stealth.html
- https://arxiv.org/abs/2308.01703 (Umbra anonymity analysis) • https://arxiv.org/pdf/2308.01703

**Starknet paymaster / meta-tx**
- https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-9.md • …/snip-29.md
- https://docs.avnu.fi/docs/paymaster/index • https://github.com/avnu-labs/paymaster
- https://www.starknet.io/blog/paymaster-the-secret-to-making-dapps-feel-like-web2/

**STRK20**
- https://strk20.starknet.io/ • …/app • …/rfp/privacy-wallet • …/hackathon
- https://www.starknet.io/blog/privacy-live-on-starknet/ • …/compliance-layer-onchain-privacy-strk20/ • …/push-to-private/
- Repo-internal: [`DAY0-CHECK.md`](DAY0-CHECK.md)

**The other "Umbra" (Solana — for disambiguation only)**
- https://umbraprivacy.com • https://docs.umbraprivacy.com • https://messari.io/report/arcium-bringing-privacy-to-solana-with-umbra

> Unverified items are flagged inline. Two facts most worth confirming before building:
> (1) STRK20's real per-tx fee, and (2) whether STRK20 exposes a hosted discovery service or expects
> client-side scanning.

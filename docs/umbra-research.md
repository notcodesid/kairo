# Umbra Privacy → Veil: research & design brief

Internal research doc for **Veil** (our STRK20 privacy wallet). Based on a multi-agent
deep-dive into **Umbra Privacy** (Solana), the product the STRK20 "Privacy Wallet" RFP
tells us to model. Sources are Umbra's own docs/SDK, marketing, app store listings,
first-hand app inspection, and third-party coverage (Aug 2026).

> ⚠️ Two different "Umbra"s. This is **Umbra Privacy on Solana** (umbraprivacy.com,
> built on Arcium MPC). It is **not** `umbra.cash` (ScopeLift's Ethereum stealth-address
> protocol). News that conflates them — e.g. "Umbra shut its frontend after the Kelp
> hack" — is about the *Ethereum* one.

---

## PART A — Umbra deep-dive

### What it is
A consumer privacy wallet on Solana — *"Incognito mode for your money… shield assets with
zero fees, visible to no one but you."* Live to the public since **March 2026** on web,
iOS/Android, and a Chrome extension. Built by **Krutarth "Kru" Shah**, incubated by
**Arcium** (team came out of Elusiv). Funded via a **MetaDAO** ICO (Oct 2025: ~$155M of
demand into a $3M cap, ~10,500 participants). It's the flagship app on Arcium.

### The mental model (this is the important part for us)
Umbra is a **shielded pool**, and money lives in one of two private forms:

| | **Encrypted Token Account (ETA)** | **Stealth Pool Notes** |
|---|---|---|
| Model | Account — encrypted balance | UTXO — commitments in a Merkle tree (a mixer) |
| Hides | The **amount** | The **sender↔recipient link** |
| How | Balance encrypted (Rescue cipher), math done by Arcium MPC | Poseidon commitments; spent via nullifier + Groth16 ZK proof, submitted by a relayer |

**This is almost exactly STRK20's model** (notes = commitments, nullifiers, ZK proofs,
a discovery service, rotating relayers). So Umbra's *UX* patterns port to STRK20 nearly 1:1.

### The core flows
- **Setup:** connect an existing wallet → **sign ONE message** → that signature
  deterministically derives *all* keys (viewing key, spending key, X25519 encryption key)
  → a one-time on-chain registration. **No new seed phrase, nothing extra to back up** —
  your Umbra identity regenerates from your normal wallet. (Keys are non-rotatable; one
  wallet ↔ one identity.)
- **Shield (deposit):** public ATA → encrypted ETA. **Self-deposit = zero protocol fee**
  (the headline "No Fee $0.00").
- **Private send:** write an encrypted note into the shared pool addressed to the
  recipient. Recipient must already be registered. Recipient **scans** (local decrypt with
  their key; private key never leaves device) and **burns/claims** the note into their ETA.
  A **relayer** submits the claim, so the sender never appears as the recipient's
  counterparty and the recipient needs **no SOL** (gasless).
- **Unshield (withdraw):** ETA → public ATA (destination must already exist). 35 bps fee.
- **Discovery:** an off-chain **indexer** (`utxo-indexer.api.umbraprivacy.com`) surfaces
  notes; the SDK's zero-arg scanner tries to decrypt each with your local key — the hits
  are yours.

### Full feature set
Five tabs: **Shield · Private Send · Private Swap · Withdraw · Bridge**. Plus: **Gasless
transfers** (relayer-paid), **Private Mode** (shield the whole wallet), a novel **Distress
Mode** (a decoy/limited balance view for coercion situations), **self-custody**,
**selective disclosure** (viewing keys / auditor grants — "voluntary auditability"), and a
**developer SDK** (`@umbra-privacy/sdk`, v5). Compliance is built in via **Range** risk
screening (99+ chains, OFAC) enforced *at the contract level*, plus geo-blocking.

### Tech stack (named)
BN254 curve · Groth16 zk-SNARKs (snarkjs, in a Web Worker) · Poseidon commitments ·
Indexed Merkle tree (depth 20, ~1.05M leaves) · nullifier treap · Rescue cipher for
balances · X25519+AES-GCM for note discovery · Arcium MPC (n-of-n) for encrypted compute ·
relayer for gasless submission. Fees: **35 bps** (divisor 2^14) on ops, **0 on shielding**,
relayer fee currently **0**, plus a one-time SOL rent fee per note.

### Honest limitations (they apply to STRK20 too)
- It's a **mixer, not magic**: *that* you use the pool is public; **note amounts are
  revealed at spend**; privacy needs an anonymity set at the same denomination; and
  deposit→immediate-withdraw is linkable by timing.
- **No public audit report** and **no hard adoption numbers** (TVL/users/tx). Token is
  ~-87% from ATH on thin volume. So "market leader" claims are thin — but it's a real,
  polished, shipped product.
- A **governance attack** (Aug 2026) tried to drain ~$1.5M from the treasury; MetaDAO's
  futarchy market rejected it. No funds lost.

---

## PART B — Veil design brief (what we actually build)

### Mapping Umbra → STRK20
| Umbra (Solana) | Veil (STRK20) |
|---|---|
| Sign one message → derive keys, no backup | Sign once → silently register the **viewing key** |
| ETA (encrypted balance) | **Shielded balance** (sum of your STRK20 notes) |
| Stealth Pool Notes + burn | STRK20 **notes** + private transfer / withdraw |
| Indexer + local scan | STRK20 **discovery service** + viewing-key scan |
| Relayer (gasless) | **Paymaster**-sponsored gas + rotating relayers |
| "Zero shielding fee" headline | "Send privately, **no gas needed**" |
| Reown/WalletConnect connect | **Ready / Xverse** (Starknet wallet-standard) |

### Copy · Adapt · Drop
- **Copy outright:** one-signature setup with nothing to back up; "one balance + a few big
  action buttons" home; jargon-free consumer tone (no "notes/nullifiers/viewing keys" shown);
  gasless framing as the headline; QR/share for the receive address.
- **Adapt:** Umbra requires the recipient to be pre-registered — the RFP wants us to
  "publish a receive address anyone can pay to," so make **Receive** a first-class screen
  (your address + QR + a live "incoming" list fed by discovery).
- **Drop for the 5-day MVP:** Private Swap, Bridge, Distress Mode, compliance/auditor UI,
  multi-platform (web only), and probably multi-token (ship STRK first).

### MVP screens (buildable in ~5 days, on the Next.js starter kit)
1. **Connect + setup** — connect Ready/Xverse → one signature → auto-register viewing key
   (spinner + "Setting up your private wallet", never expose the key).
2. **Home** — big shielded balance, four buttons: **Shield · Send · Receive · Unshield**,
   recent activity.
3. **Shield** — pick amount → deposit STRK public → shielded.
4. **Receive** — your pool receive address + QR + copy/share; a live incoming-notes list
   (discovery). This is the RFP's differentiator; make it shine.
5. **Send** — recipient address + amount → private transfer, **gas sponsored by paymaster**
   ("No gas needed").
6. **Unshield** — amount → public address.
7. **Activity** — list of shield/send/receive/unshield (optional if time).

### How this maxes the hackathon score
- **Working mainnet product (30%)** — a real wallet a person uses on mainnet.
- **Integration depth (30%)** — viewing key + shielded balance + shield/unshield + private
  transfer + discovery + paymaster = many primitives.
- **Innovation (25%)** — "the consumer front door to STRK20" (the RFP's own thesis: whoever
  builds it owns the default entry point). Optional novel touch: **pay-by-link / payment
  request** (Umbra leans on raw addresses — a shareable request link is a clean edge).
- **Docs (15%)** — clean README (done) + this research shows rigor.

### Top risks / open questions
1. **Day 0 still gates everything** — must prove viewing-key register + shield work on
   STRK20 mainnet (the proving-service availability risk). Nothing here matters until that's green.
2. **STRK20 SDK / discovery service maturity** — confirm the discovery endpoint and scan
   API exist and work on mainnet (Umbra's is polished; STRK20's may be rougher).
3. **Paymaster availability** on STRK20 for sponsored sends — verify before promising "no gas".
4. **Scope** — 5 days. One fully-working flow (shield → receive → send → unshield on STRK)
   beats five half-working features.

---
*This is an internal working doc — not committed/published unless we decide to. Delete or
gitignore before pushing if we'd rather keep the competitor analysis private.*

#!/usr/bin/env node
/**
 * RFP bullet 1, literally: GENERATE and REGISTER a viewing key — on Sepolia,
 * with a throwaway account whose key this script holds. Never run against a
 * wallet-held (Ready) account: registration is immutable and a non-canonical
 * key would permanently break that account's wallet privacy features.
 *
 * Usage:
 *   node scripts/register-sepolia.mjs --generate   # create throwaway, print address to faucet
 *   node scripts/register-sepolia.mjs              # deploy (if needed) + register + verify
 *
 * Key material lives in .sepolia-throwaway.json (git-ignored). Throwaway only.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  Account,
  RpcProvider,
  constants,
  ec,
  hash,
  num,
} from "starknet";
import { createPrivateTransfers } from "@starkware-libs/starknet-privacy-sdk";

const RPC_URL = "https://starknet-sepolia.drpc.org";
const POOL =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const PROVER_URL = "https://transaction-prover.alpha-sepolia.sw-dev.io";
const DISCOVERY_URL = "https://discovery-service.alpha-sepolia.sw-dev.io";
const STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
// OZ account class hash — from starknet-privacy e2e/scripts/deploy-accounts.ts
const OZ_CLASS =
  "0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564";
const KEYFILE = new URL("../.sepolia-throwaway.json", import.meta.url);

/**
 * drpc load-balances across replicas and a few lack some starknet_* methods
 * (spurious -32601). Retry the request — each attempt lands on a different
 * replica — for both network failures and bad-replica responses.
 */
async function resilientFetch(url, init) {
  let lastText = "{}";
  let lastStatus = 502;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      lastText = text;
      lastStatus = res.status;
      let badReplica = false;
      if (res.ok) {
        try {
          const body = JSON.parse(text);
          const items = Array.isArray(body) ? body : [body];
          badReplica = items.some((b) => b?.error?.code === -32601);
        } catch {
          /* non-JSON body — pass through */
        }
      }
      if (!res.ok || badReplica) {
        if (attempt < 6) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
      }
      return new Response(text, {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    } catch {
      if (attempt < 6) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return new Response(lastText, {
    status: lastStatus,
    headers: { "content-type": "application/json" },
  });
}

const provider = new RpcProvider({ nodeUrl: RPC_URL, baseFetch: resilientFetch });

/** Canonical derivation — exact port of demo/src/session.ts (see lib/viewing-key.ts). */
function deriveViewingKey(privateKey, chainId, poolAddress) {
  const MAX = ec.starkCurve.CURVE.n / 2n;
  const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
  const signature = ec.starkCurve.sign(`0x${messageHash.toString(16)}`, privateKey);
  const folded = BigInt(hash.computePoseidonHashOnElements([signature.r, signature.s]));
  const order = ec.starkCurve.CURVE.n;
  const reduced = folded % order;
  const canonical = reduced < MAX ? reduced : order - reduced;
  return canonical === 0n ? 1n : canonical;
}

async function assertClassDeclared() {
  try {
    await provider.getClass(OZ_CLASS, "latest");
  } catch {
    console.error(
      `❌ OZ account class ${OZ_CLASS} is not declared on this network — cannot deploy the throwaway. Stop here and tell the build chat.`,
    );
    process.exit(1);
  }
}

function computeAddress(publicKey) {
  return hash.calculateContractAddressFromHash(publicKey, OZ_CLASS, [publicKey], 0);
}

async function strkBalance(address) {
  const res = await provider.callContract({
    contractAddress: STRK,
    entrypoint: "balanceOf",
    calldata: [address],
  });
  return BigInt(res[0] ?? "0") + (BigInt(res[1] ?? "0") << 128n);
}

async function generate() {
  await assertClassDeclared();
  const privateKey =
    "0x" + Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex");
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const address = computeAddress(publicKey);
  writeFileSync(KEYFILE, JSON.stringify({ privateKey, publicKey, address }, null, 2));
  console.log("✅ Throwaway account generated (key saved to .sepolia-throwaway.json)");
  console.log(`\nADDRESS TO FAUCET (Sepolia STRK):\n${address}\n`);
  console.log("Faucets: https://faucet.starknet.io  ·  https://blastapi.io/faucets/starknet-sepolia-strk");
  console.log("Then run: node scripts/register-sepolia.mjs");
}

async function register() {
  if (!existsSync(KEYFILE)) {
    console.error("No .sepolia-throwaway.json — run with --generate first.");
    process.exit(1);
  }
  const { privateKey, publicKey, address } = JSON.parse(readFileSync(KEYFILE, "utf8"));
  console.log(`Throwaway: ${address}`);

  const bal = await strkBalance(address);
  console.log(`STRK balance: ${Number(bal / 10n ** 12n) / 1e6}`);
  if (bal === 0n) {
    console.error("❌ Not funded yet — faucet some Sepolia STRK to the address above first.");
    process.exit(1);
  }

  const account = new Account({
    provider,
    address,
    signer: privateKey,
    cairoVersion: "1",
  });

  // 1. Deploy the account if this is its first transaction.
  let deployed = true;
  try {
    await provider.getClassHashAt(address);
    console.log("Account already deployed.");
  } catch {
    deployed = false;
  }
  let deployBlock;
  if (!deployed) {
    await assertClassDeclared();
    console.log("Deploying account…");
    const dep = await account.deployAccount({
      classHash: OZ_CLASS,
      constructorCalldata: [publicKey],
      addressSalt: publicKey,
    });
    const receipt = await provider.waitForTransaction(dep.transaction_hash);
    deployBlock = receipt.block_number;
    console.log(`Deployed: ${dep.transaction_hash} (block ${deployBlock ?? "?"})`);
  }

  // 2. GENERATE the viewing key — canonical derivation, our key material.
  const chainId = constants.StarknetChainId.SN_SEPOLIA;
  const viewingKey = deriveViewingKey(privateKey, chainId, POOL);
  console.log("Viewing key derived (canonical recipe).");

  // 3. Already registered? (idempotence)
  const existing = await provider.callContract({
    contractAddress: POOL,
    entrypoint: "get_public_key",
    calldata: [address],
  });
  if (existing.some((f) => BigInt(f) !== 0n)) {
    console.log("✅ Already registered on the pool — nothing to do.");
    console.log(`get_public_key: ${JSON.stringify(existing)}`);
    return;
  }

  // 3b. The pool charges its protocol fee via ERC-20 transferFrom — the
  // account must approve the pool first or apply_actions reverts with
  // "Insufficient ERC20 allowance".
  const u256 = (res) =>
    BigInt(res[0] ?? "0") +
    (res[1] !== undefined ? BigInt(res[1]) << 128n : 0n);
  const fee = u256(
    await provider.callContract({
      contractAddress: POOL,
      entrypoint: "get_fee_amount",
      calldata: [],
    }),
  );
  console.log(`Pool fee: ${Number(fee / 10n ** 12n) / 1e6} STRK`);
  const allowance = u256(
    await provider.callContract({
      contractAddress: STRK,
      entrypoint: "allowance",
      calldata: [address, POOL],
    }),
  );
  if (allowance < fee) {
    const approveAmount = fee * 10n; // headroom for re-runs
    console.log(
      `Approving pool to spend ${Number(approveAmount / 10n ** 12n) / 1e6} STRK…`,
    );
    const ap = await account.execute(
      {
        contractAddress: STRK,
        entrypoint: "approve",
        calldata: [POOL, approveAmount.toString(), "0"],
      },
      { tip: 0n },
    );
    await provider.waitForTransaction(ap.transaction_hash);
    console.log(`Approved: ${ap.transaction_hash}`);
  } else {
    console.log("Allowance already sufficient.");
  }

  // 4. REGISTER via the SDK's SetViewingKey action (no proof facts needed).
  const transfers = createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => viewingKey },
    provingProvider: { url: PROVER_URL, chainId },
    discoveryProvider: { url: DISCOVERY_URL },
    poolContractAddress: POOL,
  });

  // The prover simulates against the state 10 blocks back — a freshly
  // deployed account doesn't exist there yet. Wait out the maturity window.
  let latest = await provider.getBlockNumber();
  if (deployBlock !== undefined) {
    while (latest - 10 < deployBlock) {
      console.log(
        `Account too fresh for the prover (block ${latest}, need ≥ ${deployBlock + 10}) — waiting 10s…`,
      );
      await new Promise((r) => setTimeout(r, 10_000));
      latest = await provider.getBlockNumber();
    }
  }
  const provingBlockId = latest - 10;
  console.log(`Building register action (provingBlockId=${provingBlockId})…`);
  const { callAndProof } = await transfers.build().register().execute({ provingBlockId });

  const proofDetails = callAndProof.proof?.proofFacts?.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {};
  console.log("Submitting registration…");
  // The proof-carrying execute path doesn't auto-fetch the nonce — pass it.
  // Retry: the drpc gateway load-balances across replicas and a few of them
  // lack starknet_getNonce (-32601); a retry lands on a healthy one.
  let nonce;
  for (let attempt = 1; ; attempt++) {
    try {
      nonce = await provider.getNonceForAddress(address);
      break;
    } catch (e) {
      if (attempt >= 6) throw e;
      console.log(`  nonce fetch failed (attempt ${attempt}) — retrying…`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const tx = await account.execute(callAndProof.call, {
    tip: 0n,
    nonce,
    ...proofDetails,
  });
  console.log(`ViewingKeySet tx: ${tx.transaction_hash}`);
  await provider.waitForTransaction(tx.transaction_hash);

  // 5. VERIFY on-chain.
  const after = await provider.callContract({
    contractAddress: POOL,
    entrypoint: "get_public_key",
    calldata: [address],
  });
  const ok = after.some((f) => BigInt(f) !== 0n);
  console.log(ok
    ? `\n✅ REGISTERED. get_public_key = ${JSON.stringify(after)}\n   Kairo generated AND registered a viewing key — RFP bullet 1, literally.`
    : "\n❌ Tx accepted but get_public_key is still 0 — investigate.");
}

/* ---------------- shared setup for post-registration phases ---------------- */

function loadAccount() {
  const { privateKey, publicKey, address } = JSON.parse(
    readFileSync(KEYFILE, "utf8"),
  );
  const account = new Account({
    provider,
    address,
    signer: privateKey,
    cairoVersion: "1",
  });
  return { privateKey, publicKey, address, account };
}

function makeTransfers(account, privateKey) {
  const chainId = constants.StarknetChainId.SN_SEPOLIA;
  return createPrivateTransfers({
    account,
    viewingKeyProvider: {
      getViewingKey: async () => deriveViewingKey(privateKey, chainId, POOL),
    },
    provingProvider: { url: PROVER_URL, chainId },
    discoveryProvider: { url: DISCOVERY_URL },
    poolContractAddress: POOL,
  });
}

const u256of = (res) =>
  BigInt(res[0] ?? "0") + (res[1] !== undefined ? BigInt(res[1]) << 128n : 0n);

async function ensureAllowance(account, address, needed) {
  const allowance = u256of(
    await provider.callContract({
      contractAddress: STRK,
      entrypoint: "allowance",
      calldata: [address, POOL],
    }),
  );
  if (allowance >= needed) return console.log("Allowance sufficient.");
  console.log(`Approving pool for ${Number(needed / 10n ** 12n) / 1e6} STRK…`);
  const ap = await account.execute(
    {
      contractAddress: STRK,
      entrypoint: "approve",
      calldata: [POOL, needed.toString(), "0"],
    },
    { tip: 0n },
  );
  await provider.waitForTransaction(ap.transaction_hash);
  console.log(`Approved: ${ap.transaction_hash}`);
}

async function submit(account, address, callAndProof, label) {
  const proofDetails = callAndProof.proof?.proofFacts?.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {};
  const nonce = await provider.getNonceForAddress(address);
  const tx = await account.execute(callAndProof.call, {
    tip: 0n,
    nonce,
    ...proofDetails,
  });
  console.log(`${label} tx: ${tx.transaction_hash}`);
  const receipt = await provider.waitForTransaction(tx.transaction_hash);
  const poolEvents = (receipt.events ?? []).filter((e) => {
    try {
      return BigInt(e.from_address) === BigInt(POOL);
    } catch {
      return false;
    }
  });
  console.log(
    `Status: ${receipt.execution_status ?? "?"} · pool events: ${poolEvents.length}`,
  );
  return tx.transaction_hash;
}

/** SHIELD: deposit 100 STRK into the pool (RFP "shield" via the SDK route). */
async function deposit() {
  const { privateKey, address, account } = loadAccount();
  console.log(`Throwaway: ${address}`);
  const AMOUNT = 100n * 10n ** 18n;

  const fee = u256of(
    await provider.callContract({
      contractAddress: POOL,
      entrypoint: "get_fee_amount",
      calldata: [],
    }),
  );
  await ensureAllowance(account, address, AMOUNT + fee * 5n);

  const transfers = makeTransfers(account, privateKey);
  const provingBlockId = (await provider.getBlockNumber()) - 10;
  console.log(`Building deposit (provingBlockId=${provingBlockId})…`);
  const { callAndProof } = await transfers
    .build({ autoSetup: true })
    .with(STRK, (t) => t.deposit({ amount: AMOUNT }))
    .surplusTo(address)
    .execute({ provingBlockId });
  await submit(account, address, callAndProof, "Deposit (shield)");
  console.log("Note matures in ~10 blocks. Then run --discover.");
}

/** DISCOVERY: surface our notes via the public discovery service (RFP bullet 3). */
async function discover() {
  const { privateKey, address, account } = loadAccount();
  console.log(`Throwaway: ${address}`);
  const transfers = makeTransfers(account, privateKey);
  const { notes, timestamp } = await transfers.discoverNotes({
    tokens: [BigInt(STRK)],
  });
  const list = notes.get(BigInt(STRK)) ?? [];
  console.log(`Discovery at block ${JSON.stringify(timestamp)} — ${list.length} note(s):`);
  let total = 0n;
  for (const n of list) {
    total += n.amount;
    console.log(
      `  note id=${n.id} amount=${Number(n.amount / 10n ** 12n) / 1e6} STRK created=${n.created ?? "?"} open=${n.open ?? false}`,
    );
  }
  console.log(`Shielded balance: ${Number(total / 10n ** 12n) / 1e6} STRK`);
}

/** Common tail for spends: fetch notes, wait for maturity, run the builder. */
async function spend(kind, AMOUNT) {
  const { privateKey, address, account } = loadAccount();
  console.log(`Throwaway: ${address}`);
  const fee = u256of(
    await provider.callContract({
      contractAddress: POOL,
      entrypoint: "get_fee_amount",
      calldata: [],
    }),
  );
  await ensureAllowance(account, address, fee * 5n);

  const transfers = makeTransfers(account, privateKey);
  const { notes } = await transfers.discoverNotes({ tokens: [BigInt(STRK)] });
  const list = notes.get(BigInt(STRK)) ?? [];
  if (list.length === 0) throw new Error("No notes to spend — run --deposit first.");
  const note = list.reduce((a, b) => (a.amount >= b.amount ? a : b));
  console.log(`Spending from note ${note.id} (${Number(note.amount / 10n ** 12n) / 1e6} STRK, created ${note.created})`);

  // Note must be mature (10 blocks) AT the prover's snapshot (latest - 10).
  const created = Number(note.created ?? 0);
  let latest = await provider.getBlockNumber();
  while (latest - 10 < created + 10) {
    console.log(`Waiting for note maturity (block ${latest}, need ≥ ${created + 20})…`);
    await new Promise((r) => setTimeout(r, 10_000));
    latest = await provider.getBlockNumber();
  }
  const provingBlockId = latest - 10;
  console.log(`Building ${kind} (provingBlockId=${provingBlockId})…`);

  const { callAndProof } = await transfers
    .build({ autoSetup: true })
    .surplusTo(address)
    .with(STRK, (t) =>
      kind === "transfer"
        ? t.inputs(note).transfer({ recipient: address, amount: AMOUNT })
        : t.inputs(note).withdraw({ amount: AMOUNT, recipient: address }),
    )
    .execute({ provingBlockId });
  await submit(
    account,
    address,
    callAndProof,
    kind === "transfer" ? "Private transfer (CreateEncNote)" : "Withdraw (unshield)",
  );
}

const argv = process.argv;
const mode = argv.includes("--generate")
  ? generate
  : argv.includes("--deposit")
    ? deposit
    : argv.includes("--discover")
      ? discover
      : argv.includes("--send")
        ? () => spend("transfer", 25n * 10n ** 18n)
        : argv.includes("--withdraw")
          ? () => spend("withdraw", 10n * 10n ** 18n)
          : register;
mode().catch((e) => {
  const msg = String(e?.message ?? e);
  console.error("FAILED:", msg.length > 1500 ? msg.slice(0, 700) + " … " + msg.slice(-500) : msg);
  process.exit(1);
});

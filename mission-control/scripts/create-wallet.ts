/**
 * ORACLE Wallet Generator — Creates a Base wallet for receiving USDC payments
 * from AI agents via x402/xpay.sh machine payments.
 *
 * Run: npx tsx scripts/create-wallet.ts
 *
 * Creates:
 * - .env.wallet (address + private key, gitignored)
 * - keystore.json (encrypted backup, gitignored)
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits } from "viem";
import { base, baseSepolia } from "viem/chains";
import * as fs from "fs";
import * as crypto from "crypto";

// ── Generate Wallet ────────────────────────────────────

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("\n╔══════════════════════════════════════════════════╗");
console.log("║  ORACLE — Base Wallet Created                    ║");
console.log("╠══════════════════════════════════════════════════╣");
console.log(`║  Address:  ${account.address}`);
console.log(`║  Network:  Base (mainnet + testnet)              ║`);
console.log(`║  Currency: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)`);
console.log("╚══════════════════════════════════════════════════╝\n");

// ── Save Plain .env.wallet ─────────────────────────────

const envContent = `# ORACLE Receiving Wallet — Generated ${new Date().toISOString()}
# WARNING: Never commit this file. It's in .gitignore.
RECEIVING_WALLET_ADDRESS=${account.address}
WALLET_PRIVATE_KEY=${privateKey}
USDC_BASE_MAINNET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
`;
fs.writeFileSync(".env.wallet", envContent);
console.log("✓ Saved .env.wallet (plain, for xpay.sh config)");

// ── Save Encrypted Keystore ────────────────────────────

const password = crypto.randomBytes(32).toString("hex");
const salt = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const key = crypto.scryptSync(password, salt, 32);
const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);

const keystore = {
  version: 1,
  address: account.address,
  crypto: {
    cipher: "aes-256-ctr",
    kdf: "scrypt",
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  },
  created: new Date().toISOString(),
};

fs.writeFileSync("keystore.json", JSON.stringify(keystore, null, 2));

// Save the keystore password separately
fs.writeFileSync(
  ".keystore-password",
  `# Keystore decryption password — store this SEPARATELY from keystore.json\n${password}\n`,
);

console.log("✓ Saved keystore.json (AES-256-CTR encrypted)");
console.log("✓ Saved .keystore-password (store separately!)");

// ── Verify .gitignore ──────────────────────────────────

const gitignorePath = ".gitignore";
const gitignoreEntries = [
  ".env.wallet",
  "keystore.json",
  ".keystore-password",
  "*.key",
  ".env.local",
];

let gitignore = fs.existsSync(gitignorePath)
  ? fs.readFileSync(gitignorePath, "utf-8")
  : "";

let added = 0;
for (const entry of gitignoreEntries) {
  if (!gitignore.includes(entry)) {
    gitignore += `\n${entry}`;
    added++;
  }
}

if (added > 0) {
  fs.writeFileSync(gitignorePath, gitignore);
  console.log(`✓ Added ${added} entries to .gitignore`);
}

// ── Check Balance ──────────────────────────────────────

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function checkBalance() {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    const balance = await client.readContract({
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    console.log(`\nMainnet USDC Balance: $${formatUnits(balance, 6)}`);
  } catch {
    console.log("\n(Could not check mainnet balance — network issue, will work once funded)");
  }

  try {
    const testClient = createPublicClient({
      chain: baseSepolia,
      transport: http("https://sepolia.base.org"),
    });

    const testBalance = await testClient.readContract({
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    console.log(`Testnet USDC Balance: $${formatUnits(testBalance, 6)}`);
  } catch {
    console.log("(Could not check testnet balance)");
  }
}

checkBalance().then(() => {
  console.log("\n📋 Next steps:");
  console.log("   1. Fund with testnet USDC: https://faucet.circle.com/");
  console.log("   2. Set RECEIVING_WALLET_ADDRESS in xpay.sh dashboard");
  console.log("   3. Or send USDC on Base to:", account.address);
  console.log("   4. To offramp: Send to your Coinbase (luka.stanisljevic@gmail.com) Base address");
});

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { ethers } = require("ethers");
const contractABI = require("../contract/contractABI.json");

if (!process.env.RPC_URL || !process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
  console.error("❌ Missing .env variables! Check RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS");
  process.exit(1);
}

// Connect to Polygon RPC
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Wallet signer
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract instance
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  wallet
);

// Nonce manager for handling concurrent transactions
let currentNonce = null;
let nonceInitialized = false;

async function initNonce() {
  if (!nonceInitialized) {
    currentNonce = await provider.getTransactionCount(wallet.address, "pending");
    nonceInitialized = true;
    console.log(`📝 Nonce initialized: ${currentNonce}`);
  }
  return currentNonce;
}

function getAndIncrementNonce() {
  const nonce = currentNonce;
  currentNonce++;
  return nonce;
}

function resetNonce() {
  nonceInitialized = false;
  currentNonce = null;
}

module.exports = { contract, wallet, provider, initNonce, getAndIncrementNonce, resetNonce };

const express = require("express");
const router = express.Router();
const { Pool } = require('pg');
const { contract, wallet, provider, initNonce, getAndIncrementNonce, resetNonce } = require("../config/blockchain");

// Database connection for updating off-chain status
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'icici',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
});

const SCHEMA = process.env.DB_SCHEMA || 'fabric_test';

// Function to update blockchain_status in off-chain database
async function updateOffChainStatus(hash, status) {
    try {
        const query = `
            UPDATE ${SCHEMA}.user_chain_records 
            SET blockchain_status = $1, updated_at = NOW()
            WHERE hash_value = $2
            RETURNING id, user_id, blockchain_status
        `;
        const result = await pool.query(query, [status, hash]);
        if (result.rows.length > 0) {
            console.log(`📝 Off-chain status updated: ${result.rows[0].user_id} -> ${status}`);
            return result.rows[0];
        }
        return null;
    } catch (error) {
        console.error('❌ Failed to update off-chain status:', error.message);
        return null;
    }
}

// Mutex lock for sequential transaction processing
let isProcessing = false;
const pendingRequests = [];

// Event listeners (disabled to avoid RPC rate limits on free tier)
function initEventListeners() {
  console.log("ℹ️ Event listeners disabled (free tier RPC limit)");
}

initEventListeners();

// Process queue sequentially
async function processQueue() {
  if (isProcessing || pendingRequests.length === 0) return;
  
  isProcessing = true;
  const { req, res, resolve } = pendingRequests.shift();
  
  try {
    const { userId, hash } = req.body;
    
    // Get fresh nonce from network
    const nonce = await provider.getTransactionCount(wallet.address, "pending");
    console.log(`📝 Using nonce: ${nonce}`);
    
    const tx = await contract.submitChange(userId, hash, { nonce });
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    res.json({ success: true, message: "Change request submitted", txHash: tx.hash });
  } catch (err) {
    console.error('❌ Transaction error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    isProcessing = false;
    resolve();
    // Process next in queue after a short delay
    setTimeout(() => processQueue(), 1000);
  }
}

// Routes
router.post("/submit-change", async (req, res) => {
  const { userId, hash } = req.body;
  if (!userId || !hash) return res.status(400).json({ error: "Missing parameters" });

  // Add to queue and wait
  await new Promise(resolve => {
    pendingRequests.push({ req, res, resolve });
    processQueue();
  });
});

router.post("/approve", async (req, res) => {
  const { id, reason } = req.body;
  if (!id || !reason) return res.status(400).json({ error: "Missing parameters" });

  try {
    // First, get the change from blockchain to find the hash
    const change = await contract.changes(id);
    const hash = change.hash;
    
    // Execute blockchain transaction
    const tx = await contract.approve(id, reason);
    await tx.wait();
    
    // Update off-chain database status to 'A' (Approved)
    const offChainUpdate = await updateOffChainStatus(hash, 'A');

    res.json({ 
      success: true, 
      message: "Approved successfully", 
      txHash: tx.hash,
      offChainUpdated: offChainUpdate !== null,
      offChainRecord: offChainUpdate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reject", async (req, res) => {
  const { id, reason } = req.body;
  if (!id || !reason) return res.status(400).json({ error: "Missing parameters" });

  try {
    // First, get the change from blockchain to find the hash
    const change = await contract.changes(id);
    const hash = change.hash;
    
    // Execute blockchain transaction
    const tx = await contract.reject(id, reason);
    await tx.wait();
    
    // Update off-chain database status to 'R' (Rejected)
    const offChainUpdate = await updateOffChainStatus(hash, 'R');

    res.json({ 
      success: true, 
      message: "Rejected successfully", 
      txHash: tx.hash,
      offChainUpdated: offChainUpdate !== null,
      offChainRecord: offChainUpdate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/get-change/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const change = await contract.changes(id);
    res.json({
      success: true,
      change: {
        id: Number(id),
        userId: change.userId.toString(),
        hash: change.hash,
        status: change.status,
        reason: change.reason
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all changes (paginated) - useful to see pending changes
router.get("/get-all-changes", async (req, res) => {
  const { start = 0, limit = 10 } = req.query;
  const startId = parseInt(start);
  const maxResults = Math.min(parseInt(limit), 50); // Cap at 50

  try {
    const changes = [];
    for (let i = startId; i < startId + maxResults; i++) {
      try {
        const change = await contract.changes(i);
        // Check if this is a valid entry (userId > 0 or hash is not empty)
        if (change.userId.toString() !== "0" || change.hash !== "") {
          changes.push({
            id: i,
            userId: change.userId.toString(),
            hash: change.hash,
            status: Number(change.status), // 0=Pending, 1=Approved, 2=Rejected
            statusText: ["Pending", "Approved", "Rejected"][Number(change.status)] || "Unknown",
            reason: change.reason
          });
        }
      } catch (e) {
        // No more entries, stop
        break;
      }
    }
    res.json({ success: true, changes, count: changes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get only pending changes
router.get("/get-pending-changes", async (req, res) => {
  const { limit = 20 } = req.query;
  const maxResults = Math.min(parseInt(limit), 100);

  try {
    const pendingChanges = [];
    for (let i = 0; i < maxResults; i++) {
      try {
        const change = await contract.changes(i);
        // Status 0 = Pending
        if (Number(change.status) === 0 && (change.userId.toString() !== "0" || change.hash !== "")) {
          pendingChanges.push({
            id: i,
            userId: change.userId.toString(),
            hash: change.hash,
            reason: change.reason
          });
        }
      } catch (e) {
        break;
      }
    }
    res.json({ success: true, pendingChanges, count: pendingChanges.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wallet/contract info
router.get("/info", async (req, res) => {
  try {
    const walletAddress = await wallet.getAddress();
    const balance = await provider.getBalance(walletAddress);
    const network = await provider.getNetwork();
    
    res.json({
      success: true,
      info: {
        walletAddress,
        balance: balance.toString(),
        balanceInPOL: (Number(balance) / 1e18).toFixed(6),
        contractAddress: contract.target,
        network: {
          name: network.name,
          chainId: Number(network.chainId)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transaction count/stats
router.get("/stats", async (req, res) => {
  const { maxId = 100 } = req.query;
  
  try {
    let totalChanges = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    
    for (let i = 0; i < parseInt(maxId); i++) {
      try {
        const change = await contract.changes(i);
        if (change.userId.toString() !== "0" || change.hash !== "") {
          totalChanges++;
          const status = Number(change.status);
          if (status === 0) pending++;
          else if (status === 1) approved++;
          else if (status === 2) rejected++;
        }
      } catch (e) {
        break;
      }
    }
    
    res.json({
      success: true,
      stats: {
        totalChanges,
        pending,
        approved,
        rejected
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

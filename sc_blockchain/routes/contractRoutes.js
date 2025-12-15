const express = require("express");
const router = express.Router();
const { contract } = require("../config/blockchain");

// Event listeners (disabled to avoid RPC rate limits on free tier)
// Uncomment if using a paid RPC provider
function initEventListeners() {
  // console.log("⏳ Listening to blockchain events...");

  // contract.on("ChangeSubmitted", (requestId, userId, hash) => {
  //   console.log("📥 ChangeSubmitted EVENT:", { requestId, userId, hash });
  //   // TODO: Save to off-chain DB
  // });

  // contract.on("ChangeApproved", (requestId, reason) => {
  //   console.log("✅ ChangeApproved EVENT:", { requestId, reason });
  //   // TODO: Move temp data → final DB
  // });

  // contract.on("ChangeRejected", (requestId, reason) => {
  //   console.log("❌ ChangeRejected EVENT:", { requestId, reason });
  //   // TODO: Mark as rejected in DB
  // });
  
  console.log("ℹ️ Event listeners disabled (free tier RPC limit)");
}

initEventListeners();

// Routes
router.post("/submit-change", async (req, res) => {
  const { userId, hash } = req.body;
  if (!userId || !hash) return res.status(400).json({ error: "Missing parameters" });

  try {
    const tx = await contract.submitChange(userId, hash);
    await tx.wait();

    res.json({ success: true, message: "Change request submitted", txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/approve", async (req, res) => {
  const { id, reason } = req.body;
  if (!id || !reason) return res.status(400).json({ error: "Missing parameters" });

  try {
    const tx = await contract.approve(id, reason);
    await tx.wait();

    res.json({ success: true, message: "Approved successfully", txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reject", async (req, res) => {
  const { id, reason } = req.body;
  if (!id || !reason) return res.status(400).json({ error: "Missing parameters" });

  try {
    const tx = await contract.reject(id, reason);
    await tx.wait();

    res.json({ success: true, message: "Rejected successfully", txHash: tx.hash });
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

module.exports = router;

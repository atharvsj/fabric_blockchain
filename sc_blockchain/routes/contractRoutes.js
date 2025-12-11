const express = require("express");
const router = express.Router();
const { contract } = require("../config/blockchain");

// Event listeners
function initEventListeners() {
  console.log("⏳ Listening to blockchain events...");

  contract.on("ChangeSubmitted", (requestId, userId, hash) => {
    console.log("📥 ChangeSubmitted EVENT:", { requestId, userId, hash });
    // TODO: Save to off-chain DB
  });

  contract.on("ChangeApproved", (requestId, reason) => {
    console.log("✅ ChangeApproved EVENT:", { requestId, reason });
    // TODO: Move temp data → final DB
  });

  contract.on("ChangeRejected", (requestId, reason) => {
    console.log("❌ ChangeRejected EVENT:", { requestId, reason });
    // TODO: Mark as rejected in DB
  });
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

module.exports = router;

/**
 * Main Routes Index
 * Combines all route modules
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const fabricRoutes = require('./fabric.routes');
const recordRoutes = require('./record.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/fabric', fabricRoutes);
router.use('/records', recordRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

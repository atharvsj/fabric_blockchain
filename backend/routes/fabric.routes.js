/**
 * Fabric Routes
 * API routes for Hyperledger Fabric operations
 */

const express = require('express');
const router = express.Router();
const fabricController = require('../controllers/fabric.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Admin only routes
router.post('/enroll-admin', authenticate, authorize('admin'), fabricController.enrollAdmin);

// User registration (admin only)
router.post('/register-user', authenticate, authorize('admin'), fabricController.registerUser);

// Transaction routes (authenticated users)
router.post('/submit', authenticate, fabricController.submitTransaction);
router.post('/query', authenticate, fabricController.evaluateTransaction);

// Identity routes
router.get('/identities', authenticate, authorize('admin'), fabricController.listIdentities);
router.get('/identity/:userId', authenticate, fabricController.checkIdentity);

module.exports = router;

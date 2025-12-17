/**
 * User Routes
 * API endpoints for user operations (ci_erp_users + user_chain_records)
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// ==================== CI_ERP_USERS CRUD ====================

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination
 * @query   limit, offset
 */
router.get('/', userController.getAllUsers);

/**
 * @route   GET /api/users/chain-records
 * @desc    Get all chain records
 * @query   limit, offset
 */
router.get('/chain-records', userController.getAllChainRecords);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID with details and chain records
 */
router.get('/:userId', userController.getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user + store hash on blockchain
 * @body    User data (email, username, first_name, etc.)
 */
router.post('/', userController.createUser);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user + store new hash on blockchain
 * @body    Updated user data
 */
router.put('/:userId', userController.updateUser);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user
 */
router.delete('/:userId', userController.deleteUser);

// ==================== CHAIN RECORDS ====================

/**
 * @route   GET /api/users/:userId/chain-records
 * @desc    Get all chain records for a specific user
 */
router.get('/:userId/chain-records', userController.getUserChainRecords);

/**
 * @route   GET /api/users/:userId/verify
 * @desc    Verify user data integrity against blockchain
 */
router.get('/:userId/verify', userController.verifyUser);

/**
 * @route   POST /api/users/:userId/submit-to-blockchain
 * @desc    Manually submit user data to blockchain
 */
router.post('/:userId/submit-to-blockchain', userController.submitToBlockchain);

module.exports = router;

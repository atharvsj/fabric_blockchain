/**
 * Record Routes
 * API endpoints for record operations
 */

const express = require('express');
const router = express.Router();
const recordController = require('../controllers/record.controller');

/**
 * @route   POST /api/records
 * @desc    Create a new record (store in DB + blockchain)
 * @access  Public (add auth middleware as needed)
 * @body    { title, owner_name, data_json }
 */
router.post('/', recordController.createRecord);

/**
 * @route   GET /api/records
 * @desc    Get all records with pagination
 * @access  Public
 * @query   limit, offset
 */
router.get('/', recordController.getAllRecords);

/**
 * @route   GET /api/records/blockchain/status
 * @desc    Get blockchain service status
 * @access  Public
 */
router.get('/blockchain/status', recordController.getBlockchainStatus);

/**
 * @route   GET /api/records/:id
 * @desc    Get a single record by ID
 * @access  Public
 */
router.get('/:id', recordController.getRecord);

/**
 * @route   GET /api/records/:id/verify
 * @desc    Verify record integrity (compare DB hash with blockchain)
 * @access  Public
 */
router.get('/:id/verify', recordController.verifyRecord);

/**
 * @route   DELETE /api/records/:id
 * @desc    Delete a record
 * @access  Public (add auth middleware as needed)
 */
router.delete('/:id', recordController.deleteRecord);

module.exports = router;

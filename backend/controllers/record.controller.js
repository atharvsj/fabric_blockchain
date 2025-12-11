/**
 * Record Controller
 * Handles HTTP requests for record operations
 * Implements the off-chain + on-chain flow
 */

const { v4: uuidv4 } = require('uuid');
const recordService = require('../services/record.service');
const blockchainService = require('../services/blockchain.service');
const { computeHash, verifyHash } = require('../utils/hash');
const { successResponse, errorResponse } = require('../utils/response.helper');
const logger = require('../utils/logger');

/**
 * Create a new record
 * Flow:
 * 1. Validate input
 * 2. Store full data in DB
 * 3. Create canonical JSON from data_json
 * 4. Compute SHA-256 hash
 * 5. Send {recordId, hash} to blockchain
 * 6. Update DB with hash_value + blockchain_tx_id
 * 7. Return response with record details + on-chain proof
 * 
 * POST /api/records
 */
const createRecord = async (req, res) => {
    try {
        const { title, owner_name, data_json } = req.body;

        // 1. Validate input
        if (!title || !owner_name || !data_json) {
            return errorResponse(res, 'Missing required fields: title, owner_name, data_json', 400);
        }

        if (typeof data_json !== 'object') {
            return errorResponse(res, 'data_json must be a valid JSON object', 400);
        }

        // Generate UUID for record
        const id = uuidv4();

        // 2. Create record in DB (initially without blockchain info)
        const initialRecord = await recordService.create({
            id,
            title,
            owner_name,
            data_json,
            hash_value: null,
            blockchain_tx_id: null
        });

        // 3 & 4. Compute SHA-256 hash of the data_json
        const hash = computeHash(data_json);
        logger.info(`Computed hash for record ${id}: ${hash}`);

        // 5. Send hash to blockchain
        const blockchainResult = await blockchainService.storeRecordHash(id, hash);
        logger.info(`Blockchain response for record ${id}:`, blockchainResult);

        // 6. Update DB with hash and transaction ID
        const updatedRecord = await recordService.updateBlockchainInfo(
            id,
            hash,
            blockchainResult.tx_id
        );

        // 7. Return response with record details + on-chain proof
        const response = {
            record: {
                id: updatedRecord.id,
                title: updatedRecord.title,
                owner_name: updatedRecord.owner_name,
                data_json: updatedRecord.data_json,
                created_at: updatedRecord.created_at
            },
            onChainProof: {
                hash: hash,
                transactionId: blockchainResult.tx_id,
                timestamp: blockchainResult.timestamp,
                blockchainMode: blockchainService.getMode()
            }
        };

        return successResponse(res, response, 'Record created and stored on blockchain', 201);

    } catch (error) {
        logger.error('Error creating record:', error);
        return errorResponse(res, 'Failed to create record', 500, error);
    }
};

/**
 * Get a record by ID
 * GET /api/records/:id
 */
const getRecord = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await recordService.findById(id);

        if (!record) {
            return errorResponse(res, 'Record not found', 404);
        }

        return successResponse(res, record, 'Record retrieved successfully');

    } catch (error) {
        logger.error('Error getting record:', error);
        return errorResponse(res, 'Failed to retrieve record', 500, error);
    }
};

/**
 * Get all records
 * GET /api/records
 */
const getAllRecords = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const records = await recordService.findAll(limit, offset);
        const total = await recordService.count();

        return successResponse(res, {
            records,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + records.length < total
            }
        }, 'Records retrieved successfully');

    } catch (error) {
        logger.error('Error getting records:', error);
        return errorResponse(res, 'Failed to retrieve records', 500, error);
    }
};

/**
 * Verify a record's integrity
 * Flow:
 * 1. Fetch record from DB
 * 2. Build the same canonical JSON
 * 3. Recompute SHA-256 hash
 * 4. Query blockchain for stored hash
 * 5. Compare: if same → valid, else → invalid (data tampered)
 * 
 * GET /api/records/:id/verify
 */
const verifyRecord = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch record from DB
        const record = await recordService.findById(id);

        if (!record) {
            return errorResponse(res, 'Record not found', 404);
        }

        // 2 & 3. Recompute SHA-256 hash from current data_json
        const currentHash = computeHash(record.data_json);

        // 4 & 5. Query blockchain and compare hashes
        const verificationResult = await blockchainService.verifyRecordHash(id, currentHash);

        const response = {
            recordId: id,
            title: record.title,
            owner_name: record.owner_name,
            verification: {
                valid: verificationResult.valid,
                reason: verificationResult.reason,
                currentHash: currentHash,
                onChainHash: verificationResult.onChainHash,
                transactionId: verificationResult.transactionId,
                storedAt: verificationResult.storedAt
            },
            offChainData: {
                hash_value: record.hash_value,
                blockchain_tx_id: record.blockchain_tx_id,
                created_at: record.created_at
            },
            blockchainMode: blockchainService.getMode()
        };

        if (verificationResult.valid) {
            return successResponse(res, response, 'Record verified: data integrity confirmed');
        } else {
            return successResponse(res, response, 'Record verification failed: data may have been tampered');
        }

    } catch (error) {
        logger.error('Error verifying record:', error);
        return errorResponse(res, 'Failed to verify record', 500, error);
    }
};

/**
 * Delete a record
 * DELETE /api/records/:id
 */
const deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await recordService.delete(id);

        if (!deleted) {
            return errorResponse(res, 'Record not found', 404);
        }

        return successResponse(res, { id }, 'Record deleted successfully');

    } catch (error) {
        logger.error('Error deleting record:', error);
        return errorResponse(res, 'Failed to delete record', 500, error);
    }
};

/**
 * Get blockchain service status
 * GET /api/records/blockchain/status
 */
const getBlockchainStatus = async (req, res) => {
    try {
        const status = {
            mode: blockchainService.getMode(),
            description: blockchainService.getMode() === 'mock' 
                ? 'Running in mock mode - blockchain responses are simulated'
                : 'Running in Fabric mode - connected to Hyperledger Fabric network'
        };

        if (blockchainService.getMode() === 'mock') {
            status.mockLedger = blockchainService.getMockLedgerContents();
        }

        return successResponse(res, status, 'Blockchain service status');

    } catch (error) {
        logger.error('Error getting blockchain status:', error);
        return errorResponse(res, 'Failed to get blockchain status', 500, error);
    }
};

module.exports = {
    createRecord,
    getRecord,
    getAllRecords,
    verifyRecord,
    deleteRecord,
    getBlockchainStatus
};

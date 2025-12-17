/**
 * User Controller
 * Handles HTTP requests for user operations (ci_erp_users + user_chain_records)
 * Implements off-chain + on-chain flow
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const userService = require('../services/user.service');
const blockchainService = require('../services/blockchain.service');
const { successResponse, errorResponse } = require('../utils/response.helper');
const logger = require('../utils/logger');

/**
 * Compute SHA-256 hash of data
 */
function computeHash(data) {
    const dataForHash = { ...data };
    // Remove sensitive fields
    delete dataForHash.password;
    delete dataForHash.last_login_ip;
    
    const canonicalJson = JSON.stringify(dataForHash, Object.keys(dataForHash).sort());
    const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');
    return '0x' + hash;
}

// ==================== CI_ERP_USERS CRUD ====================

/**
 * GET /api/users
 * Get all users with pagination
 */
const getAllUsers = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const result = await userService.getAllUsers(parseInt(limit), parseInt(offset));
        return successResponse(res, result, 'Users fetched successfully');
    } catch (error) {
        logger.error('Error fetching users:', error);
        return errorResponse(res, 'Failed to fetch users', 500, error);
    }
};

/**
 * GET /api/users/:userId
 * Get user by ID with details
 */
const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await userService.getUserById(userId);
        
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // Get additional details
        const details = await userService.getUserDetails(userId);
        
        // Get chain records for this user
        const chainRecords = await userService.getChainRecordsByUserId(userId);

        return successResponse(res, {
            user,
            details,
            chainRecords
        }, 'User fetched successfully');
    } catch (error) {
        logger.error('Error fetching user:', error);
        return errorResponse(res, 'Failed to fetch user', 500, error);
    }
};

/**
 * POST /api/users
 * Create new user + store on blockchain
 */
const createUser = async (req, res) => {
    try {
        const userData = req.body;

        // Validate required fields
        if (!userData.email || !userData.username || !userData.first_name) {
            return errorResponse(res, 'Missing required fields: email, username, first_name', 400);
        }

        // 1. Create user in database
        const newUser = await userService.createUser(userData);
        logger.info(`User created: ${newUser.user_id}`);

        // 2. Compute hash of user data
        const hash = computeHash(newUser);
        logger.info(`Computed hash for user ${newUser.user_id}: ${hash}`);

        // 3. Store hash on blockchain
        let blockchainResult = null;
        try {
            blockchainResult = await blockchainService.storeRecordHash(newUser.user_id.toString(), hash);
            logger.info(`Blockchain result for user ${newUser.user_id}:`, blockchainResult);
        } catch (bcError) {
            logger.error('Blockchain storage failed:', bcError);
            // Continue even if blockchain fails - user is created
        }

        // 4. Create chain record
        const chainRecordId = uuidv4();
        const chainRecord = await userService.createChainRecord({
            id: chainRecordId,
            user_id: newUser.user_id.toString(),
            data_json: newUser,
            hash_value: hash,
            blockchain_tx_id: blockchainResult?.tx_id || null,
            operation_type: 'INSERT',
            blockchain_status: 'P'
        });

        return successResponse(res, {
            user: newUser,
            chainRecord,
            onChainProof: blockchainResult ? {
                hash,
                transactionId: blockchainResult.tx_id,
                timestamp: blockchainResult.timestamp
            } : null
        }, 'User created and stored on blockchain', 201);

    } catch (error) {
        logger.error('Error creating user:', error);
        return errorResponse(res, 'Failed to create user', 500, error);
    }
};

/**
 * PUT /api/users/:userId
 * Update user + store new hash on blockchain
 */
const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const userData = req.body;

        // Check if user exists
        const existingUser = await userService.getUserById(userId);
        if (!existingUser) {
            return errorResponse(res, 'User not found', 404);
        }

        // 1. Update user in database
        const updatedUser = await userService.updateUser(userId, userData);
        logger.info(`User updated: ${userId}`);

        // 2. Compute new hash
        const hash = computeHash(updatedUser);
        logger.info(`Computed hash for updated user ${userId}: ${hash}`);

        // 3. Store new hash on blockchain
        let blockchainResult = null;
        try {
            blockchainResult = await blockchainService.storeRecordHash(userId.toString(), hash);
            logger.info(`Blockchain result for user ${userId}:`, blockchainResult);
        } catch (bcError) {
            logger.error('Blockchain storage failed:', bcError);
        }

        // 4. Create new chain record for the update
        const chainRecordId = uuidv4();
        const chainRecord = await userService.createChainRecord({
            id: chainRecordId,
            user_id: userId.toString(),
            data_json: updatedUser,
            hash_value: hash,
            blockchain_tx_id: blockchainResult?.tx_id || null,
            operation_type: 'UPDATE',
            blockchain_status: 'P'
        });

        return successResponse(res, {
            user: updatedUser,
            chainRecord,
            onChainProof: blockchainResult ? {
                hash,
                transactionId: blockchainResult.tx_id,
                timestamp: blockchainResult.timestamp
            } : null
        }, 'User updated and stored on blockchain');

    } catch (error) {
        logger.error('Error updating user:', error);
        return errorResponse(res, 'Failed to update user', 500, error);
    }
};

/**
 * DELETE /api/users/:userId
 * Delete user + store deletion record on blockchain
 */
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get user data before deletion for blockchain record
        const userToDelete = await userService.getUserById(userId);
        
        if (!userToDelete) {
            return errorResponse(res, 'User not found', 404);
        }

        // 1. Compute hash of deletion record
        const deletionData = {
            user_id: userId,
            deleted_at: new Date().toISOString(),
            action: 'DELETE',
            previous_data: userToDelete
        };
        const hash = computeHash(deletionData);
        logger.info(`Computed hash for deleted user ${userId}: ${hash}`);

        // 2. Store deletion hash on blockchain
        let blockchainResult = null;
        try {
            blockchainResult = await blockchainService.storeRecordHash(userId.toString(), hash);
            logger.info(`Blockchain result for deleted user ${userId}:`, blockchainResult);
        } catch (bcError) {
            logger.error('Blockchain storage failed:', bcError);
        }

        // 3. Create chain record for deletion
        const chainRecordId = uuidv4();
        await userService.createChainRecord({
            id: chainRecordId,
            user_id: userId.toString(),
            data_json: deletionData,
            hash_value: hash,
            blockchain_tx_id: blockchainResult?.tx_id || null,
            operation_type: 'DELETE',
            blockchain_status: 'P'
        });

        // 4. Delete user from database
        const deletedUser = await userService.deleteUser(userId);

        return successResponse(res, { 
            userId,
            onChainProof: blockchainResult ? {
                hash,
                transactionId: blockchainResult.tx_id,
                timestamp: blockchainResult.timestamp
            } : null
        }, 'User deleted and recorded on blockchain');
    } catch (error) {
        logger.error('Error deleting user:', error);
        return errorResponse(res, 'Failed to delete user', 500, error);
    }
};

// ==================== USER CHAIN RECORDS ====================

/**
 * GET /api/users/chain-records
 * Get all chain records
 */
const getAllChainRecords = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const result = await userService.getAllChainRecords(parseInt(limit), parseInt(offset));
        return successResponse(res, result, 'Chain records fetched successfully');
    } catch (error) {
        logger.error('Error fetching chain records:', error);
        return errorResponse(res, 'Failed to fetch chain records', 500, error);
    }
};

/**
 * GET /api/users/:userId/chain-records
 * Get chain records for a specific user with optional status filter
 */
const getUserChainRecords = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query; // P = Pending, A = Approved, R = Rejected
        
        // Validate status if provided
        if (status && !['P', 'A', 'R'].includes(status.toUpperCase())) {
            return errorResponse(res, 'Invalid status. Use P (Pending), A (Approved), or R (Rejected)', 400);
        }
        
        const records = await userService.getChainRecordsByUserId(userId, status ? status.toUpperCase() : null);
        return successResponse(res, { 
            records, 
            count: records.length,
            filter: status ? { status: status.toUpperCase() } : null
        }, 'Chain records fetched successfully');
    } catch (error) {
        logger.error('Error fetching user chain records:', error);
        return errorResponse(res, 'Failed to fetch chain records', 500, error);
    }
};

/**
 * GET /api/users/:userId/verify
 * Verify user data integrity (compare current hash with blockchain)
 */
const verifyUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Get current user data
        const user = await userService.getUserById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // Compute current hash
        const currentHash = computeHash(user);

        // Get latest chain record
        const latestRecord = await userService.getLatestChainRecord(userId);

        if (!latestRecord) {
            return successResponse(res, {
                verified: false,
                reason: 'No blockchain record found for this user',
                currentHash
            }, 'Verification failed');
        }

        // Compare hashes
        const isValid = currentHash === latestRecord.hash_value;

        return successResponse(res, {
            verified: isValid,
            reason: isValid 
                ? 'Data integrity verified - hash matches blockchain record' 
                : 'Data has been modified since last blockchain submission',
            currentHash,
            storedHash: latestRecord.hash_value,
            blockchainTxId: latestRecord.blockchain_tx_id,
            lastRecordedAt: latestRecord.created_at
        }, isValid ? 'Verification successful' : 'Verification failed');

    } catch (error) {
        logger.error('Error verifying user:', error);
        return errorResponse(res, 'Failed to verify user', 500, error);
    }
};

/**
 * POST /api/users/:userId/submit-to-blockchain
 * Manually submit/re-submit user data to blockchain
 */
const submitToBlockchain = async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user data
        const user = await userService.getUserById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // Compute hash
        const hash = computeHash(user);

        // Submit to blockchain
        const blockchainResult = await blockchainService.storeRecordHash(userId.toString(), hash);

        // Create chain record
        const chainRecordId = uuidv4();
        const chainRecord = await userService.createChainRecord({
            id: chainRecordId,
            user_id: userId.toString(),
            data_json: user,
            hash_value: hash,
            blockchain_tx_id: blockchainResult.tx_id,
            operation_type: 'MANUAL_SUBMIT'
        });

        return successResponse(res, {
            chainRecord,
            onChainProof: {
                hash,
                transactionId: blockchainResult.tx_id,
                timestamp: blockchainResult.timestamp
            }
        }, 'User data submitted to blockchain');

    } catch (error) {
        logger.error('Error submitting to blockchain:', error);
        return errorResponse(res, 'Failed to submit to blockchain', 500, error);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getAllChainRecords,
    getUserChainRecords,
    verifyUser,
    submitToBlockchain
};

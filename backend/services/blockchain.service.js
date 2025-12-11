/**
 * Blockchain Integration Service
 * Handles communication with Hyperledger Fabric for storing/retrieving hashes
 * 
 * This service provides an abstraction layer that can work in two modes:
 * 1. MOCK mode (default for development) - Simulates blockchain responses
 * 2. FABRIC mode - Uses actual Hyperledger Fabric SDK
 * 
 * Set BLOCKCHAIN_MODE=fabric in .env to use real Fabric network
 */

const logger = require('../utils/logger');
const fabricService = require('./fabric.service');

// In-memory store for mock mode (simulates blockchain ledger)
const mockLedger = new Map();

class BlockchainService {
    constructor() {
        this.mode = process.env.BLOCKCHAIN_MODE || 'mock';
        logger.info(`Blockchain service initialized in ${this.mode.toUpperCase()} mode`);
    }

    /**
     * Store record hash on blockchain
     * @param {string} recordId - Unique record identifier
     * @param {string} hash - SHA-256 hash of record data
     * @returns {Promise<Object>} Transaction result with tx_id
     */
    async storeRecordHash(recordId, hash) {
        if (this.mode === 'fabric') {
            return await this._storeOnFabric(recordId, hash);
        }
        return await this._storeOnMock(recordId, hash);
    }

    /**
     * Retrieve record hash from blockchain
     * @param {string} recordId - Record identifier
     * @returns {Promise<Object>} Stored hash data
     */
    async getRecordHash(recordId) {
        if (this.mode === 'fabric') {
            return await this._getFromFabric(recordId);
        }
        return await this._getFromMock(recordId);
    }

    /**
     * Verify if a hash matches the on-chain stored hash
     * @param {string} recordId - Record identifier
     * @param {string} hash - Hash to verify
     * @returns {Promise<Object>} Verification result
     */
    async verifyRecordHash(recordId, hash) {
        try {
            const storedData = await this.getRecordHash(recordId);
            
            if (!storedData || !storedData.hash) {
                return {
                    valid: false,
                    reason: 'Record not found on blockchain',
                    onChainHash: null,
                    providedHash: hash
                };
            }

            const isValid = storedData.hash === hash;
            
            return {
                valid: isValid,
                reason: isValid ? 'Hash matches on-chain record' : 'Hash mismatch - data may have been tampered',
                onChainHash: storedData.hash,
                providedHash: hash,
                storedAt: storedData.timestamp,
                transactionId: storedData.tx_id
            };
        } catch (error) {
            logger.error('Error verifying record hash:', error);
            throw error;
        }
    }

    // ==================== MOCK MODE METHODS ====================

    /**
     * Store hash in mock ledger (development/testing)
     */
    async _storeOnMock(recordId, hash) {
        // Simulate network delay
        await this._simulateDelay(100, 300);

        // Generate mock transaction ID
        const tx_id = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const ledgerEntry = {
            recordId,
            hash,
            tx_id,
            timestamp: new Date().toISOString(),
            blockNumber: mockLedger.size + 1
        };

        mockLedger.set(recordId, ledgerEntry);
        
        logger.info(`[MOCK] Stored hash on blockchain - Record: ${recordId}, TX: ${tx_id}`);
        
        return {
            success: true,
            tx_id,
            recordId,
            hash,
            timestamp: ledgerEntry.timestamp,
            blockNumber: ledgerEntry.blockNumber
        };
    }

    /**
     * Retrieve hash from mock ledger
     */
    async _getFromMock(recordId) {
        await this._simulateDelay(50, 150);

        const entry = mockLedger.get(recordId);
        
        if (!entry) {
            logger.warn(`[MOCK] Record not found on blockchain: ${recordId}`);
            return null;
        }

        logger.info(`[MOCK] Retrieved hash from blockchain - Record: ${recordId}`);
        return entry;
    }

    /**
     * Simulate network delay for realistic testing
     */
    async _simulateDelay(minMs, maxMs) {
        const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    // ==================== FABRIC MODE METHODS ====================

    /**
     * Store hash on Hyperledger Fabric network
     * Uses the chaincode function: StoreRecordHash(recordId, hash, timestamp)
     */
    async _storeOnFabric(recordId, hash) {
        try {
            const userId = process.env.FABRIC_USER_ID || 'appUser';
            const timestamp = new Date().toISOString();

            logger.info(`[FABRIC] Storing hash on blockchain - Record: ${recordId}`);

            // Submit transaction to chaincode
            // Chaincode function: StoreRecordHash(recordId, hash, timestamp)
            const result = await fabricService.submitTransaction(
                userId,
                'StoreRecordHash',
                recordId,
                hash,
                timestamp
            );

            logger.info(`[FABRIC] Hash stored successfully - Record: ${recordId}`);

            // Parse the result if it's a string
            const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

            return {
                success: true,
                tx_id: parsedResult.txId || parsedResult.tx_id,
                recordId,
                hash,
                timestamp: parsedResult.timestamp || timestamp
            };
        } catch (error) {
            logger.error('[FABRIC] Error storing hash:', error);
            throw error;
        }
    }

    /**
     * Retrieve hash from Hyperledger Fabric network
     * Uses the chaincode function: GetRecordHash(recordId)
     */
    async _getFromFabric(recordId) {
        try {
            const userId = process.env.FABRIC_USER_ID || 'appUser';

            logger.info(`[FABRIC] Retrieving hash from blockchain - Record: ${recordId}`);

            // Query chaincode
            const result = await fabricService.evaluateTransaction(
                userId,
                'GetRecordHash',
                recordId
            );

            if (!result) {
                return null;
            }

            // Parse the result
            const data = typeof result === 'string' ? JSON.parse(result) : result;

            if (!data.exists) {
                logger.warn(`[FABRIC] Record not found on blockchain: ${recordId}`);
                return null;
            }

            logger.info(`[FABRIC] Hash retrieved successfully - Record: ${recordId}`);

            return {
                recordId: data.recordId,
                hash: data.hash,
                tx_id: data.txId,
                timestamp: data.timestamp
            };
        } catch (error) {
            logger.error('[FABRIC] Error retrieving hash:', error);
            throw error;
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Get mock ledger contents (for debugging)
     */
    getMockLedgerContents() {
        if (this.mode !== 'mock') {
            return { error: 'Only available in mock mode' };
        }
        return Object.fromEntries(mockLedger);
    }

    /**
     * Clear mock ledger (for testing)
     */
    clearMockLedger() {
        if (this.mode === 'mock') {
            mockLedger.clear();
            logger.info('[MOCK] Ledger cleared');
        }
    }
}

module.exports = new BlockchainService();

/**
 * Blockchain Integration Service
 * Handles communication with Polygon Smart Contract for storing/retrieving hashes
 * 
 * This service provides an abstraction layer that can work in two modes:
 * 1. MOCK mode (default for development) - Simulates blockchain responses
 * 2. POLYGON mode - Calls the sc_blockchain API (Polygon smart contract)
 * 
 * Set BLOCKCHAIN_MODE=polygon in .env to use real Polygon network
 */

const logger = require('../utils/logger');

// In-memory store for mock mode (simulates blockchain ledger)
const mockLedger = new Map();

class BlockchainService {
    constructor() {
        this.mode = process.env.BLOCKCHAIN_MODE || 'mock';
        this.scBlockchainUrl = process.env.SC_BLOCKCHAIN_URL || 'http://localhost:5000';
        logger.info(`Blockchain service initialized in ${this.mode.toUpperCase()} mode`);
    }

    /**
     * Store record hash on blockchain
     * @param {string} recordId - Unique record identifier
     * @param {string} hash - SHA-256 hash of record data
     * @returns {Promise<Object>} Transaction result with tx_id
     */
    async storeRecordHash(recordId, hash) {
        if (this.mode === 'polygon') {
            return await this._storeOnPolygon(recordId, hash);
        }
        return await this._storeOnMock(recordId, hash);
    }

    /**
     * Retrieve record hash from blockchain
     * @param {string} recordId - Record identifier
     * @returns {Promise<Object>} Stored hash data
     */
    async getRecordHash(recordId) {
        if (this.mode === 'polygon') {
            return await this._getFromPolygon(recordId);
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

    // ==================== POLYGON MODE METHODS ====================

    /**
     * Store hash on Polygon network via sc_blockchain API
     * Calls: POST /api/submit-change { userId, hash }
     */
    async _storeOnPolygon(recordId, hash) {
        try {
            logger.info(`[POLYGON] Storing hash on blockchain - Record: ${recordId}`);

            // Convert UUID to a numeric userId for the smart contract
            // Using a hash of the recordId to generate a numeric ID
            const userId = this._uuidToNumericId(recordId);

            const response = await fetch(`${this.scBlockchainUrl}/api/submit-change`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    hash: hash
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to store hash on blockchain');
            }

            logger.info(`[POLYGON] Hash stored successfully - Record: ${recordId}, TX: ${result.txHash}`);

            return {
                success: true,
                tx_id: result.txHash,
                recordId,
                hash,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('[POLYGON] Error storing hash:', error);
            throw error;
        }
    }

    /**
     * Retrieve hash from Polygon network via sc_blockchain API
     * Calls: GET /api/get-change/:id
     */
    async _getFromPolygon(recordId) {
        try {
            logger.info(`[POLYGON] Retrieving hash from blockchain - Record: ${recordId}`);

            // Convert UUID to numeric ID
            const numericId = this._uuidToNumericId(recordId);

            const response = await fetch(`${this.scBlockchainUrl}/api/get-change/${numericId}`);
            const result = await response.json();

            if (!response.ok || !result.success) {
                logger.warn(`[POLYGON] Record not found on blockchain: ${recordId}`);
                return null;
            }

            logger.info(`[POLYGON] Hash retrieved successfully - Record: ${recordId}`);

            return {
                recordId: recordId,
                hash: result.change.hash,
                tx_id: null, // Not available from get-change
                timestamp: null,
                status: result.change.status,
                reason: result.change.reason
            };
        } catch (error) {
            logger.error('[POLYGON] Error retrieving hash:', error);
            throw error;
        }
    }

    /**
     * Convert UUID to a numeric ID for the smart contract
     * The smart contract expects uint256 userId
     */
    _uuidToNumericId(uuid) {
        // Use the first 8 hex characters of UUID and convert to number
        const hexPart = uuid.replace(/-/g, '').substring(0, 15);
        return parseInt(hexPart, 16);
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

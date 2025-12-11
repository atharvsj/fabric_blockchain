/**
 * Record Service
 * Handles all database operations for records
 */

const pool = require('../config/db.config');
const logger = require('../utils/logger');

// Schema name from environment
const SCHEMA = process.env.DB_SCHEMA || 'fabric_test';

class RecordService {
    /**
     * Create a new record
     * @param {Object} recordData - Record data
     * @returns {Promise<Object>} Created record
     */
    async create(recordData) {
        const { id, title, owner_name, data_json, hash_value, blockchain_tx_id } = recordData;
        
        const query = `
            INSERT INTO ${SCHEMA}.records 
            (id, title, owner_name, data_json, hash_value, blockchain_tx_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `;
        
        const values = [id, title, owner_name, data_json, hash_value, blockchain_tx_id];
        
        try {
            const result = await pool.query(query, values);
            logger.info(`Record created: ${id}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating record:', error);
            throw error;
        }
    }

    /**
     * Find record by ID
     * @param {string} id - Record ID (UUID)
     * @returns {Promise<Object|null>} Record or null
     */
    async findById(id) {
        const query = `SELECT * FROM ${SCHEMA}.records WHERE id = $1`;
        
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding record:', error);
            throw error;
        }
    }

    /**
     * Get all records
     * @param {number} limit - Number of records to return
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>} Array of records
     */
    async findAll(limit = 50, offset = 0) {
        const query = `
            SELECT * FROM ${SCHEMA}.records 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        
        try {
            const result = await pool.query(query, [limit, offset]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching records:', error);
            throw error;
        }
    }

    /**
     * Update record with blockchain info
     * @param {string} id - Record ID
     * @param {string} hash_value - Computed hash
     * @param {string} blockchain_tx_id - Blockchain transaction ID
     * @returns {Promise<Object>} Updated record
     */
    async updateBlockchainInfo(id, hash_value, blockchain_tx_id) {
        const query = `
            UPDATE ${SCHEMA}.records 
            SET hash_value = $2, blockchain_tx_id = $3
            WHERE id = $1
            RETURNING *
        `;
        
        try {
            const result = await pool.query(query, [id, hash_value, blockchain_tx_id]);
            if (result.rows.length === 0) {
                throw new Error('Record not found');
            }
            logger.info(`Record updated with blockchain info: ${id}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating record:', error);
            throw error;
        }
    }

    /**
     * Delete a record
     * @param {string} id - Record ID
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id) {
        const query = `DELETE FROM ${SCHEMA}.records WHERE id = $1 RETURNING id`;
        
        try {
            const result = await pool.query(query, [id]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error deleting record:', error);
            throw error;
        }
    }

    /**
     * Count total records
     * @returns {Promise<number>} Total count
     */
    async count() {
        const query = `SELECT COUNT(*) FROM ${SCHEMA}.records`;
        
        try {
            const result = await pool.query(query);
            return parseInt(result.rows[0].count, 10);
        } catch (error) {
            logger.error('Error counting records:', error);
            throw error;
        }
    }
}

module.exports = new RecordService();

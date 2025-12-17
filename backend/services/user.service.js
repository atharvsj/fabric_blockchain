/**
 * User Service
 * Handles all database operations for users (ci_erp_users and user_chain_records)
 */

const pool = require('../config/db.config');
const logger = require('../utils/logger');

const SCHEMA = process.env.DB_SCHEMA || 'fabric_test';

class UserService {
    /**
     * Get all users from ci_erp_users
     */
    async getAllUsers(limit = 50, offset = 0) {
        const query = `
            SELECT * FROM ${SCHEMA}.ci_erp_users 
            ORDER BY user_id 
            LIMIT $1 OFFSET $2
        `;
        try {
            const result = await pool.query(query, [limit, offset]);
            const countResult = await pool.query(`SELECT COUNT(*) FROM ${SCHEMA}.ci_erp_users`);
            return {
                users: result.rows,
                total: parseInt(countResult.rows[0].count),
                limit,
                offset
            };
        } catch (error) {
            logger.error('Error fetching users:', error);
            throw error;
        }
    }

    /**
     * Get user by ID from ci_erp_users
     */
    async getUserById(userId) {
        const query = `SELECT * FROM ${SCHEMA}.ci_erp_users WHERE user_id = $1`;
        try {
            const result = await pool.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error fetching user:', error);
            throw error;
        }
    }

    /**
     * Get user details from ci_erp_users_details
     */
    async getUserDetails(userId) {
        try {
            const query = `SELECT * FROM ${SCHEMA}.ci_erp_users_details WHERE user_id = $1`;
            const result = await pool.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Create new user in ci_erp_users
     */
    async createUser(userData) {
        const {
            user_role_id, user_type, company_id, first_name, middle_name, last_name,
            email, username, password, company_name, trading_name, registration_no,
            government_tax, company_type_id, profile_photo, contact_number, gender,
            address_1, city, state, zipcode, country, address_2, is_active
        } = userData;

        const query = `
            INSERT INTO ${SCHEMA}.ci_erp_users (
                user_role_id, user_type, company_id, first_name, middle_name, last_name,
                email, username, password, company_name, trading_name, registration_no,
                government_tax, company_type_id, profile_photo, contact_number, gender,
                address_1, city, state, zipcode, country, address_2, is_active, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW())
            RETURNING *
        `;

        const values = [
            user_role_id, user_type, company_id, first_name, middle_name, last_name,
            email, username, password, company_name, trading_name, registration_no,
            government_tax, company_type_id, profile_photo, contact_number, gender,
            address_1, city, state, zipcode, country, address_2, is_active || '1'
        ];

        try {
            const result = await pool.query(query, values);
            logger.info(`User created: ${result.rows[0].user_id}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    }

    /**
     * Update user in ci_erp_users
     */
    async updateUser(userId, userData) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        // Dynamically build update query
        const allowedFields = [
            'user_role_id', 'user_type', 'company_id', 'first_name', 'middle_name', 
            'last_name', 'email', 'username', 'company_name', 'trading_name', 
            'registration_no', 'government_tax', 'company_type_id', 'profile_photo', 
            'contact_number', 'gender', 'address_1', 'city', 'state', 'zipcode', 
            'country', 'address_2', 'is_active'
        ];

        for (const field of allowedFields) {
            if (userData[field] !== undefined) {
                fields.push(`${field} = $${paramCount}`);
                values.push(userData[field]);
                paramCount++;
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(userId);
        const query = `
            UPDATE ${SCHEMA}.ci_erp_users 
            SET ${fields.join(', ')}
            WHERE user_id = $${paramCount}
            RETURNING *
        `;

        try {
            const result = await pool.query(query, values);
            if (result.rows.length === 0) {
                return null;
            }
            logger.info(`User updated: ${userId}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating user:', error);
            throw error;
        }
    }

    /**
     * Delete user from ci_erp_users
     */
    async deleteUser(userId) {
        const query = `DELETE FROM ${SCHEMA}.ci_erp_users WHERE user_id = $1 RETURNING *`;
        try {
            const result = await pool.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error deleting user:', error);
            throw error;
        }
    }

    // ==================== USER CHAIN RECORDS ====================

    /**
     * Get all user chain records
     */
    async getAllChainRecords(limit = 50, offset = 0) {
        const query = `
            SELECT * FROM ${SCHEMA}.user_chain_records 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        try {
            const result = await pool.query(query, [limit, offset]);
            const countResult = await pool.query(`SELECT COUNT(*) FROM ${SCHEMA}.user_chain_records`);
            return {
                records: result.rows,
                total: parseInt(countResult.rows[0].count),
                limit,
                offset
            };
        } catch (error) {
            logger.error('Error fetching chain records:', error);
            throw error;
        }
    }

    /**
     * Get chain records by user ID
     */
    async getChainRecordsByUserId(userId) {
        const query = `
            SELECT * FROM ${SCHEMA}.user_chain_records 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        try {
            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching chain records for user:', error);
            throw error;
        }
    }

    /**
     * Get chain record by ID
     */
    async getChainRecordById(id) {
        const query = `SELECT * FROM ${SCHEMA}.user_chain_records WHERE id = $1`;
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error fetching chain record:', error);
            throw error;
        }
    }

    /**
     * Create user chain record
     */
    async createChainRecord(recordData) {
        const { id, user_id, data_json, hash_value, blockchain_tx_id, operation_type } = recordData;
        
        const query = `
            INSERT INTO ${SCHEMA}.user_chain_records 
            (id, user_id, data_json, hash_value, blockchain_tx_id, operation_type, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `;
        
        const values = [id, user_id, data_json, hash_value, blockchain_tx_id, operation_type || 'INSERT'];
        
        try {
            const result = await pool.query(query, values);
            logger.info(`Chain record created for user: ${user_id}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating chain record:', error);
            throw error;
        }
    }

    /**
     * Update chain record with blockchain info
     */
    async updateChainRecord(id, hashValue, blockchainTxId) {
        const query = `
            UPDATE ${SCHEMA}.user_chain_records 
            SET hash_value = $2, blockchain_tx_id = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [id, hashValue, blockchainTxId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error updating chain record:', error);
            throw error;
        }
    }

    /**
     * Get latest chain record for a user
     */
    async getLatestChainRecord(userId) {
        const query = `
            SELECT * FROM ${SCHEMA}.user_chain_records 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        try {
            const result = await pool.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error fetching latest chain record:', error);
            throw error;
        }
    }
}

module.exports = new UserService();

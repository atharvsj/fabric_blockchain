/**
 * User Blockchain Migration Script
 * 
 * This script:
 * 1. Creates the user_chain_records table if not exists
 * 2. Reads all users from ci_erp_users table
 * 3. Optionally fetches additional details from ci_erp_users_details
 * 4. Creates a hash of user data
 * 5. Stores hash on blockchain (Polygon)
 * 6. Saves record to user_chain_records table
 * 
 * Usage: node scripts/migrate-users-to-blockchain.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuration
const SCHEMA = process.env.DB_SCHEMA || 'fabric_test';
const SC_BLOCKCHAIN_URL = process.env.SC_BLOCKCHAIN_URL || 'http://localhost:5000';
const BLOCKCHAIN_MODE = process.env.BLOCKCHAIN_MODE || 'polygon';
const BATCH_SIZE = 10; // Process users in batches
const DELAY_BETWEEN_TX = 10000; // 10 second delay between blockchain transactions (wait for confirmation)

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'icici',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
});

// In-memory mock ledger for mock mode
const mockLedger = new Map();

/**
 * Create the user_chain_records table
 */
async function createTable() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${SCHEMA}.user_chain_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            data_json JSONB NOT NULL,
            hash_value VARCHAR(200),
            blockchain_tx_id VARCHAR(200),
            operation_type VARCHAR(20) DEFAULT 'INSERT',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT unique_user_operation UNIQUE (user_id, hash_value)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_chain_records_user_id 
        ON ${SCHEMA}.user_chain_records(user_id);
        
        CREATE INDEX IF NOT EXISTS idx_user_chain_records_hash 
        ON ${SCHEMA}.user_chain_records(hash_value);
        
        CREATE INDEX IF NOT EXISTS idx_user_chain_records_created 
        ON ${SCHEMA}.user_chain_records(created_at);
    `;

    try {
        await pool.query(createTableSQL);
        console.log('✅ Table user_chain_records created/verified');
    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        throw error;
    }
}

/**
 * Compute SHA-256 hash of data
 */
function computeHash(data) {
    const canonicalJson = JSON.stringify(data, Object.keys(data).sort());
    const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');
    return '0x' + hash;
}

/**
 * Convert user_id to numeric ID for blockchain
 */
function userIdToNumericId(userId) {
    // Create a hash of the userId and take first 12 hex chars
    const hash = crypto.createHash('md5').update(userId.toString()).digest('hex');
    return BigInt('0x' + hash.substring(0, 12)).toString();
}

/**
 * Store hash on blockchain (mock or polygon)
 */
async function storeOnBlockchain(userId, hash) {
    if (BLOCKCHAIN_MODE === 'polygon') {
        return await storeOnPolygon(userId, hash);
    }
    return await storeOnMock(userId, hash);
}

/**
 * Mock blockchain storage
 */
async function storeOnMock(userId, hash) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const tx_id = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    mockLedger.set(userId, {
        userId,
        hash,
        tx_id,
        timestamp: new Date().toISOString()
    });
    
    return {
        success: true,
        tx_id,
        hash,
        timestamp: new Date().toISOString()
    };
}

/**
 * Store on Polygon blockchain via sc_blockchain API
 * With retry logic for temporary RPC errors
 */
async function storeOnPolygon(userId, hash, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds
    
    const numericId = userIdToNumericId(userId);
    
    console.log(`   📤 Calling ${SC_BLOCKCHAIN_URL}/api/submit-change`);
    console.log(`   📤 Payload: userId=${numericId}, hash=${hash.substring(0, 20)}...`);
    
    try {
        const response = await fetch(`${SC_BLOCKCHAIN_URL}/api/submit-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: numericId,
                hash: hash
            })
        });

        const result = await response.json();
        console.log(`   📥 Response:`, result);

        if (!response.ok || !result.success) {
            const errorMsg = result.error || 'Failed to store hash on blockchain';
            
            // Check if it's a temporary/retryable error
            const isRetryable = errorMsg.includes('Temporary') || 
                               errorMsg.includes('timeout') ||
                               errorMsg.includes('rate limit') ||
                               errorMsg.includes('internal error');
            
            if (isRetryable && retryCount < MAX_RETRIES) {
                console.log(`   ⏳ Temporary error, retrying in ${RETRY_DELAY/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return await storeOnPolygon(userId, hash, retryCount + 1);
            }
            
            throw new Error(errorMsg);
        }

        return {
            success: true,
            tx_id: result.txHash,
            hash,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        // Network errors - also retry
        const isNetworkError = error.message.includes('fetch failed') || 
                              error.message.includes('ECONNRESET') ||
                              error.message.includes('ETIMEDOUT');
        
        if (isNetworkError && retryCount < MAX_RETRIES) {
            console.log(`   ⏳ Network error, retrying in ${RETRY_DELAY/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return await storeOnPolygon(userId, hash, retryCount + 1);
        }
        
        console.error(`   ❌ Fetch error details:`, error.message);
        throw error;
    }
}

/**
 * Fetch all users from ci_erp_users
 */
async function fetchUsers() {
    const query = `
        SELECT 
            user_id, user_role_id, user_type, company_id, 
            first_name, middle_name, last_name, email, username,
            company_name, trading_name, registration_no, government_tax, 
            company_type_id, profile_photo, contact_number, gender,
            address_1, city_2, state_2, country_2, city, state, zipcode, country, address_2,
            last_login_date, last_logout_date, last_login_ip, is_logged_in, is_active,
            created_at, custome_unique_id, age,
            police_station_address, police_station_city, police_station_state,
            police_station_country, police_station_pincode, police_station_district,
            police_station_tehsil, police_station_village
        FROM ${SCHEMA}.ci_erp_users
        ORDER BY user_id
        LIMIT 10
    `;

    try {
        const result = await pool.query(query);
        console.log(`📊 Found ${result.rows.length} users in ci_erp_users`);
        return result.rows;
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
        throw error;
    }
}

/**
 * Fetch user details from ci_erp_users_details (if exists)
 */
async function fetchUserDetails(userId) {
    try {
        const query = `SELECT * FROM ${SCHEMA}.ci_erp_users_details WHERE user_id = $1`;
        const result = await pool.query(query, [userId]);
        return result.rows[0] || null;
    } catch (error) {
        // Table might not exist or other error - return null
        return null;
    }
}

/**
 * Check if user already exists in user_chain_records
 */
async function userRecordExists(userId, hash) {
    const query = `
        SELECT id FROM ${SCHEMA}.user_chain_records 
        WHERE user_id = $1 AND hash_value = $2
    `;
    const result = await pool.query(query, [userId, hash]);
    return result.rows.length > 0;
}

/**
 * Save record to user_chain_records table
 */
async function saveUserChainRecord(id, userId, dataJson, hashValue, blockchainTxId, operationType = 'INSERT') {
    const query = `
        INSERT INTO ${SCHEMA}.user_chain_records 
        (id, user_id, data_json, hash_value, blockchain_tx_id, operation_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
    `;
    
    const values = [id, userId, dataJson, hashValue, blockchainTxId, operationType];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Process a single user
 */
async function processUser(user, index, total) {
    const userId = user.user_id?.toString() || user.user_id;
    
    try {
        // Fetch additional details if available
        const userDetails = await fetchUserDetails(userId);
        
        // Combine user data with details
        const dataJson = {
            ...user,
            details: userDetails
        };
        
        // Remove sensitive fields from hash computation
        const dataForHash = { ...dataJson };
        delete dataForHash.password;
        delete dataForHash.last_login_ip;
        
        // Compute hash
        const hash = computeHash(dataForHash);
        
        // Check if already processed with same hash
        const exists = await userRecordExists(userId, hash);
        if (exists) {
            console.log(`⏭️  [${index + 1}/${total}] User ${userId} already processed (same hash)`);
            return { skipped: true, userId };
        }
        
        // Store on blockchain
        console.log(`🔗 [${index + 1}/${total}] Storing user ${userId} on blockchain...`);
        const blockchainResult = await storeOnBlockchain(userId, hash);
        
        // Save to database
        const id = uuidv4();
        await saveUserChainRecord(id, userId, dataJson, hash, blockchainResult.tx_id, 'INITIAL_MIGRATION');
        
        console.log(`✅ [${index + 1}/${total}] User ${userId} - TX: ${blockchainResult.tx_id?.substring(0, 20)}...`);
        
        return { success: true, userId, tx_id: blockchainResult.tx_id };
        
    } catch (error) {
        console.error(`❌ [${index + 1}/${total}] User ${userId} failed:`, error.message);
        return { error: true, userId, message: error.message };
    }
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main migration function
 */
async function migrate() {
    console.log('🚀 Starting User Blockchain Migration');
    console.log(`📋 Mode: ${BLOCKCHAIN_MODE.toUpperCase()}`);
    console.log(`📋 Schema: ${SCHEMA}`);
    console.log(`📋 Blockchain URL: ${SC_BLOCKCHAIN_URL}`);
    console.log('-----------------------------------');
    
    const startTime = Date.now();
    const stats = { success: 0, skipped: 0, errors: 0 };
    
    try {
        // Step 1: Create table
        await createTable();
        
        // Step 2: Fetch all users
        const users = await fetchUsers();
        
        if (users.length === 0) {
            console.log('⚠️ No users found to migrate');
            return;
        }
        
        // Step 3: Process each user
        for (let i = 0; i < users.length; i++) {
            const result = await processUser(users[i], i, users.length);
            
            if (result.skipped) stats.skipped++;
            else if (result.error) stats.errors++;
            else stats.success++;
            
            // Add delay between blockchain transactions (only in polygon mode)
            if (BLOCKCHAIN_MODE === 'polygon' && i < users.length - 1) {
                await sleep(DELAY_BETWEEN_TX);
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('-----------------------------------');
        console.log('📊 Migration Complete!');
        console.log(`   ✅ Success: ${stats.success}`);
        console.log(`   ⏭️  Skipped: ${stats.skipped}`);
        console.log(`   ❌ Errors: ${stats.errors}`);
        console.log(`   ⏱️  Duration: ${duration}s`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

// Run migration
migrate();

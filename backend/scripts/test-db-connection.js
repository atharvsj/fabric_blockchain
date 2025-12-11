/**
 * Database Connection Test Script
 * Run this script to verify PostgreSQL connection is working
 * Usage: node scripts/test-db-connection.js
 */

const pool = require('../config/db.config');

async function testConnection() {
    console.log('🔄 Testing PostgreSQL connection...\n');

    try {
        // Test basic connection
        const client = await pool.connect();
        console.log('✅ Successfully connected to PostgreSQL!\n');

        // Get database info
        const dbInfoResult = await client.query('SELECT current_database(), current_user, version()');
        console.log('📊 Database Info:');
        console.log(`   Database: ${dbInfoResult.rows[0].current_database}`);
        console.log(`   User: ${dbInfoResult.rows[0].current_user}`);
        console.log(`   Version: ${dbInfoResult.rows[0].version.split(',')[0]}\n`);

        // Check if 'records' table exists in 'fabric_test' schema
        const schema = process.env.DB_SCHEMA || 'fabric_test';
        const tableCheckResult = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = $1 
                AND table_name = 'records'
            );
        `, [schema]);

        if (tableCheckResult.rows[0].exists) {
            console.log('✅ Table "records" exists!\n');

            // Get table structure
            const columnsResult = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = 'records'
                ORDER BY ordinal_position;
            `, [schema]);

            console.log('📋 Table Structure:');
            console.log('   ┌─────────────────────┬───────────────────┬──────────────┐');
            console.log('   │ Column              │ Type              │ Nullable     │');
            console.log('   ├─────────────────────┼───────────────────┼──────────────┤');
            columnsResult.rows.forEach(col => {
                const colName = col.column_name.padEnd(19);
                const dataType = col.data_type.padEnd(17);
                const nullable = col.is_nullable.padEnd(12);
                console.log(`   │ ${colName} │ ${dataType} │ ${nullable} │`);
            });
            console.log('   └─────────────────────┴───────────────────┴──────────────┘\n');

            // Count records
            const countResult = await client.query(`SELECT COUNT(*) FROM ${schema}.records`);
            console.log(`📈 Total records in table: ${countResult.rows[0].count}\n`);
        } else {
            console.log('⚠️  Table "records" does not exist yet.\n');
            console.log('   You can create it with the following SQL:\n');
            console.log(`   CREATE TABLE records (
       id             UUID PRIMARY KEY,
       title          VARCHAR(255) NOT NULL,
       owner_name     VARCHAR(255) NOT NULL,
       data_json      JSONB NOT NULL,
       hash_value     VARCHAR(200),
       blockchain_tx_id VARCHAR(200),
       created_at     TIMESTAMP DEFAULT NOW()
   );`);
        }

        // Release the client
        client.release();
        console.log('✅ Connection test completed successfully!');

    } catch (error) {
        console.error('❌ Connection failed!\n');
        console.error('Error details:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Tip: Make sure PostgreSQL is running on localhost:5432');
        } else if (error.code === '3D000') {
            console.log('\n💡 Tip: Database "fabric_test" does not exist. Create it first.');
        } else if (error.code === '28P01') {
            console.log('\n💡 Tip: Invalid password. Check your DB_PASSWORD in .env file.');
        }
    } finally {
        // Close the pool
        await pool.end();
    }
}

testConnection();

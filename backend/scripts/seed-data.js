/**
 * Seed Script - Add Dummy Data to Records Table
 * Run this script to populate the database with sample records
 * Usage: node scripts/seed-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db.config');
const { computeHash } = require('../utils/hash');

const SCHEMA = process.env.DB_SCHEMA || 'fabric_test';

// Dummy records data
const dummyRecords = [
    {
        title: "Backend Developer Course Certificate",
        owner_name: "Rohan Sharma",
        data_json: {
            certificate_id: "CERT-2025-001",
            course_name: "Blockchain Backend Fundamentals",
            issuer: "Tech Academy",
            issue_date: "2025-01-10",
            expiry_date: null,
            grade: "A",
            extra_notes: "Completed with distinction"
        }
    },
    {
        title: "Property Ownership Document",
        owner_name: "Priya Patel",
        data_json: {
            document_id: "DOC-PROP-2025-042",
            property_type: "Residential Apartment",
            location: "Mumbai, Maharashtra",
            area_sqft: 1250,
            registration_date: "2025-02-15",
            registry_office: "Mumbai Sub-Registrar Office"
        }
    },
    {
        title: "Medical Record - Lab Report",
        owner_name: "Amit Kumar",
        data_json: {
            report_id: "LAB-2025-00789",
            test_type: "Complete Blood Count",
            lab_name: "Apollo Diagnostics",
            test_date: "2025-03-20",
            doctor_name: "Dr. Sunita Verma",
            results: {
                hemoglobin: "14.5 g/dL",
                wbc_count: "7500 /cumm",
                platelet_count: "250000 /cumm"
            }
        }
    },
    {
        title: "Academic Transcript",
        owner_name: "Sneha Reddy",
        data_json: {
            transcript_id: "TRANS-2025-1234",
            institution: "IIT Bombay",
            program: "B.Tech Computer Science",
            graduation_year: 2024,
            cgpa: 8.75,
            honors: "First Class with Distinction"
        }
    },
    {
        title: "Vehicle Registration Certificate",
        owner_name: "Vikram Singh",
        data_json: {
            rc_number: "MH-01-AB-1234",
            vehicle_type: "Four Wheeler",
            make: "Maruti Suzuki",
            model: "Swift VXI",
            year: 2024,
            engine_number: "K12N-5678901",
            chassis_number: "MA3FJEB1S00123456",
            registration_date: "2024-06-15"
        }
    }
];

async function seedData() {
    console.log('🌱 Seeding dummy data into records table...\n');

    try {
        for (let i = 0; i < dummyRecords.length; i++) {
            const record = dummyRecords[i];
            const id = uuidv4();
            const hash = computeHash(record.data_json);
            const mockTxId = `mock_tx_seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const query = `
                INSERT INTO ${SCHEMA}.records 
                (id, title, owner_name, data_json, hash_value, blockchain_tx_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING id, title, owner_name
            `;

            const values = [
                id,
                record.title,
                record.owner_name,
                record.data_json,
                hash,
                mockTxId
            ];

            const result = await pool.query(query, values);
            console.log(`✅ Record ${i + 1}: ${result.rows[0].title}`);
            console.log(`   ID: ${result.rows[0].id}`);
            console.log(`   Owner: ${result.rows[0].owner_name}`);
            console.log(`   Hash: ${hash.substring(0, 20)}...`);
            console.log('');
        }

        // Show count
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${SCHEMA}.records`);
        console.log('='.repeat(50));
        console.log(`📊 Total records in database: ${countResult.rows[0].count}`);
        console.log('✅ Seeding completed successfully!\n');

    } catch (error) {
        console.error('❌ Error seeding data:', error.message);
    } finally {
        await pool.end();
    }
}

seedData();

/**
 * API Test Script
 * Run this to test all record endpoints
 * Usage: node scripts/test-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const testData = {
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
};

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Record API Endpoints\n');
    console.log('='.repeat(50));

    let createdRecordId = null;

    try {
        // Test 1: Health Check
        console.log('\n📋 Test 1: Health Check');
        const health = await makeRequest('GET', '/api/health');
        console.log(`   Status: ${health.status}`);
        console.log(`   Response:`, health.data);

        // Test 2: Get Blockchain Status
        console.log('\n📋 Test 2: Blockchain Status');
        const status = await makeRequest('GET', '/api/records/blockchain/status');
        console.log(`   Status: ${status.status}`);
        console.log(`   Mode: ${status.data.data?.mode}`);

        // Test 3: Create Record
        console.log('\n📋 Test 3: Create Record');
        const createResult = await makeRequest('POST', '/api/records', testData);
        console.log(`   Status: ${createResult.status}`);
        console.log(`   Message: ${createResult.data.message}`);
        
        if (createResult.data.data) {
            createdRecordId = createResult.data.data.record.id;
            console.log(`   Record ID: ${createdRecordId}`);
            console.log(`   Hash: ${createResult.data.data.onChainProof.hash}`);
            console.log(`   TX ID: ${createResult.data.data.onChainProof.transactionId}`);
        }

        // Test 4: Get All Records
        console.log('\n📋 Test 4: Get All Records');
        const allRecords = await makeRequest('GET', '/api/records');
        console.log(`   Status: ${allRecords.status}`);
        console.log(`   Total: ${allRecords.data.data?.pagination?.total}`);

        // Test 5: Get Single Record
        if (createdRecordId) {
            console.log('\n📋 Test 5: Get Single Record');
            const record = await makeRequest('GET', `/api/records/${createdRecordId}`);
            console.log(`   Status: ${record.status}`);
            console.log(`   Title: ${record.data.data?.title}`);
        }

        // Test 6: Verify Record
        if (createdRecordId) {
            console.log('\n📋 Test 6: Verify Record Integrity');
            const verify = await makeRequest('GET', `/api/records/${createdRecordId}/verify`);
            console.log(`   Status: ${verify.status}`);
            console.log(`   Valid: ${verify.data.data?.verification?.valid}`);
            console.log(`   Reason: ${verify.data.data?.verification?.reason}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests completed!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.log('\n💡 Make sure the server is running: node app.js');
    }
}

runTests();

/*
 * Sample Chaincode for Record Hash Storage
 * This is a Hyperledger Fabric chaincode (smart contract) written in JavaScript
 * 
 * Deploy this to your Fabric network.
 * Your blockchain developer should use this as a reference.
 * 
 * Functions:
 * - StoreRecordHash: Store a record's hash on the blockchain
 * - GetRecordHash: Retrieve a record's hash from the blockchain
 * - RecordExists: Check if a record exists
 * - GetAllRecords: Get all stored record hashes
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class RecordHashContract extends Contract {

    /**
     * Initialize the ledger (optional - called once when chaincode is instantiated)
     */
    async InitLedger(ctx) {
        console.log('RecordHash Chaincode Initialized');
        return 'Chaincode initialized successfully';
    }

    /**
     * Store a record hash on the blockchain
     * @param {Context} ctx - Transaction context
     * @param {string} recordId - Unique identifier for the record (UUID)
     * @param {string} hash - SHA-256 hash of the record data
     * @param {string} timestamp - ISO timestamp when hash was created
     * @returns {Object} Transaction result
     */
    async StoreRecordHash(ctx, recordId, hash, timestamp) {
        // Validate inputs
        if (!recordId || !hash) {
            throw new Error('recordId and hash are required');
        }

        // Check if record already exists
        const existingRecord = await ctx.stub.getState(recordId);
        if (existingRecord && existingRecord.length > 0) {
            throw new Error(`Record ${recordId} already exists on the blockchain`);
        }

        // Create the record object to store
        const recordHash = {
            docType: 'recordHash',
            recordId: recordId,
            hash: hash,
            timestamp: timestamp || new Date().toISOString(),
            createdBy: ctx.clientIdentity.getID(),
            txId: ctx.stub.getTxID()
        };

        // Store the record hash
        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(recordHash)));

        // Emit an event for the transaction
        ctx.stub.setEvent('RecordHashStored', Buffer.from(JSON.stringify({
            recordId: recordId,
            hash: hash,
            txId: ctx.stub.getTxID()
        })));

        console.log(`Stored hash for record: ${recordId}`);

        return JSON.stringify({
            success: true,
            recordId: recordId,
            hash: hash,
            txId: ctx.stub.getTxID(),
            timestamp: recordHash.timestamp
        });
    }

    /**
     * Get a record hash from the blockchain
     * @param {Context} ctx - Transaction context
     * @param {string} recordId - Record identifier
     * @returns {Object} Stored record hash data
     */
    async GetRecordHash(ctx, recordId) {
        const recordJSON = await ctx.stub.getState(recordId);
        
        if (!recordJSON || recordJSON.length === 0) {
            return JSON.stringify({
                exists: false,
                recordId: recordId,
                message: 'Record not found on blockchain'
            });
        }

        const record = JSON.parse(recordJSON.toString());
        return JSON.stringify({
            exists: true,
            ...record
        });
    }

    /**
     * Check if a record exists on the blockchain
     * @param {Context} ctx - Transaction context
     * @param {string} recordId - Record identifier
     * @returns {boolean} True if record exists
     */
    async RecordExists(ctx, recordId) {
        const recordJSON = await ctx.stub.getState(recordId);
        return recordJSON && recordJSON.length > 0;
    }

    /**
     * Update a record hash (for re-hashing after off-chain data update)
     * @param {Context} ctx - Transaction context
     * @param {string} recordId - Record identifier
     * @param {string} newHash - New SHA-256 hash
     * @param {string} timestamp - Timestamp of update
     * @returns {Object} Update result
     */
    async UpdateRecordHash(ctx, recordId, newHash, timestamp) {
        // Check if record exists
        const existingRecordJSON = await ctx.stub.getState(recordId);
        if (!existingRecordJSON || existingRecordJSON.length === 0) {
            throw new Error(`Record ${recordId} does not exist`);
        }

        const existingRecord = JSON.parse(existingRecordJSON.toString());

        // Create updated record with history
        const updatedRecord = {
            docType: 'recordHash',
            recordId: recordId,
            hash: newHash,
            previousHash: existingRecord.hash,
            timestamp: timestamp || new Date().toISOString(),
            updatedBy: ctx.clientIdentity.getID(),
            txId: ctx.stub.getTxID(),
            originalTimestamp: existingRecord.timestamp
        };

        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(updatedRecord)));

        // Emit update event
        ctx.stub.setEvent('RecordHashUpdated', Buffer.from(JSON.stringify({
            recordId: recordId,
            oldHash: existingRecord.hash,
            newHash: newHash,
            txId: ctx.stub.getTxID()
        })));

        return JSON.stringify({
            success: true,
            recordId: recordId,
            previousHash: existingRecord.hash,
            newHash: newHash,
            txId: ctx.stub.getTxID()
        });
    }

    /**
     * Get the history of hash changes for a record
     * @param {Context} ctx - Transaction context
     * @param {string} recordId - Record identifier
     * @returns {Array} History of all hash values
     */
    async GetRecordHistory(ctx, recordId) {
        const iterator = await ctx.stub.getHistoryForKey(recordId);
        const history = [];

        let result = await iterator.next();
        while (!result.done) {
            const record = {
                txId: result.value.txId,
                timestamp: result.value.timestamp,
                isDelete: result.value.isDelete
            };

            if (!result.value.isDelete) {
                record.value = JSON.parse(result.value.value.toString());
            }

            history.push(record);
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(history);
    }

    /**
     * Get all record hashes (with pagination)
     * @param {Context} ctx - Transaction context
     * @param {string} pageSize - Number of records per page
     * @param {string} bookmark - Bookmark for pagination
     * @returns {Object} Paginated results
     */
    async GetAllRecordHashes(ctx, pageSize = '10', bookmark = '') {
        const queryString = {
            selector: {
                docType: 'recordHash'
            }
        };

        const { iterator, metadata } = await ctx.stub.getQueryResultWithPagination(
            JSON.stringify(queryString),
            parseInt(pageSize),
            bookmark
        );

        const records = [];
        let result = await iterator.next();
        
        while (!result.done) {
            records.push(JSON.parse(result.value.value.toString()));
            result = await iterator.next();
        }

        await iterator.close();

        return JSON.stringify({
            records: records,
            fetchedRecordsCount: metadata.fetchedRecordsCount,
            bookmark: metadata.bookmark
        });
    }
}

module.exports = RecordHashContract;

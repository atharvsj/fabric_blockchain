/**
 * Hash Utility
 * Creates SHA-256 hashes for record data
 */

const crypto = require('crypto');

/**
 * Canonicalize JSON object for consistent hashing
 * Sorts keys alphabetically and removes whitespace
 * @param {Object} obj - Object to canonicalize
 * @returns {string} Canonical JSON string
 */
const canonicalizeJSON = (obj) => {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    
    if (typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    
    if (Array.isArray(obj)) {
        return '[' + obj.map(item => canonicalizeJSON(item)).join(',') + ']';
    }
    
    // Sort keys alphabetically for consistent ordering
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
        const value = canonicalizeJSON(obj[key]);
        return `"${key}":${value}`;
    });
    
    return '{' + pairs.join(',') + '}';
};

/**
 * Compute SHA-256 hash of data
 * @param {Object} data - Data object to hash
 * @returns {string} SHA-256 hash as hex string (with 0x prefix)
 */
const computeHash = (data) => {
    const canonicalString = canonicalizeJSON(data);
    const hash = crypto.createHash('sha256').update(canonicalString).digest('hex');
    return `0x${hash}`;
};

/**
 * Verify if data matches the given hash
 * @param {Object} data - Data object to verify
 * @param {string} expectedHash - Expected hash value
 * @returns {boolean} True if hash matches
 */
const verifyHash = (data, expectedHash) => {
    const computedHash = computeHash(data);
    return computedHash === expectedHash;
};

module.exports = {
    canonicalizeJSON,
    computeHash,
    verifyHash
};

/**
 * Fabric Network Configuration
 * This file contains all the configuration settings for connecting to the Hyperledger Fabric network
 */

const path = require('path');

module.exports = {
    // Channel name
    channelName: process.env.CHANNEL_NAME || 'mychannel',
    
    // Chaincode name (smart contract)
    chaincodeName: process.env.CHAINCODE_NAME || 'basic',
    
    // MSP ID for the organization
    mspId: process.env.MSP_ID || 'Org1MSP',
    
    // Path to the connection profile
    connectionProfilePath: process.env.CONNECTION_PROFILE_PATH || 
        path.join(__dirname, 'connection-profile.json'),
    
    // Wallet path for storing identities
    walletPath: process.env.WALLET_PATH || 
        path.join(__dirname, '..', 'wallet'),
    
    // CA (Certificate Authority) settings
    caSettings: {
        caHostName: process.env.CA_HOST_NAME || 'ca.org1.example.com',
        caUrl: process.env.CA_URL || 'https://localhost:7054',
        adminUserId: process.env.CA_ADMIN_ID || 'admin',
        adminUserPasswd: process.env.CA_ADMIN_PASSWORD || 'adminpw'
    },
    
    // Gateway discovery settings
    gatewayDiscovery: {
        enabled: true,
        asLocalhost: process.env.AS_LOCALHOST === 'true' || true
    }
};

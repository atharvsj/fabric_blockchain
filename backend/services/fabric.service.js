/**
 * Fabric Network Service
 * Handles all interactions with the Hyperledger Fabric network
 */

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');
const fabricConfig = require('../config/fabric.config');
const logger = require('../utils/logger');

class FabricService {
    constructor() {
        this.gateway = null;
        this.network = null;
        this.contract = null;
        this.wallet = null;
    }

    /**
     * Load the connection profile
     * @returns {Object} Connection profile object
     */
    loadConnectionProfile() {
        const ccpPath = fabricConfig.connectionProfilePath;
        const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        return JSON.parse(ccpJSON);
    }

    /**
     * Get or create wallet instance
     * @returns {Promise<Wallet>} Wallet instance
     */
    async getWallet() {
        if (!this.wallet) {
            this.wallet = await Wallets.newFileSystemWallet(fabricConfig.walletPath);
        }
        return this.wallet;
    }

    /**
     * Enroll the admin user
     * @returns {Promise<Object>} Enrollment result
     */
    async enrollAdmin() {
        try {
            const ccp = this.loadConnectionProfile();
            const wallet = await this.getWallet();

            // Check if admin is already enrolled
            const identity = await wallet.get(fabricConfig.caSettings.adminUserId);
            if (identity) {
                logger.info('Admin user already exists in the wallet');
                return { success: true, message: 'Admin already enrolled' };
            }

            // Create a new CA client
            const caInfo = ccp.certificateAuthorities[fabricConfig.caSettings.caHostName];
            const caTLSCACerts = caInfo.tlsCACerts ? caInfo.tlsCACerts.path : null;
            const ca = new FabricCAServices(
                caInfo.url,
                { trustedRoots: caTLSCACerts, verify: false },
                caInfo.caName
            );

            // Enroll the admin user
            const enrollment = await ca.enroll({
                enrollmentID: fabricConfig.caSettings.adminUserId,
                enrollmentSecret: fabricConfig.caSettings.adminUserPasswd
            });

            // Import admin identity into the wallet
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes()
                },
                mspId: fabricConfig.mspId,
                type: 'X.509'
            };

            await wallet.put(fabricConfig.caSettings.adminUserId, x509Identity);
            logger.info('Successfully enrolled admin user and imported it into the wallet');

            return { success: true, message: 'Admin enrolled successfully' };
        } catch (error) {
            logger.error('Failed to enroll admin user:', error);
            throw error;
        }
    }

    /**
     * Register and enroll a new user
     * @param {string} userId - User ID to register
     * @param {string} affiliation - User affiliation (e.g., 'org1.department1')
     * @returns {Promise<Object>} Registration result
     */
    async registerUser(userId, affiliation = 'org1.department1') {
        try {
            const ccp = this.loadConnectionProfile();
            const wallet = await this.getWallet();

            // Check if user is already registered
            const userIdentity = await wallet.get(userId);
            if (userIdentity) {
                logger.info(`User ${userId} already exists in the wallet`);
                return { success: true, message: 'User already registered' };
            }

            // Check if admin is enrolled
            const adminIdentity = await wallet.get(fabricConfig.caSettings.adminUserId);
            if (!adminIdentity) {
                throw new Error('Admin user does not exist in the wallet. Enroll admin first.');
            }

            // Build admin user object for CA
            const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await provider.getUserContext(adminIdentity, fabricConfig.caSettings.adminUserId);

            // Create CA client
            const caInfo = ccp.certificateAuthorities[fabricConfig.caSettings.caHostName];
            const caTLSCACerts = caInfo.tlsCACerts ? caInfo.tlsCACerts.path : null;
            const ca = new FabricCAServices(
                caInfo.url,
                { trustedRoots: caTLSCACerts, verify: false },
                caInfo.caName
            );

            // Register the user
            const secret = await ca.register({
                affiliation,
                enrollmentID: userId,
                role: 'client'
            }, adminUser);

            // Enroll the user
            const enrollment = await ca.enroll({
                enrollmentID: userId,
                enrollmentSecret: secret
            });

            // Import user identity into wallet
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes()
                },
                mspId: fabricConfig.mspId,
                type: 'X.509'
            };

            await wallet.put(userId, x509Identity);
            logger.info(`Successfully registered and enrolled user ${userId}`);

            return { success: true, message: `User ${userId} registered successfully` };
        } catch (error) {
            logger.error(`Failed to register user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Connect to the Fabric network
     * @param {string} userId - User ID to use for connection
     * @returns {Promise<void>}
     */
    async connect(userId) {
        try {
            const wallet = await this.getWallet();
            const ccp = this.loadConnectionProfile();

            // Check if user exists in wallet
            const identity = await wallet.get(userId);
            if (!identity) {
                throw new Error(`User ${userId} does not exist in the wallet`);
            }

            // Create a new gateway instance
            this.gateway = new Gateway();

            // Connect to the gateway
            await this.gateway.connect(ccp, {
                wallet,
                identity: userId,
                discovery: fabricConfig.gatewayDiscovery
            });

            // Get the network (channel)
            this.network = await this.gateway.getNetwork(fabricConfig.channelName);

            // Get the contract
            this.contract = this.network.getContract(fabricConfig.chaincodeName);

            logger.info(`Connected to Fabric network as ${userId}`);
        } catch (error) {
            logger.error('Failed to connect to Fabric network:', error);
            throw error;
        }
    }

    /**
     * Disconnect from the Fabric network
     */
    disconnect() {
        if (this.gateway) {
            this.gateway.disconnect();
            this.gateway = null;
            this.network = null;
            this.contract = null;
            logger.info('Disconnected from Fabric network');
        }
    }

    /**
     * Submit a transaction to the chaincode (write operation)
     * @param {string} userId - User ID for the transaction
     * @param {string} functionName - Chaincode function name
     * @param {...string} args - Function arguments
     * @returns {Promise<Object>} Transaction result
     */
    async submitTransaction(userId, functionName, ...args) {
        try {
            await this.connect(userId);

            logger.info(`Submitting transaction: ${functionName} with args: ${args.join(', ')}`);
            
            const result = await this.contract.submitTransaction(functionName, ...args);
            
            this.disconnect();

            // Parse result if it's JSON
            try {
                return JSON.parse(result.toString());
            } catch {
                return result.toString();
            }
        } catch (error) {
            this.disconnect();
            logger.error(`Failed to submit transaction ${functionName}:`, error);
            throw error;
        }
    }

    /**
     * Evaluate a transaction (read operation - no ledger update)
     * @param {string} userId - User ID for the query
     * @param {string} functionName - Chaincode function name
     * @param {...string} args - Function arguments
     * @returns {Promise<Object>} Query result
     */
    async evaluateTransaction(userId, functionName, ...args) {
        try {
            await this.connect(userId);

            logger.info(`Evaluating transaction: ${functionName} with args: ${args.join(', ')}`);
            
            const result = await this.contract.evaluateTransaction(functionName, ...args);
            
            this.disconnect();

            // Parse result if it's JSON
            try {
                return JSON.parse(result.toString());
            } catch {
                return result.toString();
            }
        } catch (error) {
            this.disconnect();
            logger.error(`Failed to evaluate transaction ${functionName}:`, error);
            throw error;
        }
    }

    /**
     * Check if a user identity exists in the wallet
     * @param {string} userId - User ID to check
     * @returns {Promise<boolean>} True if identity exists
     */
    async identityExists(userId) {
        const wallet = await this.getWallet();
        const identity = await wallet.get(userId);
        return !!identity;
    }

    /**
     * Get all identities from wallet
     * @returns {Promise<string[]>} List of identity labels
     */
    async listIdentities() {
        const wallet = await this.getWallet();
        return await wallet.list();
    }
}

// Export singleton instance
module.exports = new FabricService();

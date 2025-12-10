/**
 * Fabric Controller
 * Handles HTTP requests for Fabric network operations
 */

const fabricService = require('../services/fabric.service');
const { successResponse, errorResponse } = require('../utils/response.helper');
const { asyncHandler } = require('../utils/error.handler');
const logger = require('../utils/logger');

/**
 * Enroll admin user
 * POST /api/fabric/enroll-admin
 */
const enrollAdmin = asyncHandler(async (req, res) => {
    const result = await fabricService.enrollAdmin();
    return successResponse(res, result, 'Admin enrolled successfully');
});

/**
 * Register a new user
 * POST /api/fabric/register-user
 */
const registerUser = asyncHandler(async (req, res) => {
    const { userId, affiliation } = req.body;
    
    if (!userId) {
        return errorResponse(res, 'User ID is required', 400);
    }
    
    const result = await fabricService.registerUser(userId, affiliation);
    return successResponse(res, result, 'User registered successfully', 201);
});

/**
 * Submit a transaction (write to ledger)
 * POST /api/fabric/submit
 */
const submitTransaction = asyncHandler(async (req, res) => {
    const { userId, functionName, args } = req.body;
    
    if (!userId || !functionName) {
        return errorResponse(res, 'userId and functionName are required', 400);
    }
    
    // Check if user identity exists
    const identityExists = await fabricService.identityExists(userId);
    if (!identityExists) {
        return errorResponse(res, `User ${userId} does not exist in the wallet`, 404);
    }
    
    const result = await fabricService.submitTransaction(
        userId, 
        functionName, 
        ...(args || [])
    );
    
    return successResponse(res, result, 'Transaction submitted successfully');
});

/**
 * Evaluate a transaction (query ledger)
 * POST /api/fabric/query
 */
const evaluateTransaction = asyncHandler(async (req, res) => {
    const { userId, functionName, args } = req.body;
    
    if (!userId || !functionName) {
        return errorResponse(res, 'userId and functionName are required', 400);
    }
    
    // Check if user identity exists
    const identityExists = await fabricService.identityExists(userId);
    if (!identityExists) {
        return errorResponse(res, `User ${userId} does not exist in the wallet`, 404);
    }
    
    const result = await fabricService.evaluateTransaction(
        userId, 
        functionName, 
        ...(args || [])
    );
    
    return successResponse(res, result, 'Query executed successfully');
});

/**
 * List all identities in wallet
 * GET /api/fabric/identities
 */
const listIdentities = asyncHandler(async (req, res) => {
    const identities = await fabricService.listIdentities();
    return successResponse(res, { identities }, 'Identities retrieved successfully');
});

/**
 * Check if identity exists
 * GET /api/fabric/identity/:userId
 */
const checkIdentity = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    if (!userId) {
        return errorResponse(res, 'User ID is required', 400);
    }
    
    const exists = await fabricService.identityExists(userId);
    return successResponse(res, { userId, exists }, 'Identity check completed');
});

module.exports = {
    enrollAdmin,
    registerUser,
    submitTransaction,
    evaluateTransaction,
    listIdentities,
    checkIdentity
};

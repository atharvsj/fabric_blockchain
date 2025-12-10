/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */

const authService = require('../services/auth.service');
const fabricService = require('../services/fabric.service');
const { successResponse, errorResponse } = require('../utils/response.helper');
const { asyncHandler } = require('../utils/error.handler');
const logger = require('../utils/logger');

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return errorResponse(res, 'Username and password are required', 400);
    }
    
    if (password.length < 6) {
        return errorResponse(res, 'Password must be at least 6 characters', 400);
    }
    
    // Register user in auth service
    const result = await authService.register(username, password, role);
    
    // Also register user identity in Fabric wallet
    try {
        await fabricService.registerUser(username);
    } catch (fabricError) {
        logger.warn(`Could not register user in Fabric network: ${fabricError.message}`);
        // Continue even if Fabric registration fails (network might not be available)
    }
    
    return successResponse(res, result, 'User registered successfully', 201);
});

/**
 * Login user
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return errorResponse(res, 'Username and password are required', 400);
    }
    
    const result = await authService.login(username, password);
    return successResponse(res, result, 'Login successful');
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
const getProfile = asyncHandler(async (req, res) => {
    const { username } = req.user;
    
    const user = authService.getUser(username);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }
    
    // Check if user has Fabric identity
    const hasFabricIdentity = await fabricService.identityExists(username);
    
    return successResponse(res, { 
        ...user, 
        hasFabricIdentity 
    }, 'Profile retrieved successfully');
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
    const { username } = req.user;
    
    const user = authService.getUser(username);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }
    
    const token = authService.generateToken(user);
    
    return successResponse(res, { token }, 'Token refreshed successfully');
});

module.exports = {
    register,
    login,
    getProfile,
    refreshToken
};

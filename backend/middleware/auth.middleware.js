/**
 * Authentication Middleware
 * JWT token verification and role-based authorization
 */

const authService = require('../services/auth.service');
const { errorResponse } = require('../utils/response.helper');
const logger = require('../utils/logger');

/**
 * Authenticate middleware
 * Verifies JWT token and adds user to request object
 */
const authenticate = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return errorResponse(res, 'No authorization header provided', 401);
        }
        
        // Check if header starts with 'Bearer '
        if (!authHeader.startsWith('Bearer ')) {
            return errorResponse(res, 'Invalid authorization header format', 401);
        }
        
        // Extract token
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return errorResponse(res, 'No token provided', 401);
        }
        
        // Verify token
        const decoded = authService.verifyToken(token);
        
        // Add user info to request
        req.user = decoded;
        
        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        return errorResponse(res, 'Invalid or expired token', 401);
    }
};

/**
 * Authorization middleware
 * Checks if user has required role(s)
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 'Authentication required', 401);
        }
        
        if (!roles.includes(req.user.role)) {
            return errorResponse(res, 'Insufficient permissions', 403);
        }
        
        next();
    };
};

module.exports = {
    authenticate,
    authorize
};

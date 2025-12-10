/**
 * Authentication Service
 * Handles JWT token generation and verification
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// In a production app, you would use a database
// This is a simple in-memory store for demonstration
const users = new Map();

class AuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
        this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    }

    /**
     * Register a new user
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {string} role - User role (admin, user)
     * @returns {Promise<Object>} Registration result
     */
    async register(username, password, role = 'user') {
        try {
            // Check if user already exists
            if (users.has(username)) {
                throw new Error('User already exists');
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Store user
            users.set(username, {
                username,
                password: hashedPassword,
                role,
                createdAt: new Date()
            });

            logger.info(`User ${username} registered successfully`);

            return {
                success: true,
                message: 'User registered successfully',
                user: { username, role }
            };
        } catch (error) {
            logger.error('Registration error:', error);
            throw error;
        }
    }

    /**
     * Login user and generate JWT token
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise<Object>} Login result with token
     */
    async login(username, password) {
        try {
            // Find user
            const user = users.get(username);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                throw new Error('Invalid credentials');
            }

            // Generate JWT token
            const token = this.generateToken(user);

            logger.info(`User ${username} logged in successfully`);

            return {
                success: true,
                message: 'Login successful',
                token,
                user: {
                    username: user.username,
                    role: user.role
                }
            };
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Generate JWT token
     * @param {Object} user - User object
     * @returns {string} JWT token
     */
    generateToken(user) {
        const payload = {
            username: user.username,
            role: user.role
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiry
        });
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {Object} Decoded token payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Get user by username
     * @param {string} username - Username
     * @returns {Object|null} User object without password
     */
    getUser(username) {
        const user = users.get(username);
        if (!user) return null;

        return {
            username: user.username,
            role: user.role,
            createdAt: user.createdAt
        };
    }

    /**
     * Check if user exists
     * @param {string} username - Username
     * @returns {boolean} True if user exists
     */
    userExists(username) {
        return users.has(username);
    }
}

// Export singleton instance
module.exports = new AuthService();

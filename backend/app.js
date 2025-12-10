/**
 * Main Application Entry Point
 * Hyperledger Fabric Backend API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { globalErrorHandler } = require('./utils/error.handler');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Port configuration
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Hyperledger Fabric Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            fabric: '/api/fabric'
        }
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Global Error Handler
app.use(globalErrorHandler);

// Start server
app.listen(PORT, () => {
    logger.info(`=================================`);
    logger.info(`Hyperledger Fabric Backend API`);
    logger.info(`=================================`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API available at: http://localhost:${PORT}`);
    logger.info(`=================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise);
    logger.error('Reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;

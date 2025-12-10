/**
 * Logger Utility
 * Simple logging utility for the application
 */

const logLevels = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

/**
 * Format log message with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message) => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
};

/**
 * Logger object with different log levels
 */
const logger = {
    error: (message, error = null) => {
        console.error(formatLogMessage(logLevels.ERROR, message));
        if (error) {
            console.error('Error details:', error);
        }
    },
    
    warn: (message) => {
        console.warn(formatLogMessage(logLevels.WARN, message));
    },
    
    info: (message) => {
        console.log(formatLogMessage(logLevels.INFO, message));
    },
    
    debug: (message) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(formatLogMessage(logLevels.DEBUG, message));
        }
    }
};

module.exports = logger;

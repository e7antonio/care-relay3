/**
 * AlertaCare Domain - Entry Point
 * 
 * Centralizes all AlertaCare domain exports for clean imports.
 * 
 * @domain AlertaCare
 * @author AlertaCare Team
 */

// Models
const CircularBuffer = require('./models/CircularBuffer');
const ChannelKey = require('./models/ChannelKey');

// Services
const EventBufferService = require('./services/EventBufferService');

// Controllers
const StreamRestController = require('./controllers/StreamRestController');

// ===== DOMAIN FACTORY =====

/**
 * Create a complete AlertaCare domain instance
 * @param {Object} config - Domain configuration
 * @returns {Object} Domain services and controllers
 */
function createAlertaCareDomain(config = {}) {
    // Initialize service
    const eventBufferService = new EventBufferService(config);
    
    // Initialize controllers
    const streamRestController = new StreamRestController(eventBufferService);
    
    return {
        // Services
        eventBufferService,
        
        // Controllers
        streamRestController,
        
        // Models (for advanced usage)
        models: {
            CircularBuffer,
            ChannelKey
        },
        
        // Utilities
        utils: {
            createChannelKey: (meta) => new ChannelKey(meta),
            validateChannelFormat: ChannelKey.isValidFormat,
            getValidPositions: ChannelKey.getValidPositions,
            getValidOrigenes: ChannelKey.getValidOrigenes,
            getValidCanales: ChannelKey.getValidCanales
        }
    };
}

// ===== EXPORTS =====

module.exports = {
    // Factory
    createAlertaCareDomain,
    
    // Individual exports
    CircularBuffer,
    ChannelKey,
    EventBufferService,
    StreamRestController,
    
    // Constants
    DEFAULT_BUFFER_SIZE: 1080,
    CHANNEL_SUFFIX: '.tap'
}; 
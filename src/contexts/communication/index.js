/**
 * Real-time Communication Context
 * 
 * Bounded Context responsable de la comunicación universal en tiempo real.
 * Maneja conexiones, salas, mensajes y broadcasting.
 * 
 * @context Communication
 * @author AlertaCare Team
 */

// Domain Models
const Connection = require('./models/Connection');
const Room = require('./models/Room');
const Message = require('./models/Message');

// Domain Services
const CommunicationService = require('./services/CommunicationService');
const ConnectionManager = require('./services/ConnectionManager');
const RoomManager = require('./services/RoomManager');

// Ports (Adapters)
const WebSocketCommunicationAdapter = require('./adapters/WebSocketCommunicationAdapter');
const RestCommunicationAdapter = require('./adapters/RestCommunicationAdapter');

/**
 * Factory para crear el contexto completo de Communication
 * @param {Object} dependencies - Dependencias externas
 * @returns {Object} Contexto completo inicializado
 */
function createCommunicationContext(dependencies = {}) {
    // Initialize core services
    const connectionManager = new ConnectionManager();
    const roomManager = new RoomManager();
    
    const communicationService = new CommunicationService({
        connectionManager,
        roomManager,
        eventBus: dependencies.eventBus
    });

    // Initialize adapters (ports)
    const webSocketAdapter = new WebSocketCommunicationAdapter(communicationService);
    const restAdapter = new RestCommunicationAdapter(communicationService);

    return {
        // Core Services
        communicationService,
        connectionManager,
        roomManager,
        
        // Adapters (Ports)
        webSocketAdapter,
        restAdapter,
        
        // Models (for advanced usage)
        models: {
            Connection,
            Room,
            Message
        },
        
        // Utilities
        utils: {
            createConnection: (socketId, metadata) => new Connection(socketId, metadata),
            createRoom: (name) => new Room(name),
            createMessage: (from, to, content) => new Message(from, to, content)
        }
    };
}

module.exports = {
    createCommunicationContext,
    
    // Individual exports
    Connection,
    Room,
    Message,
    CommunicationService,
    ConnectionManager,
    RoomManager,
    WebSocketCommunicationAdapter,
    RestCommunicationAdapter
}; 
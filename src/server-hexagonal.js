/**
 * AlertaCare Relay Server - Hexagonal Architecture
 * 
 * Implementación completa de Arquitectura Hexagonal con Bounded Contexts.
 * Demuestra la separación de puertos y la comunicación entre contextos.
 * 
 * @architecture Hexagonal + DDD + Bounded Contexts
 * @author AlertaCare Team
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// ===== BOUNDED CONTEXTS =====
const { createAlertaCareDomain } = require('./domains/alertacare');
// const { createCommunicationContext } = require('./contexts/communication'); // Future implementation

// ===== INFRASTRUCTURE =====
// EventBus for inter-context communication (simple implementation)
class EventBus {
    constructor() {
        this.listeners = new Map();
    }
    
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(listener);
    }
    
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`EventBus error for event ${event}:`, error);
                }
            });
        }
    }
}

// ===== CONFIGURATION =====
const config = {
    port: process.env.PORT || 3000,
    bufferSize: parseInt(process.env.DEFAULT_BUFFER_SIZE) || 1080,
    cors: { origin: "*", methods: ["GET", "POST"] }
};

// ===== INITIALIZE INFRASTRUCTURE =====
const eventBus = new EventBus();

// ===== INITIALIZE BOUNDED CONTEXTS =====

// AlertaCare Context (medical monitoring)
const alertacare = createAlertaCareDomain({ 
    bufferSize: config.bufferSize,
    eventBus: eventBus 
});

// Communication Context (future - using simple implementation for now)
const communicationState = {
    connections: new Map(),
    rooms: new Map()
};

// ===== PORTS SETUP =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: config.cors });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ===== PORT: REST API (Management) =====

// AlertaCare Management Port
alertacare.streamRestController.registerRoutes(app);

// System Management Port
app.get('/stats', (req, res) => {
    const alertacareStats = alertacare.eventBufferService.getServiceStats();
    
    res.json({
        // Multi-context stats
        contexts: {
            alertacare: {
                channels: alertacareStats.totalChannels,
                events: alertacareStats.totalBufferedEvents,
                uptime: alertacareStats.uptime
            },
            communication: {
                connections: communicationState.connections.size,
                rooms: communicationState.rooms.size
            }
        },
        
        // Legacy compatibility
        totalConnections: communicationState.connections.size,
        totalRooms: communicationState.rooms.size,
        totalChannels: alertacareStats.totalChannels,
        totalBufferedEvents: alertacareStats.totalBufferedEvents,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    const alertacareHealth = alertacare.eventBufferService.healthCheck();
    
    res.json({
        status: 'ok',
        contexts: {
            alertacare: {
                status: alertacareHealth.status,
                buffersActive: alertacareHealth.totalChannels,
                totalEvents: alertacareHealth.totalBufferedEvents,
                memoryUsage: alertacareHealth.memoryUsage
            },
            communication: {
                status: 'ok',
                activeConnections: communicationState.connections.size,
                activeRooms: communicationState.rooms.size
            }
        },
        timestamp: new Date().toISOString()
    });
});

// Communication readonly endpoints (future REST port)
app.get('/communication/connections', (req, res) => {
    const connections = Array.from(communicationState.connections.entries()).map(([id, conn]) => ({
        id: id,
        rooms: Array.from(conn.rooms),
        metadata: conn.metadata,
        connectedAt: conn.connectedAt
    }));
    
    res.json({
        success: true,
        totalConnections: connections.length,
        connections: connections
    });
});

app.get('/communication/rooms', (req, res) => {
    const rooms = Array.from(communicationState.rooms.entries()).map(([name, users]) => ({
        name: name,
        userCount: users.size,
        users: Array.from(users)
    }));
    
    res.json({
        success: true,
        totalRooms: rooms.length,
        rooms: rooms
    });
});

// ===== PORT: WEBSOCKET (Real-time) =====

io.on('connection', (socket) => {
    // ===== COMMUNICATION CONTEXT HANDLERS =====
    
    // Register connection in communication context
    communicationState.connections.set(socket.id, {
        id: socket.id,
        rooms: new Set(),
        metadata: {},
        connectedAt: new Date()
    });

    console.log(`[Communication] Cliente conectado: ${socket.id}`);
    
    // Emit connection event via EventBus (inter-context communication)
    eventBus.emit('user.connected', {
        socketId: socket.id,
        timestamp: new Date(),
        context: 'communication'
    });

    socket.emit('connection_info', {
        id: socket.id,
        totalConnections: communicationState.connections.size,
        timestamp: new Date()
    });

    socket.broadcast.emit('user_connected', {
        userId: socket.id,
        totalConnections: communicationState.connections.size
    });

    // ===== ALERTACARE CONTEXT HANDLERS =====
    
    socket.on('store_event', (data) => {
        const { meta, evento } = data;
        const result = alertacare.eventBufferService.storeEvent(meta, evento);
        
        socket.emit(result.success ? 'event_stored' : 'event_store_error', {
            success: result.success,
            channel: result.channel,
            error: result.error,
            timestamp: new Date()
        });

        if (result.success) {
            // Emit via EventBus for other contexts to react
            eventBus.emit('alertacare.event_stored', {
                channel: result.channel,
                from: socket.id,
                timestamp: new Date()
            });
            
            socket.broadcast.emit('new_event_stored', {
                channel: result.channel,
                from: socket.id,
                timestamp: new Date()
            });
        }
    });

    socket.on('get_events', (data) => {
        const { meta, options = {} } = data;
        const result = alertacare.eventBufferService.getEvents(meta, options);
        
        socket.emit('events_response', {
            success: result.success,
            channel: result.channel,
            eventCount: result.eventCount,
            eventos: result.events,
            error: result.error
        });
    });

    socket.on('get_channels_info', () => {
        const result = alertacare.eventBufferService.getChannelsInfo();
        socket.emit('channels_info', result);
    });

    // ===== COMMUNICATION CONTEXT SPECIFIC HANDLERS =====
    
    socket.on('relay_message', (data) => {
        socket.broadcast.emit('relayed_message', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
        
        // Emit via EventBus
        eventBus.emit('communication.message_relayed', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    socket.on('private_message', ({ targetId, message }) => {
        if (communicationState.connections.has(targetId)) {
            io.to(targetId).emit('private_message', {
                from: socket.id,
                message: message,
                timestamp: new Date()
            });
            socket.emit('message_delivered', { targetId, timestamp: new Date() });
            
            // Emit via EventBus
            eventBus.emit('communication.private_message_sent', {
                from: socket.id,
                to: targetId,
                message: message,
                timestamp: new Date()
            });
        } else {
            socket.emit('message_error', { error: 'Usuario no encontrado', targetId });
        }
    });

    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        communicationState.connections.get(socket.id).rooms.add(roomName);
        
        if (!communicationState.rooms.has(roomName)) {
            communicationState.rooms.set(roomName, new Set());
        }
        communicationState.rooms.get(roomName).add(socket.id);

        const roomSize = communicationState.rooms.get(roomName).size;
        socket.to(roomName).emit('user_joined_room', { userId: socket.id, room: roomName, roomSize });
        socket.emit('joined_room', { room: roomName, roomSize });
        
        // Emit via EventBus
        eventBus.emit('communication.user_joined_room', {
            userId: socket.id,
            room: roomName,
            roomSize: roomSize,
            timestamp: new Date()
        });
    });

    socket.on('leave_room', (roomName) => {
        socket.leave(roomName);
        communicationState.connections.get(socket.id).rooms.delete(roomName);
        
        if (communicationState.rooms.has(roomName)) {
            communicationState.rooms.get(roomName).delete(socket.id);
            if (communicationState.rooms.get(roomName).size === 0) {
                communicationState.rooms.delete(roomName);
            } else {
                socket.to(roomName).emit('user_left_room', {
                    userId: socket.id,
                    room: roomName,
                    roomSize: communicationState.rooms.get(roomName).size
                });
            }
        }
        
        // Emit via EventBus
        eventBus.emit('communication.user_left_room', {
            userId: socket.id,
            room: roomName,
            timestamp: new Date()
        });
    });

    socket.on('room_message', ({ room, message }) => {
        socket.to(room).emit('room_message', {
            from: socket.id,
            room: room,
            message: message,
            timestamp: new Date()
        });
        
        // Emit via EventBus
        eventBus.emit('communication.room_message_sent', {
            from: socket.id,
            room: room,
            message: message,
            timestamp: new Date()
        });
    });

    socket.on('broadcast_data', (data) => {
        socket.broadcast.emit('broadcast_data', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
        
        // Emit via EventBus
        eventBus.emit('communication.data_broadcasted', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    socket.on('update_metadata', (metadata) => {
        const conn = communicationState.connections.get(socket.id);
        conn.metadata = { ...conn.metadata, ...metadata };
        socket.broadcast.emit('user_metadata_updated', {
            userId: socket.id,
            metadata: conn.metadata
        });
        
        // Emit via EventBus
        eventBus.emit('communication.metadata_updated', {
            userId: socket.id,
            metadata: conn.metadata,
            timestamp: new Date()
        });
    });

    // Legacy handlers for backward compatibility
    socket.on('get_connected_users', () => {
        const users = Array.from(communicationState.connections.entries()).map(([id, conn]) => ({
            id,
            rooms: Array.from(conn.rooms),
            metadata: conn.metadata,
            connectedAt: conn.connectedAt
        }));
        socket.emit('connected_users', users);
    });

    socket.on('get_rooms_info', () => {
        const roomsInfo = Array.from(communicationState.rooms.entries()).map(([name, users]) => ({
            name,
            userCount: users.size,
            users: Array.from(users)
        }));
        socket.emit('rooms_info', roomsInfo);
    });

    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
    });

    // ===== DISCONNECT HANDLER =====
    socket.on('disconnect', (reason) => {
        console.log(`[Communication] Cliente desconectado: ${socket.id}, razón: ${reason}`);

        // Clean up communication context
        const conn = communicationState.connections.get(socket.id);
        if (conn) {
            conn.rooms.forEach(roomName => {
                if (communicationState.rooms.has(roomName)) {
                    communicationState.rooms.get(roomName).delete(socket.id);
                    if (communicationState.rooms.get(roomName).size === 0) {
                        communicationState.rooms.delete(roomName);
                    } else {
                        socket.to(roomName).emit('user_left_room', {
                            userId: socket.id,
                            room: roomName,
                            roomSize: communicationState.rooms.get(roomName).size
                        });
                    }
                }
            });
        }

        communicationState.connections.delete(socket.id);

        // Emit via EventBus
        eventBus.emit('user.disconnected', {
            socketId: socket.id,
            reason: reason,
            timestamp: new Date(),
            context: 'communication'
        });

        socket.broadcast.emit('user_disconnected', {
            userId: socket.id,
            totalConnections: communicationState.connections.size,
            reason: reason
        });
    });
});

// ===== INTER-CONTEXT EVENT HANDLERS =====

eventBus.on('user.connected', (data) => {
    console.log(`[EventBus] User connected: ${data.socketId}`);
});

eventBus.on('user.disconnected', (data) => {
    console.log(`[EventBus] User disconnected: ${data.socketId}, reason: ${data.reason}`);
});

eventBus.on('alertacare.event_stored', (data) => {
    console.log(`[EventBus] AlertaCare event stored: ${data.channel}`);
});

eventBus.on('communication.message_relayed', (data) => {
    console.log(`[EventBus] Message relayed from: ${data.from}`);
});

// ===== START SERVER =====
server.listen(config.port, () => {
    console.log(`🚀 AlertaCare Relay Server (Hexagonal) running on port ${config.port}`);
    console.log(`🏥 AlertaCare channels: http://localhost:${config.port}/streams/channels`);
    console.log(`💬 Communication info: http://localhost:${config.port}/communication/connections`);
    console.log(`📊 Multi-context stats: http://localhost:${config.port}/stats`);
    console.log(`🏗️  Architecture: Hexagonal + Bounded Contexts + EventBus`);
    console.log(`📡 Contexts: AlertaCare, Communication, SystemManagement`);
});

// ===== GRACEFUL SHUTDOWN =====
['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
        console.log('Shutting down gracefully...');
        
        // Notify all contexts via EventBus
        eventBus.emit('system.shutdown', { timestamp: new Date() });
        
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
}); 
/**
 * AlertaCare Relay Server - Modular Architecture
 * 
 * Domain-driven, modular but KISS approach.
 * Demonstrates better separation of concerns while maintaining simplicity.
 * 
 * @author AlertaCare Team
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// ===== DOMAIN IMPORTS =====
const EventBufferService = require('./domains/alertacare/services/EventBufferService');
const StreamRestController = require('./domains/alertacare/controllers/StreamRestController');

// ===== CONFIGURATION =====
const config = {
    port: process.env.PORT || 3000,
    bufferSize: parseInt(process.env.DEFAULT_BUFFER_SIZE) || 1080,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
};

// ===== SERVICES INITIALIZATION =====
const eventBufferService = new EventBufferService({
    bufferSize: config.bufferSize
});

// ===== CONTROLLERS INITIALIZATION =====
const streamRestController = new StreamRestController(eventBufferService);

// ===== EXPRESS APP SETUP =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: config.cors });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ===== REGISTER ALERTACARE ROUTES =====
streamRestController.registerRoutes(app);

// ===== LEGACY/COMPATIBILITY ROUTES =====
// Enhanced stats endpoint (backward compatible)
app.get('/stats', (req, res) => {
    const alertacareStats = eventBufferService.getServiceStats();
    
    res.json({
        // Legacy fields
        totalConnections: connections.size,
        totalRooms: rooms.size,
        uptime: process.uptime(),
        
        // Enhanced AlertaCare fields
        totalChannels: alertacareStats.totalChannels,
        totalBufferedEvents: alertacareStats.totalBufferedEvents,
        
        timestamp: new Date().toISOString()
    });
});

// Enhanced health endpoint (backward compatible)
app.get('/health', (req, res) => {
    const alertacareHealth = eventBufferService.healthCheck();
    
    res.json({
        status: 'ok',
        alertacare: {
            buffersActive: alertacareHealth.totalChannels,
            totalEvents: alertacareHealth.totalBufferedEvents,
            memoryUsage: alertacareHealth.memoryUsage
        },
        timestamp: new Date().toISOString()
    });
});

// ===== LEGACY RELAY FUNCTIONALITY =====
// (Keep existing Socket.IO functionality for backward compatibility)

const connections = new Map();
const rooms = new Map();

// Socket.IO middleware
io.use((socket, next) => {
    console.log(`Nueva conexión: ${socket.id} desde ${socket.handshake.address}`);
    next();
});

io.on('connection', (socket) => {
    // Register connection
    connections.set(socket.id, {
        id: socket.id,
        rooms: new Set(),
        metadata: {},
        connectedAt: new Date()
    });

    console.log(`Cliente conectado: ${socket.id}`);

    // Connection info
    socket.emit('connection_info', {
        id: socket.id,
        totalConnections: connections.size,
        timestamp: new Date()
    });

    // Broadcast new connection
    socket.broadcast.emit('user_connected', {
        userId: socket.id,
        totalConnections: connections.size
    });

    // ===== ALERTACARE SOCKET HANDLERS =====
    
    /**
     * Store event via Socket.IO
     */
    socket.on('store_event', (data) => {
        try {
            const { meta, evento } = data;
            const result = eventBufferService.storeEvent(meta, evento);
            
            if (result.success) {
                socket.emit('event_stored', {
                    success: true,
                    channel: result.channel,
                    timestamp: new Date()
                });
                
                // Broadcast to interested parties
                socket.broadcast.emit('new_event_stored', {
                    channel: result.channel,
                    from: socket.id,
                    timestamp: new Date()
                });
            } else {
                socket.emit('event_store_error', {
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            socket.emit('event_store_error', {
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get events via Socket.IO
     */
    socket.on('get_events', (data) => {
        try {
            const { meta, options = {} } = data;
            const result = eventBufferService.getEvents(meta, options);
            
            socket.emit('events_response', {
                success: result.success,
                channel: result.channel,
                eventCount: result.eventCount,
                eventos: result.events
            });
        } catch (error) {
            socket.emit('events_response', {
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Get channels info via Socket.IO
     */
    socket.on('get_channels_info', () => {
        const result = eventBufferService.getChannelsInfo();
        socket.emit('channels_info', result);
    });

    // ===== LEGACY SOCKET HANDLERS =====
    
    // Relay messages
    socket.on('relay_message', (data) => {
        console.log(`Relaying message from ${socket.id}:`, data);
        socket.broadcast.emit('relayed_message', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    // Private messages
    socket.on('private_message', (data) => {
        const { targetId, message } = data;

        if (connections.has(targetId)) {
            io.to(targetId).emit('private_message', {
                from: socket.id,
                message: message,
                timestamp: new Date()
            });

            socket.emit('message_delivered', {
                targetId: targetId,
                timestamp: new Date()
            });
        } else {
            socket.emit('message_error', {
                error: 'Usuario no encontrado',
                targetId: targetId
            });
        }
    });

    // Room management
    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        
        const conn = connections.get(socket.id);
        conn.rooms.add(roomName);

        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(socket.id);

        console.log(`${socket.id} se unió a la sala: ${roomName}`);

        socket.to(roomName).emit('user_joined_room', {
            userId: socket.id,
            room: roomName,
            roomSize: rooms.get(roomName).size
        });

        socket.emit('joined_room', {
            room: roomName,
            roomSize: rooms.get(roomName).size
        });
    });

    socket.on('leave_room', (roomName) => {
        socket.leave(roomName);
        
        const conn = connections.get(socket.id);
        conn.rooms.delete(roomName);

        if (rooms.has(roomName)) {
            rooms.get(roomName).delete(socket.id);
            if (rooms.get(roomName).size === 0) {
                rooms.delete(roomName);
            }
        }

        console.log(`${socket.id} salió de la sala: ${roomName}`);

        socket.to(roomName).emit('user_left_room', {
            userId: socket.id,
            room: roomName,
            roomSize: rooms.has(roomName) ? rooms.get(roomName).size : 0
        });
    });

    // Room messages
    socket.on('room_message', (data) => {
        const { room, message } = data;
        console.log(`Room message from ${socket.id} to room ${room}:`, message);

        socket.to(room).emit('room_message', {
            from: socket.id,
            room: room,
            message: message,
            timestamp: new Date()
        });
    });

    // Broadcast data
    socket.on('broadcast_data', (data) => {
        console.log(`Broadcasting data from ${socket.id}:`, data);
        socket.broadcast.emit('broadcast_data', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    // Update metadata
    socket.on('update_metadata', (metadata) => {
        const conn = connections.get(socket.id);
        conn.metadata = { ...conn.metadata, ...metadata };

        socket.broadcast.emit('user_metadata_updated', {
            userId: socket.id,
            metadata: conn.metadata
        });
    });

    // Get connected users
    socket.on('get_connected_users', () => {
        const users = Array.from(connections.entries()).map(([id, conn]) => ({
            id: id,
            rooms: Array.from(conn.rooms),
            metadata: conn.metadata,
            connectedAt: conn.connectedAt
        }));

        socket.emit('connected_users', users);
    });

    // Get rooms info
    socket.on('get_rooms_info', () => {
        const roomsInfo = Array.from(rooms.entries()).map(([name, users]) => ({
            name: name,
            userCount: users.size,
            users: Array.from(users)
        }));

        socket.emit('rooms_info', roomsInfo);
    });

    // Ping/Pong
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
    });

    // ===== DISCONNECT HANDLER =====
    socket.on('disconnect', (reason) => {
        console.log(`Cliente desconectado: ${socket.id}, razón: ${reason}`);

        // Clean up rooms
        const conn = connections.get(socket.id);
        if (conn) {
            conn.rooms.forEach(roomName => {
                if (rooms.has(roomName)) {
                    rooms.get(roomName).delete(socket.id);
                    if (rooms.get(roomName).size === 0) {
                        rooms.delete(roomName);
                    } else {
                        socket.to(roomName).emit('user_left_room', {
                            userId: socket.id,
                            room: roomName,
                            roomSize: rooms.get(roomName).size
                        });
                    }
                }
            });
        }

        // Remove connection
        connections.delete(socket.id);

        // Broadcast disconnection
        socket.broadcast.emit('user_disconnected', {
            userId: socket.id,
            totalConnections: connections.size,
            reason: reason
        });
    });
});

// ===== SERVER STARTUP =====
server.listen(config.port, () => {
    console.log(`🚀 AlertaCare Relay Server (Modular) running on port ${config.port}`);
    console.log(`📊 Stats available at http://localhost:${config.port}/stats`);
    console.log(`🏥 AlertaCare channels at http://localhost:${config.port}/streams/channels`);
    console.log(`📡 Buffer size: ${config.bufferSize} events per channel`);
    console.log(`🏗️  Architecture: Domain-Driven + KISS`);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 
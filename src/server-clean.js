/**
 * AlertaCare Relay Server - Ultra Clean Version
 * 
 * Demonstrates the cleanest possible implementation using domain factory.
 * Perfect example of Domain-Driven + KISS principles.
 * 
 * @author AlertaCare Team
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Single domain import using factory pattern
const { createAlertaCareDomain } = require('./domains/alertacare');

// ===== CONFIGURATION =====
const config = {
    port: process.env.PORT || 3000,
    bufferSize: parseInt(process.env.DEFAULT_BUFFER_SIZE) || 1080
};

// ===== SETUP =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ===== INITIALIZE ALERTACARE DOMAIN =====
const alertacare = createAlertaCareDomain({ bufferSize: config.bufferSize });

// Register all AlertaCare routes with one line
alertacare.streamRestController.registerRoutes(app);

// ===== LEGACY COMPATIBILITY =====
const connections = new Map();
const rooms = new Map();

// Enhanced backward-compatible endpoints
app.get('/stats', (req, res) => {
    const stats = alertacare.eventBufferService.getServiceStats();
    res.json({
        totalConnections: connections.size,
        totalRooms: rooms.size,
        totalChannels: stats.totalChannels,
        totalBufferedEvents: stats.totalBufferedEvents,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    const health = alertacare.eventBufferService.healthCheck();
    res.json({
        status: 'ok',
        alertacare: {
            buffersActive: health.totalChannels,
            totalEvents: health.totalBufferedEvents,
            memoryUsage: health.memoryUsage
        },
        timestamp: new Date().toISOString()
    });
});

// ===== SOCKET.IO HANDLERS =====
io.on('connection', (socket) => {
    // Register connection
    connections.set(socket.id, {
        id: socket.id,
        rooms: new Set(),
        metadata: {},
        connectedAt: new Date()
    });

    console.log(`Cliente conectado: ${socket.id}`);

    socket.emit('connection_info', {
        id: socket.id,
        totalConnections: connections.size,
        timestamp: new Date()
    });

    socket.broadcast.emit('user_connected', {
        userId: socket.id,
        totalConnections: connections.size
    });

    // ===== ALERTACARE HANDLERS (CLEAN) =====
    
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

    // ===== LEGACY HANDLERS (SIMPLIFIED) =====
    
    socket.on('relay_message', (data) => {
        socket.broadcast.emit('relayed_message', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    socket.on('private_message', ({ targetId, message }) => {
        if (connections.has(targetId)) {
            io.to(targetId).emit('private_message', {
                from: socket.id,
                message: message,
                timestamp: new Date()
            });
            socket.emit('message_delivered', { targetId, timestamp: new Date() });
        } else {
            socket.emit('message_error', { error: 'Usuario no encontrado', targetId });
        }
    });

    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        connections.get(socket.id).rooms.add(roomName);
        
        if (!rooms.has(roomName)) rooms.set(roomName, new Set());
        rooms.get(roomName).add(socket.id);

        const roomSize = rooms.get(roomName).size;
        socket.to(roomName).emit('user_joined_room', { userId: socket.id, room: roomName, roomSize });
        socket.emit('joined_room', { room: roomName, roomSize });
    });

    socket.on('leave_room', (roomName) => {
        socket.leave(roomName);
        connections.get(socket.id).rooms.delete(roomName);
        
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

    socket.on('room_message', ({ room, message }) => {
        socket.to(room).emit('room_message', {
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
    });

    socket.on('update_metadata', (metadata) => {
        const conn = connections.get(socket.id);
        conn.metadata = { ...conn.metadata, ...metadata };
        socket.broadcast.emit('user_metadata_updated', {
            userId: socket.id,
            metadata: conn.metadata
        });
    });

    socket.on('get_connected_users', () => {
        const users = Array.from(connections.entries()).map(([id, conn]) => ({
            id,
            rooms: Array.from(conn.rooms),
            metadata: conn.metadata,
            connectedAt: conn.connectedAt
        }));
        socket.emit('connected_users', users);
    });

    socket.on('get_rooms_info', () => {
        const roomsInfo = Array.from(rooms.entries()).map(([name, users]) => ({
            name,
            userCount: users.size,
            users: Array.from(users)
        }));
        socket.emit('rooms_info', roomsInfo);
    });

    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
    });

    // ===== DISCONNECT =====
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

        connections.delete(socket.id);
        socket.broadcast.emit('user_disconnected', {
            userId: socket.id,
            totalConnections: connections.size,
            reason: reason
        });
    });
});

// ===== START SERVER =====
server.listen(config.port, () => {
    console.log(`🚀 AlertaCare Relay Server (Clean) running on port ${config.port}`);
    console.log(`🏥 AlertaCare channels: http://localhost:${config.port}/streams/channels`);
    console.log(`📡 Buffer size: ${config.bufferSize} events per channel`);
    console.log(`🏗️  Architecture: Domain-Driven + KISS + Factory Pattern`);
});

// ===== GRACEFUL SHUTDOWN =====
['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
        console.log('Shutting down gracefully...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
}); 
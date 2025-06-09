const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// ===== ALERTACARE CIRCULAR BUFFER SYSTEM =====

/**
 * Circular Buffer implementation for event storage
 * Maintains a fixed-size buffer that overwrites oldest entries when full
 */
class CircularBuffer {
    constructor(size) {
        this.size = size;
        this.buffer = new Array(size);
        this.index = 0;
        this.filled = false;
        this.count = 0;
    }

    push(item) {
        this.buffer[this.index] = {
            ...item,
            _buffered_at: new Date().toISOString(),
            _buffer_index: this.count
        };
        this.index = (this.index + 1) % this.size;
        this.count++;
        if (this.index === 0) {
            this.filled = true;
        }
    }

    getAll() {
        if (!this.filled) {
            return this.buffer.slice(0, this.index).filter(item => item !== undefined);
        }
        // Return in chronological order: oldest to newest
        return this.buffer.slice(this.index).concat(this.buffer.slice(0, this.index))
            .filter(item => item !== undefined);
    }

    getLatest(count = 10) {
        const all = this.getAll();
        return all.slice(-count);
    }

    size() {
        return this.filled ? this.size : this.index;
    }

    clear() {
        this.buffer = new Array(this.size);
        this.index = 0;
        this.filled = false;
        this.count = 0;
    }
}

// Global buffer storage per channel
const buffersPorCanal = new Map();
const DEFAULT_BUFFER_SIZE = 1080;

/**
 * Generate channel key following AlertaCare convention:
 * <habitacion>.<posicion>.<origen>.<canal>.tap
 */
function canalKey({ habitacion, posicion, origen, canal }) {
    if (!habitacion || !posicion || !origen || !canal) {
        throw new Error('Missing required fields: habitacion, posicion, origen, canal');
    }
    return `${habitacion}.${posicion}.${origen}.${canal}.tap`;
}

/**
 * Store event in the appropriate channel buffer
 */
function guardarEvento(meta, evento) {
    try {
        const key = canalKey(meta);
        
        if (!buffersPorCanal.has(key)) {
            buffersPorCanal.set(key, new CircularBuffer(DEFAULT_BUFFER_SIZE));
            console.log(`📦 Created new buffer for channel: ${key}`);
        }

        const eventWithMeta = {
            ...evento,
            // Include metadata for complete traceability
            _meta: meta,
            _timestamp: new Date().toISOString(),
            _channel: key
        };

        buffersPorCanal.get(key).push(eventWithMeta);
        
        console.log(`✅ Event stored in channel: ${key}`);
        return true;
    } catch (error) {
        console.error(`❌ Error storing event:`, error.message);
        return false;
    }
}

/**
 * Retrieve events from channel buffer
 */
function obtenerEventos(meta, options = {}) {
    try {
        const key = canalKey(meta);
        const buffer = buffersPorCanal.get(key);
        
        if (!buffer) {
            return [];
        }

        if (options.latest && typeof options.latest === 'number') {
            return buffer.getLatest(options.latest);
        }
        
        return buffer.getAll();
    } catch (error) {
        console.error(`❌ Error retrieving events:`, error.message);
        return [];
    }
}

/**
 * Get all available channels
 */
function obtenerCanalesDisponibles() {
    return Array.from(buffersPorCanal.keys()).map(key => {
        const buffer = buffersPorCanal.get(key);
        const parts = key.replace('.tap', '').split('.');
        return {
            channel: key,
            habitacion: parts[0],
            posicion: parts[1],
            origen: parts[2],
            canal: parts[3],
            eventCount: buffer.size(),
            totalStored: buffer.count
        };
    });
}

// ===== END ALERTACARE BUFFER SYSTEM =====

// Configuración del servidor
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Parse JSON bodies
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ===== ALERTACARE REST ENDPOINTS =====

/**
 * Get events from specific channel
 * GET /streams/:habitacion/:posicion/:origen/:canal/events
 */
app.get('/streams/:habitacion/:posicion/:origen/:canal/events', (req, res) => {
    try {
        const { habitacion, posicion, origen, canal } = req.params;
        const { latest } = req.query;
        
        const meta = { habitacion, posicion, origen, canal };
        const options = latest ? { latest: parseInt(latest) } : {};
        
        const eventos = obtenerEventos(meta, options);
        
        res.json({
            success: true,
            channel: canalKey(meta),
            eventCount: eventos.length,
            eventos
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Store event in specific channel
 * POST /streams/:habitacion/:posicion/:origen/:canal/events
 */
app.post('/streams/:habitacion/:posicion/:origen/:canal/events', (req, res) => {
    try {
        const { habitacion, posicion, origen, canal } = req.params;
        const evento = req.body;
        
        const meta = { habitacion, posicion, origen, canal };
        const success = guardarEvento(meta, evento);
        
        if (success) {
            res.json({
                success: true,
                channel: canalKey(meta),
                message: 'Event stored successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to store event'
            });
        }
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get all available channels and their stats
 * GET /streams/channels
 */
app.get('/streams/channels', (req, res) => {
    res.json({
        success: true,
        totalChannels: buffersPorCanal.size,
        channels: obtenerCanalesDisponibles()
    });
});

/**
 * Clear specific channel buffer
 * DELETE /streams/:habitacion/:posicion/:origen/:canal/events
 */
app.delete('/streams/:habitacion/:posicion/:origen/:canal/events', (req, res) => {
    try {
        const { habitacion, posicion, origen, canal } = req.params;
        const meta = { habitacion, posicion, origen, canal };
        const key = canalKey(meta);
        
        if (buffersPorCanal.has(key)) {
            buffersPorCanal.get(key).clear();
            res.json({
                success: true,
                channel: key,
                message: 'Channel buffer cleared'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Channel not found'
            });
        }
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ===== END ALERTACARE ENDPOINTS =====

// Almacenar información de las conexiones
const connections = new Map();
const rooms = new Map();

// Middleware de Socket.IO para logging
io.use((socket, next) => {
    console.log(`Nueva conexión: ${socket.id} desde ${socket.handshake.address}`);
    next();
});

io.on('connection', (socket) => {
    // Registrar nueva conexión
    connections.set(socket.id, {
        id: socket.id,
        rooms: new Set(),
        metadata: {},
        connectedAt: new Date()
    });

    console.log(`Cliente conectado: ${socket.id}`);

    // Enviar estadísticas al cliente que se conecta
    socket.emit('connection_info', {
        id: socket.id,
        totalConnections: connections.size,
        timestamp: new Date()
    });

    // Broadcast a todos que hay una nueva conexión
    socket.broadcast.emit('user_connected', {
        userId: socket.id,
        totalConnections: connections.size
    });

    // ===== ALERTACARE SOCKET HANDLERS =====

    /**
     * Store event via Socket.IO
     * socket.emit('store_event', { meta: {...}, evento: {...} })
     */
    socket.on('store_event', (data) => {
        try {
            const { meta, evento } = data;
            const success = guardarEvento(meta, evento);
            
            if (success) {
                socket.emit('event_stored', {
                    success: true,
                    channel: canalKey(meta),
                    timestamp: new Date()
                });
                
                // Broadcast to interested parties (optional)
                socket.broadcast.emit('new_event_stored', {
                    channel: canalKey(meta),
                    from: socket.id,
                    timestamp: new Date()
                });
            } else {
                socket.emit('event_store_error', {
                    success: false,
                    error: 'Failed to store event'
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
     * socket.emit('get_events', { meta: {...}, options: {...} })
     */
    socket.on('get_events', (data) => {
        try {
            const { meta, options = {} } = data;
            const eventos = obtenerEventos(meta, options);
            
            socket.emit('events_response', {
                success: true,
                channel: canalKey(meta),
                eventCount: eventos.length,
                eventos
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
        socket.emit('channels_info', {
            success: true,
            totalChannels: buffersPorCanal.size,
            channels: obtenerCanalesDisponibles()
        });
    });

    // ===== END ALERTACARE SOCKET HANDLERS =====

    // Manejar relay de mensajes generales
    socket.on('relay_message', (data) => {
        console.log(`Relaying message from ${socket.id}:`, data);

        // Retransmitir a todos excepto al emisor
        socket.broadcast.emit('relayed_message', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    // Manejar relay de mensajes privados
    socket.on('private_message', (data) => {
        const { targetId, message } = data;

        if (connections.has(targetId)) {
            io.to(targetId).emit('private_message', {
                from: socket.id,
                message: message,
                timestamp: new Date()
            });

            // Confirmar al emisor
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

    // Manejar salas/rooms
    socket.on('join_room', (roomName) => {
        socket.join(roomName);

        // Actualizar información de conexión
        const conn = connections.get(socket.id);
        conn.rooms.add(roomName);

        // Actualizar información de la sala
        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(socket.id);

        console.log(`${socket.id} se unió a la sala: ${roomName}`);

        // Notificar a otros en la sala
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

        // Actualizar información de conexión
        const conn = connections.get(socket.id);
        conn.rooms.delete(roomName);

        // Actualizar información de la sala
        if (rooms.has(roomName)) {
            rooms.get(roomName).delete(socket.id);
            if (rooms.get(roomName).size === 0) {
                rooms.delete(roomName);
            }
        }

        console.log(`${socket.id} salió de la sala: ${roomName}`);

        // Notificar a otros en la sala
        socket.to(roomName).emit('user_left_room', {
            userId: socket.id,
            room: roomName,
            roomSize: rooms.has(roomName) ? rooms.get(roomName).size : 0
        });
    });

    // Relay de mensajes en salas
    socket.on('room_message', (data) => {
        const { room, message } = data;

        console.log(`Room message from ${socket.id} to room ${room}:`, message);

        // Retransmitir a todos en la sala excepto al emisor
        socket.to(room).emit('room_message', {
            from: socket.id,
            room: room,
            message: message,
            timestamp: new Date()
        });
    });

    // Broadcast de datos (relay general)
    socket.on('broadcast_data', (data) => {
        console.log(`Broadcasting data from ${socket.id}:`, data);

        socket.broadcast.emit('broadcast_data', {
            from: socket.id,
            data: data,
            timestamp: new Date()
        });
    });

    // Actualizar metadata del usuario
    socket.on('update_metadata', (metadata) => {
        const conn = connections.get(socket.id);
        conn.metadata = { ...conn.metadata, ...metadata };

        // Notificar a todos sobre la actualización
        socket.broadcast.emit('user_metadata_updated', {
            userId: socket.id,
            metadata: conn.metadata
        });
    });

    // Obtener lista de usuarios conectados
    socket.on('get_connected_users', () => {
        const users = Array.from(connections.entries()).map(([id, conn]) => ({
            id: id,
            rooms: Array.from(conn.rooms),
            metadata: conn.metadata,
            connectedAt: conn.connectedAt
        }));

        socket.emit('connected_users', users);
    });

    // Obtener información de salas
    socket.on('get_rooms_info', () => {
        const roomsInfo = Array.from(rooms.entries()).map(([name, users]) => ({
            name: name,
            userCount: users.size,
            users: Array.from(users)
        }));

        socket.emit('rooms_info', roomsInfo);
    });

    // Ping/Pong para mantener conexión
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
    });

    // Manejar desconexión
    socket.on('disconnect', (reason) => {
        console.log(`Cliente desconectado: ${socket.id}, razón: ${reason}`);

        // Limpiar información de salas
        const conn = connections.get(socket.id);
        if (conn) {
            conn.rooms.forEach(roomName => {
                if (rooms.has(roomName)) {
                    rooms.get(roomName).delete(socket.id);
                    if (rooms.get(roomName).size === 0) {
                        rooms.delete(roomName);
                    } else {
                        // Notificar a otros en la sala
                        socket.to(roomName).emit('user_left_room', {
                            userId: socket.id,
                            room: roomName,
                            roomSize: rooms.get(roomName).size
                        });
                    }
                }
            });
        }

        // Remover conexión
        connections.delete(socket.id);

        // Notificar a todos sobre la desconexión
        socket.broadcast.emit('user_disconnected', {
            userId: socket.id,
            totalConnections: connections.size,
            reason: reason
        });
    });
});

// Endpoint para estadísticas (enhanced with AlertaCare info)
app.get('/stats', (req, res) => {
    res.json({
        totalConnections: connections.size,
        totalRooms: rooms.size,
        totalChannels: buffersPorCanal.size,
        totalBufferedEvents: Array.from(buffersPorCanal.values())
            .reduce((sum, buffer) => sum + buffer.size(), 0),
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        alertacare: {
            buffersActive: buffersPorCanal.size,
            totalEvents: Array.from(buffersPorCanal.values())
                .reduce((sum, buffer) => sum + buffer.size(), 0)
        },
        timestamp: new Date() 
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 AlertaCare Relay Server running on port ${PORT}`);
    console.log(`📊 Stats available at http://localhost:${PORT}/stats`);
    console.log(`🏥 AlertaCare channels at http://localhost:${PORT}/streams/channels`);
    console.log(`📡 Buffer size: ${DEFAULT_BUFFER_SIZE} events per channel`);
});

// Manejar cierre graceful
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
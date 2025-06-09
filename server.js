const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const CircularBuffer = require('./circularBuffer');

// Configuración del servidor
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Almacenar información de las conexiones
const connections = new Map();
const rooms = new Map();

// Buffers circulares por canal
const buffersPorCanal = {};
const DEFAULT_BUFFER_SIZE = 1080;

function canalKey({ habitacion, posicion, origen, canal }) {
    return `${habitacion}.${posicion}.${origen}.${canal}.tap`;
}

function guardarEvento(meta, evento) {
    const key = canalKey(meta);
    if (!buffersPorCanal[key]) {
        buffersPorCanal[key] = new CircularBuffer(DEFAULT_BUFFER_SIZE);
    }
    buffersPorCanal[key].push({ ...evento, ...meta, timestamp: new Date() });
}

function obtenerEventos(meta) {
    const key = canalKey(meta);
    return buffersPorCanal[key]?.getAll() || [];
}

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

    // Evento de stream para bufferizar por canal
    socket.on('stream_event', (payload) => {
        const { meta, evento } = payload || {};
        if (meta && evento) {
            guardarEvento(meta, evento);
        }
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

// Endpoint para estadísticas
app.get('/stats', (req, res) => {
    res.json({
        totalConnections: connections.size,
        totalRooms: rooms.size,
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

// Obtener eventos de un canal específico
app.get('/streams/:habitacion/:posicion/:origen/:canal/events', (req, res) => {
    const { habitacion, posicion, origen, canal } = req.params;
    const eventos = obtenerEventos({ habitacion, posicion, origen, canal });
    res.json({ eventos });
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Relay server running on port ${PORT}`);
    console.log(`📊 Stats available at http://localhost:${PORT}/stats`);
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
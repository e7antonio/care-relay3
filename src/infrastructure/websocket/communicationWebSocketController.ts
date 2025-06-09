import { Server as SocketIOServer, Socket } from 'socket.io';
import { CommunicationService } from '../../core/communication/communicationService';
import { PrivateMessage, RoomMessage } from '../../core/communication/types';

export class CommunicationWebSocketController {
    constructor(
        private io: SocketIOServer,
        private communicationService: CommunicationService
    ) {}

    handleConnection(socket: Socket): void {
        this.setupGeneralMessageHandlers(socket);
        this.setupRoomHandlers(socket);
        this.setupUtilityHandlers(socket);
    }

    private setupGeneralMessageHandlers(socket: Socket): void {
        // Relay de mensajes generales
        socket.on('relay_message', (data: any) => {
            console.log(`[COMMUNICATION] Relaying message from ${socket.id}:`, data);
            socket.broadcast.emit('relayed_message', {
                from: socket.id,
                data: data,
                timestamp: new Date()
            });
        });

        // Mensajes privados
        socket.on('private_message', (data: PrivateMessage) => {
            const { targetId, message } = data;

            if (this.communicationService.hasConnection(targetId)) {
                this.io.to(targetId).emit('private_message', {
                    from: socket.id,
                    message: message,
                    timestamp: new Date()
                });

                socket.emit('message_delivered', {
                    targetId: targetId,
                    timestamp: new Date()
                });

                console.log(`[COMMUNICATION] Private message delivered from ${socket.id} to ${targetId}`);
            } else {
                socket.emit('message_error', {
                    error: 'Usuario no encontrado',
                    targetId: targetId
                });
                console.warn(`[COMMUNICATION] Failed to deliver message: user ${targetId} not found`);
            }
        });

        // Broadcast de datos
        socket.on('broadcast_data', (data: any) => {
            console.log(`[COMMUNICATION] Broadcasting data from ${socket.id}:`, data);
            socket.broadcast.emit('broadcast_data', {
                from: socket.id,
                data: data,
                timestamp: new Date()
            });
        });
    }

    private setupRoomHandlers(socket: Socket): void {
        // Unirse a sala
        socket.on('join_room', (roomName: string) => {
            socket.join(roomName);
            this.communicationService.joinRoom(socket.id, roomName);

            console.log(`[COMMUNICATION] ${socket.id} joined room: ${roomName}`);

            const roomSize = this.communicationService.getRoomSize(roomName);
            
            socket.to(roomName).emit('user_joined_room', {
                userId: socket.id,
                room: roomName,
                roomSize: roomSize
            });

            socket.emit('joined_room', {
                room: roomName,
                roomSize: roomSize
            });
        });

        // Salir de sala
        socket.on('leave_room', (roomName: string) => {
            socket.leave(roomName);
            this.communicationService.leaveRoom(socket.id, roomName);

            console.log(`[COMMUNICATION] ${socket.id} left room: ${roomName}`);

            const roomSize = this.communicationService.getRoomSize(roomName);
            
            socket.to(roomName).emit('user_left_room', {
                userId: socket.id,
                room: roomName,
                roomSize: roomSize
            });
        });

        // Mensajes en salas
        socket.on('room_message', (data: RoomMessage) => {
            const { room, message } = data;
            console.log(`[COMMUNICATION] Room message from ${socket.id} to room ${room}:`, message);

            socket.to(room).emit('room_message', {
                from: socket.id,
                room: room,
                message: message,
                timestamp: new Date()
            });
        });
    }

    private setupUtilityHandlers(socket: Socket): void {
        // Actualizar metadata
        socket.on('update_metadata', (metadata: Record<string, unknown>) => {
            this.communicationService.updateMetadata(socket.id, metadata);

            socket.broadcast.emit('user_metadata_updated', {
                userId: socket.id,
                metadata: metadata
            });

            console.log(`[COMMUNICATION] Metadata updated for ${socket.id}`);
        });

        // Obtener usuarios conectados
        socket.on('get_connected_users', () => {
            const users = this.communicationService.getConnections().map(conn => ({
                id: conn.id,
                rooms: Array.from(conn.rooms),
                metadata: conn.metadata,
                connectedAt: conn.connectedAt
            }));

            socket.emit('connected_users', users);
        });

        // Información de salas
        socket.on('get_rooms_info', () => {
            socket.emit('rooms_info', this.communicationService.getRoomsInfo());
        });

        // Ping/Pong
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date() });
        });
    }

    handleDisconnection(socket: Socket, reason: string): void {
        const conn = this.communicationService.getConnection(socket.id);
        if (conn) {
            // Notificar salida de salas
            conn.rooms.forEach(roomName => {
                socket.to(roomName).emit('user_left_room', {
                    userId: socket.id,
                    room: roomName,
                    roomSize: this.communicationService.getRoomSize(roomName) - 1
                });
            });
        }

        console.log(`[COMMUNICATION] Client disconnected: ${socket.id}, reason: ${reason}`);
    }
} 
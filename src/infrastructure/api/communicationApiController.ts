import express, { Request, Response } from 'express';
import { CommunicationService } from '../../core/communication/communicationService';

export class CommunicationApiController {
    private router = express.Router();

    constructor(
        private communicationService: CommunicationService
    ) {
        this.setupRoutes();
    }

    getRouter(): express.Router {
        return this.router;
    }

    private setupRoutes(): void {
        // Obtener conexiones activas
        this.router.get('/connections', this.getConnections.bind(this));
        
        // Obtener información de salas
        this.router.get('/rooms', this.getRooms.bind(this));
        
        // Obtener información de una sala específica
        this.router.get('/rooms/:roomName', this.getRoomInfo.bind(this));
        
        // Obtener información de un usuario específico
        this.router.get('/users/:userId', this.getUserInfo.bind(this));
        
        // Estadísticas de comunicación
        this.router.get('/stats', this.getCommunicationStats.bind(this));
    }

    private getConnections(_req: Request, res: Response): void {
        try {
            const connections = this.communicationService.getConnections();
            res.json({
                connections: connections.map(conn => ({
                    id: conn.id,
                    rooms: Array.from(conn.rooms),
                    metadata: conn.metadata,
                    connectedAt: conn.connectedAt
                })),
                count: connections.length,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener conexiones',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getRooms(_req: Request, res: Response): void {
        try {
            const rooms = this.communicationService.getRoomsInfo();
            res.json({
                rooms,
                count: rooms.length,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener información de salas',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getRoomInfo(req: Request, res: Response): void {
        try {
            const { roomName } = req.params;
            
            if (!roomName) {
                res.status(400).json({
                    error: 'Nombre de sala requerido'
                });
                return;
            }

            const rooms = this.communicationService.getRoomsInfo();
            const room = rooms.find(r => r.name === roomName);

            if (!room) {
                res.status(404).json({
                    error: 'Sala no encontrada',
                    roomName
                });
                return;
            }

            res.json({
                room,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener información de la sala',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getUserInfo(req: Request, res: Response): void {
        try {
            const { userId } = req.params;
            
            if (!userId) {
                res.status(400).json({
                    error: 'ID de usuario requerido'
                });
                return;
            }

            const connection = this.communicationService.getConnection(userId);

            if (!connection) {
                res.status(404).json({
                    error: 'Usuario no encontrado',
                    userId
                });
                return;
            }

            res.json({
                user: {
                    id: connection.id,
                    rooms: Array.from(connection.rooms),
                    metadata: connection.metadata,
                    connectedAt: connection.connectedAt
                },
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener información del usuario',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getCommunicationStats(_req: Request, res: Response): void {
        try {
            const connections = this.communicationService.getConnections();
            const rooms = this.communicationService.getRoomsInfo();
            
            // Calcular estadísticas adicionales
            const totalUsersInRooms = rooms.reduce((sum, room) => sum + room.userCount, 0);
            const averageUsersPerRoom = rooms.length > 0 ? totalUsersInRooms / rooms.length : 0;
            
            const roomsBySize = rooms.reduce((acc, room) => {
                const size = room.userCount;
                acc[size] = (acc[size] || 0) + 1;
                return acc;
            }, {} as Record<number, number>);

            res.json({
                summary: {
                    totalConnections: connections.length,
                    totalRooms: rooms.length,
                    totalUsersInRooms,
                    averageUsersPerRoom: Math.round(averageUsersPerRoom * 100) / 100
                },
                roomDistribution: roomsBySize,
                connectionsWithMetadata: connections.filter(conn => Object.keys(conn.metadata).length > 0).length,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener estadísticas de comunicación',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
} 
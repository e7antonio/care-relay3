Estructura de la carpeta:
.
├── application
├── concat.sh
├── core
│   ├── alertacare
│   │   ├── alertaCareService.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── communication
│   │   ├── communicationService.ts
│   │   ├── index.ts
│   │   └── types.ts
│   └── management
│       ├── index.ts
│       ├── managementService.ts
│       └── types.ts
├── infrastructure
│   ├── api
│   │   ├── alertaCareApiController.ts
│   │   ├── communicationApiController.ts
│   │   └── managementApiController.ts
│   └── websocket
│       ├── alertaCareWebSocketController.ts
│       ├── communicationWebSocketController.ts
│       └── managementWebSocketController.ts
├── main.ts
└── shared
    ├── circularBuffer.ts
    └── index.js

10 directories, 19 files

---------------------

---
./core/alertacare/alertaCareService.ts

import CircularBuffer from '../../shared/circularBuffer';
import { AlertaCareMeta, StreamEventPayload, BufferedEvent } from './types';

export class AlertaCareService {
    private buffersPorCanal: Record<string, CircularBuffer<BufferedEvent>> = {};
    private readonly DEFAULT_BUFFER_SIZE = 1080;

    private canalKey({ habitacion, posicion, origen, canal }: AlertaCareMeta): string {
        return `${habitacion}.${posicion}.${origen}.${canal}.tap`;
    }

    guardarEvento(meta: AlertaCareMeta, evento: Record<string, unknown>): void {
        const key = this.canalKey(meta);
        if (!this.buffersPorCanal[key]) {
            this.buffersPorCanal[key] = new CircularBuffer(this.DEFAULT_BUFFER_SIZE);
        }
        this.buffersPorCanal[key].push({ ...evento, ...meta, timestamp: new Date() });
    }

    obtenerEventos(meta: AlertaCareMeta): BufferedEvent[] {
        const key = this.canalKey(meta);
        return this.buffersPorCanal[key]?.getAll() || [];
    }

    obtenerEstadisticasCanales(): Record<string, number> {
        const stats: Record<string, number> = {};
        Object.keys(this.buffersPorCanal).forEach(canal => {
            stats[canal] = this.buffersPorCanal[canal].getAll().length;
        });
        return stats;
    }
} 
---
./core/alertacare/index.ts

export * from './types';
export * from './alertaCareService'; 
---
./core/alertacare/types.ts

// Tipos para Alerta Care
export interface AlertaCareMeta {
    habitacion: string;
    posicion: string;
    origen: string;
    canal: string;
}

export type AlertaCareChannel = 'inference.tap' | 'tracker.tap';

export interface InferenceEvent {
    meta: AlertaCareMeta & { canal: 'inference.tap' };
    evento: {
        tipo: 'inference';
        datos: Record<string, unknown>;
    };
}

export interface TrackerEvent {
    meta: AlertaCareMeta & { canal: 'tracker.tap' };
    evento: {
        tipo: 'tracker';
        datos: Record<string, unknown>;
    };
}

export type AlertaCareEvent = InferenceEvent | TrackerEvent;

export interface StreamEventPayload {
    meta: AlertaCareMeta;
    evento: Record<string, unknown>;
}

export interface BufferedEvent extends Record<string, unknown> {
    timestamp: Date;
} 
---
./core/communication/communicationService.ts

import { ConnectionInfo } from './types';

export class CommunicationService {
    private connections = new Map<string, ConnectionInfo>();
    private rooms = new Map<string, Set<string>>();

    // Gestión de conexiones
    addConnection(socketId: string): void {
        this.connections.set(socketId, {
            id: socketId,
            rooms: new Set<string>(),
            metadata: {},
            connectedAt: new Date()
        });
    }

    removeConnection(socketId: string): void {
        const conn = this.connections.get(socketId);
        if (conn) {
            // Limpiar de todas las salas
            conn.rooms.forEach(roomName => {
                this.leaveRoom(socketId, roomName);
            });
        }
        this.connections.delete(socketId);
    }

    getConnection(socketId: string): ConnectionInfo | undefined {
        return this.connections.get(socketId);
    }

    getConnections(): ConnectionInfo[] {
        return Array.from(this.connections.values());
    }

    getConnectionsCount(): number {
        return this.connections.size;
    }

    // Gestión de salas
    joinRoom(socketId: string, roomName: string): void {
        const conn = this.connections.get(socketId);
        if (!conn) return;

        conn.rooms.add(roomName);

        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        this.rooms.get(roomName)!.add(socketId);
    }

    leaveRoom(socketId: string, roomName: string): void {
        const conn = this.connections.get(socketId);
        if (conn) {
            conn.rooms.delete(roomName);
        }

        if (this.rooms.has(roomName)) {
            this.rooms.get(roomName)!.delete(socketId);
            if (this.rooms.get(roomName)!.size === 0) {
                this.rooms.delete(roomName);
            }
        }
    }

    getRoomSize(roomName: string): number {
        return this.rooms.get(roomName)?.size || 0;
    }

    getRoomsInfo(): Array<{ name: string; userCount: number; users: string[] }> {
        return Array.from(this.rooms.entries()).map(([name, users]) => ({
            name: name,
            userCount: users.size,
            users: Array.from(users)
        }));
    }

    // Metadata
    updateMetadata(socketId: string, metadata: Record<string, unknown>): void {
        const conn = this.connections.get(socketId);
        if (conn) {
            conn.metadata = { ...conn.metadata, ...metadata };
        }
    }

    // Verificaciones
    hasConnection(socketId: string): boolean {
        return this.connections.has(socketId);
    }
} 
---
./core/communication/index.ts

export * from './types';
export * from './communicationService'; 
---
./core/communication/types.ts

// Tipos para mensajería general
export interface ConnectionInfo {
    id: string;
    rooms: Set<string>;
    metadata: Record<string, unknown>;
    connectedAt: Date;
}

export interface PrivateMessage {
    targetId: string;
    message: any;
}

export interface RoomMessage {
    room: string;
    message: any;
}

export interface UserJoinedRoom {
    userId: string;
    room: string;
    roomSize: number;
}

export interface UserLeftRoom {
    userId: string;
    room: string;
    roomSize: number;
}

export interface BroadcastData {
    from: string;
    data: any;
    timestamp: Date;
} 
---
./core/management/index.ts

export * from './types';
export * from './managementService'; 
---
./core/management/managementService.ts

import os from 'os';
import { ServerStats, HealthStatus, SystemInfo, MetricsData, LogLevel } from './types';
import { CommunicationService } from '../communication/communicationService';
import { AlertaCareService } from '../alertacare/alertaCareService';

export class ManagementService {
    private logs: LogLevel[] = [];
    private readonly MAX_LOGS = 1000;
    private startTime: Date = new Date();
    private peakConnections: number = 0;
    private totalConnectionsHistory: number = 0;

    constructor(
        private communicationService: CommunicationService,
        private alertaCareService: AlertaCareService
    ) {}

    // Estadísticas generales del servidor
    getServerStats(): ServerStats {
        const currentConnections = this.communicationService.getConnectionsCount();
        this.updatePeakConnections(currentConnections);

        return {
            totalConnections: currentConnections,
            totalRooms: this.communicationService.getRoomsInfo().length,
            alertaCareChannels: this.alertaCareService.obtenerEstadisticasCanales(),
            uptime: process.uptime(),
            timestamp: new Date(),
            version: process.env.npm_package_version || '1.0.0'
        };
    }

    // Estado de salud del sistema
    getHealthStatus(): HealthStatus {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        let status: 'ok' | 'warning' | 'error' = 'ok';
        
        // Criterios básicos de salud
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
            status = 'warning';
        }
        if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
            status = 'error';
        }

        return {
            status,
            timestamp: new Date(),
            version: process.env.npm_package_version || '1.0.0',
            uptime,
            memoryUsage: memUsage,
            cpuUsage: process.cpuUsage()
        };
    }

    // Información del sistema
    getSystemInfo(): SystemInfo {
        return {
            nodeVersion: process.version,
            platform: os.platform(),
            architecture: os.arch(),
            hostname: os.hostname(),
            pid: process.pid
        };
    }

    // Métricas detalladas
    getMetrics(): MetricsData {
        const alertaCareStats = this.alertaCareService.obtenerEstadisticasCanales();
        const totalEvents = Object.values(alertaCareStats).reduce((sum, count) => sum + count, 0);

        return {
            connections: {
                current: this.communicationService.getConnectionsCount(),
                total: this.totalConnectionsHistory,
                peak: this.peakConnections
            },
            rooms: {
                current: this.communicationService.getRoomsInfo().length,
                total: this.communicationService.getRoomsInfo().length // Podríamos trackear histórico
            },
            alertacare: {
                channels: Object.keys(alertaCareStats).length,
                totalEvents: totalEvents
            },
            performance: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            }
        };
    }

    // Gestión de logs
    addLog(level: LogLevel['level'], message: string, context?: string): void {
        const logEntry: LogLevel = {
            level,
            message,
            timestamp: new Date(),
            context
        };

        this.logs.unshift(logEntry);
        
        // Mantener solo los últimos logs
        if (this.logs.length > this.MAX_LOGS) {
            this.logs = this.logs.slice(0, this.MAX_LOGS);
        }

        // También log a consola basado en nivel
        const logMessage = `[${logEntry.timestamp.toISOString()}] ${level.toUpperCase()}: ${message}${context ? ` (${context})` : ''}`;
        
        switch (level) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'info':
                console.info(logMessage);
                break;
            case 'debug':
                console.debug(logMessage);
                break;
        }
    }

    // Obtener logs recientes
    getLogs(limit: number = 100, level?: LogLevel['level']): LogLevel[] {
        let filteredLogs = this.logs;
        
        if (level) {
            filteredLogs = this.logs.filter(log => log.level === level);
        }
        
        return filteredLogs.slice(0, limit);
    }

    // Limpiar logs
    clearLogs(): void {
        this.logs = [];
    }

    // Actualizar estadísticas internas
    onConnectionAdded(): void {
        this.totalConnectionsHistory++;
        this.updatePeakConnections(this.communicationService.getConnectionsCount());
    }

    private updatePeakConnections(current: number): void {
        if (current > this.peakConnections) {
            this.peakConnections = current;
        }
    }

    // Reset de estadísticas
    resetStats(): void {
        this.peakConnections = this.communicationService.getConnectionsCount();
        this.totalConnectionsHistory = this.communicationService.getConnectionsCount();
        this.startTime = new Date();
    }
} 
---
./core/management/types.ts

// Tipos para Support Management
export interface ServerStats {
    totalConnections: number;
    totalRooms: number;
    alertaCareChannels: Record<string, number>;
    uptime: number;
    timestamp: Date;
    version: string;
}

export interface HealthStatus {
    status: 'ok' | 'warning' | 'error';
    timestamp: Date;
    version: string;
    uptime: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
}

export interface SystemInfo {
    nodeVersion: string;
    platform: string;
    architecture: string;
    hostname: string;
    pid: number;
}

export interface LogLevel {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: Date;
    context?: string;
}

export interface MetricsData {
    connections: {
        current: number;
        total: number;
        peak: number;
    };
    rooms: {
        current: number;
        total: number;
    };
    alertacare: {
        channels: number;
        totalEvents: number;
    };
    performance: {
        uptime: number;
        memoryUsage: NodeJS.MemoryUsage;
    };
} 
---
./infrastructure/api/alertaCareApiController.ts

import express, { Request, Response } from 'express';
import { AlertaCareService } from '../../core/alertacare/alertaCareService';
import { AlertaCareMeta } from '../../core/alertacare/types';

export class AlertaCareApiController {
    private router = express.Router();

    constructor(
        private alertaCareService: AlertaCareService
    ) {
        this.setupRoutes();
    }

    getRouter(): express.Router {
        return this.router;
    }

    private setupRoutes(): void {
        // Obtener eventos de un canal específico
        this.router.get('/streams/:habitacion/:posicion/:origen/:canal/events', this.getStreamEvents.bind(this));
        
        // Obtener estadísticas de Alerta Care
        this.router.get('/stats', this.getAlertaCareStats.bind(this));
        
        // Obtener información de canales
        this.router.get('/channels', this.getChannels.bind(this));
        
        // Obtener eventos recientes de un canal específico con filtros
        this.router.get('/channels/:channelKey/events', this.getChannelEvents.bind(this));
        
        // Crear evento manualmente (para testing)
        this.router.post('/streams/:habitacion/:posicion/:origen/:canal/events', this.createStreamEvent.bind(this));
    }

    private getStreamEvents(req: Request, res: Response): void {
        try {
            const { habitacion, posicion, origen, canal } = req.params;
            
            if (!habitacion || !posicion || !origen || !canal) {
                res.status(400).json({ 
                    error: 'Parámetros requeridos: habitacion, posicion, origen, canal' 
                });
                return;
            }

            // Validar canal
            if (!['inference.tap', 'tracker.tap'].includes(canal)) {
                res.status(400).json({
                    error: 'Canal inválido: debe ser inference.tap o tracker.tap',
                    allowedChannels: ['inference.tap', 'tracker.tap']
                });
                return;
            }

            const meta: AlertaCareMeta = { habitacion, posicion, origen, canal };
            const eventos = this.alertaCareService.obtenerEventos(meta);
            
            res.json({ 
                eventos,
                count: eventos.length,
                channel: `${habitacion}.${posicion}.${origen}.${canal}.tap`,
                meta: {
                    habitacion,
                    posicion,
                    origen,
                    canal
                },
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({ 
                error: 'Error interno del servidor',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getAlertaCareStats(_req: Request, res: Response): void {
        try {
            const stats = this.alertaCareService.obtenerEstadisticasCanales();
            
            // Agrupar por tipo de canal
            const statsByChannelType = Object.entries(stats).reduce((acc, [channel, count]) => {
                const parts = channel.split('.');
                const channelType = parts[parts.length - 2]; // inference o tracker
                
                if (!acc[channelType]) {
                    acc[channelType] = {
                        channels: 0,
                        totalEvents: 0,
                        channelList: []
                    };
                }
                
                acc[channelType].channels++;
                acc[channelType].totalEvents += count;
                acc[channelType].channelList.push({
                    channel,
                    events: count
                });
                
                return acc;
            }, {} as Record<string, any>);

            res.json({
                summary: {
                    totalChannels: Object.keys(stats).length,
                    totalEvents: Object.values(stats).reduce((sum, count) => sum + count, 0),
                    channelTypes: Object.keys(statsByChannelType)
                },
                byChannelType: statsByChannelType,
                allChannels: stats,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({ 
                error: 'Error al obtener estadísticas de Alerta Care',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getChannels(_req: Request, res: Response): void {
        try {
            const stats = this.alertaCareService.obtenerEstadisticasCanales();
            
            const channels = Object.entries(stats).map(([channelKey, eventCount]) => {
                const parts = channelKey.split('.');
                return {
                    key: channelKey,
                    habitacion: parts[0],
                    posicion: parts[1],
                    origen: parts[2],
                    canal: parts[3],
                    eventCount,
                    lastActivity: new Date() // Podrías trackear esto más precisamente
                };
            });

            res.json({
                channels,
                count: channels.length,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener información de canales',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getChannelEvents(req: Request, res: Response): void {
        try {
            const { channelKey } = req.params;
            
            if (!channelKey) {
                res.status(400).json({
                    error: 'Channel key requerido'
                });
                return;
            }

            // Parse del channel key: habitacion.posicion.origen.canal.tap
            const parts = channelKey.split('.');
            if (parts.length !== 5 || parts[4] !== 'tap') {
                res.status(400).json({
                    error: 'Formato de channel key inválido. Esperado: habitacion.posicion.origen.canal.tap'
                });
                return;
            }

            const [habitacion, posicion, origen, canal] = parts;
            const meta: AlertaCareMeta = { habitacion, posicion, origen, canal };
            const eventos = this.alertaCareService.obtenerEventos(meta);

            res.json({
                channel: {
                    key: channelKey,
                    habitacion,
                    posicion,
                    origen,
                    canal
                },
                eventos,
                count: eventos.length,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener eventos del canal',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private createStreamEvent(req: Request, res: Response): void {
        try {
            const { habitacion, posicion, origen, canal } = req.params;
            const { evento } = req.body;
            
            if (!habitacion || !posicion || !origen || !canal) {
                res.status(400).json({
                    error: 'Parámetros requeridos: habitacion, posicion, origen, canal'
                });
                return;
            }

            if (!evento) {
                res.status(400).json({
                    error: 'Body requerido: evento'
                });
                return;
            }

            // Validar canal
            if (!['inference.tap', 'tracker.tap'].includes(canal)) {
                res.status(400).json({
                    error: 'Canal inválido: debe ser inference.tap o tracker.tap',
                    allowedChannels: ['inference.tap', 'tracker.tap']
                });
                return;
            }

            const meta: AlertaCareMeta = { habitacion, posicion, origen, canal };
            this.alertaCareService.guardarEvento(meta, evento);

            res.status(201).json({
                message: 'Evento creado exitosamente',
                channel: `${habitacion}.${posicion}.${origen}.${canal}.tap`,
                meta,
                evento,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al crear evento de stream',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
} 
---
./infrastructure/api/communicationApiController.ts

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
---
./infrastructure/api/managementApiController.ts

import express, { Request, Response } from 'express';
import { ManagementService } from '../../core/management/managementService';

export class ManagementApiController {
    private router = express.Router();

    constructor(
        private managementService: ManagementService
    ) {
        this.setupRoutes();
    }

    getRouter(): express.Router {
        return this.router;
    }

    private setupRoutes(): void {
        // Endpoint para estadísticas generales del servidor
        this.router.get('/stats', this.getServerStats.bind(this));
        
        // Endpoint de salud del sistema
        this.router.get('/health', this.getHealthStatus.bind(this));
        
        // Información del sistema
        this.router.get('/system', this.getSystemInfo.bind(this));
        
        // Métricas detalladas
        this.router.get('/metrics', this.getMetrics.bind(this));
        
        // Gestión de logs
        this.router.get('/logs', this.getLogs.bind(this));
        this.router.delete('/logs', this.clearLogs.bind(this));
        
        // Reset de estadísticas
        this.router.post('/stats/reset', this.resetStats.bind(this));
        
        // Endpoint para diagnostics completos
        this.router.get('/diagnostics', this.getDiagnostics.bind(this));
    }

    private getServerStats(_req: Request, res: Response): void {
        try {
            const stats = this.managementService.getServerStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener estadísticas del servidor',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getHealthStatus(_req: Request, res: Response): void {
        try {
            const health = this.managementService.getHealthStatus();
            
            // Determinar el código de respuesta basado en el estado
            let statusCode = 200;
            if (health.status === 'warning') statusCode = 200; // Todavía operacional
            if (health.status === 'error') statusCode = 503; // Servicio no disponible

            res.status(statusCode).json(health);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                error: 'Error al obtener estado de salud',
                message: error instanceof Error ? error.message : 'Error desconocido',
                timestamp: new Date()
            });
        }
    }

    private getSystemInfo(_req: Request, res: Response): void {
        try {
            const systemInfo = this.managementService.getSystemInfo();
            res.json({
                system: systemInfo,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener información del sistema',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getMetrics(_req: Request, res: Response): void {
        try {
            const metrics = this.managementService.getMetrics();
            res.json({
                metrics,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener métricas',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getLogs(req: Request, res: Response): void {
        try {
            const limit = parseInt(req.query.limit as string) || 100;
            const level = req.query.level as string;
            
            if (limit < 1 || limit > 10000) {
                res.status(400).json({
                    error: 'Límite debe estar entre 1 y 10000'
                });
                return;
            }

            const logs = this.managementService.getLogs(limit, level as any);
            
            res.json({
                logs,
                count: logs.length,
                filters: {
                    limit,
                    level: level || 'all'
                },
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al obtener logs',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private clearLogs(_req: Request, res: Response): void {
        try {
            this.managementService.clearLogs();
            res.json({
                message: 'Logs limpiados exitosamente',
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al limpiar logs',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private resetStats(_req: Request, res: Response): void {
        try {
            this.managementService.resetStats();
            res.json({
                message: 'Estadísticas reseteadas exitosamente',
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al resetear estadísticas',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    private getDiagnostics(_req: Request, res: Response): void {
        try {
            const stats = this.managementService.getServerStats();
            const health = this.managementService.getHealthStatus();
            const systemInfo = this.managementService.getSystemInfo();
            const metrics = this.managementService.getMetrics();
            const recentLogs = this.managementService.getLogs(50);

            res.json({
                diagnostics: {
                    overview: {
                        status: health.status,
                        uptime: stats.uptime,
                        version: stats.version,
                        timestamp: new Date()
                    },
                    health,
                    stats,
                    system: systemInfo,
                    metrics,
                    recentLogs: {
                        logs: recentLogs,
                        count: recentLogs.length
                    }
                },
                generatedAt: new Date()
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error al generar diagnósticos',
                message: error instanceof Error ? error.message : 'Error desconocido',
                timestamp: new Date()
            });
        }
    }
} 
---
./infrastructure/websocket/alertaCareWebSocketController.ts

import { Socket } from 'socket.io';
import { AlertaCareService } from '../../core/alertacare/alertaCareService';
import { StreamEventPayload } from '../../core/alertacare/types';

export class AlertaCareWebSocketController {
    constructor(
        private alertaCareService: AlertaCareService
    ) {}

    handleConnection(socket: Socket): void {
        this.setupAlertaCareHandlers(socket);
    }

    private setupAlertaCareHandlers(socket: Socket): void {
        // Eventos de stream para Alerta Care
        socket.on('stream_event', (payload: StreamEventPayload) => {
            try {
                const { meta, evento } = payload || ({} as any);
                
                if (!meta || !evento) {
                    socket.emit('stream_event_error', {
                        error: 'Payload inválido: meta y evento son requeridos',
                        timestamp: new Date()
                    });
                    console.warn(`[ALERTA_CARE] Invalid payload from ${socket.id}`);
                    return;
                }

                // Validar canal
                if (!meta.canal || !['inference.tap', 'tracker.tap'].includes(meta.canal)) {
                    socket.emit('stream_event_error', {
                        error: 'Canal inválido: debe ser inference.tap o tracker.tap',
                        timestamp: new Date()
                    });
                    console.warn(`[ALERTA_CARE] Invalid channel ${meta.canal} from ${socket.id}`);
                    return;
                }

                this.alertaCareService.guardarEvento(meta, evento);

                // Confirmar recepción
                socket.emit('stream_event_ack', {
                    channel: `${meta.habitacion}.${meta.posicion}.${meta.origen}.${meta.canal}.tap`,
                    timestamp: new Date()
                });

                console.log(`[ALERTA_CARE] Event received from ${socket.id} for channel ${meta.canal}`);

                // Broadcast del evento a otros clientes interesados (opcional)
                socket.broadcast.emit('stream_event_broadcast', {
                    from: socket.id,
                    meta,
                    evento,
                    timestamp: new Date()
                });

            } catch (error) {
                socket.emit('stream_event_error', {
                    error: 'Error procesando evento de stream',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[ALERTA_CARE] Error processing stream event from ${socket.id}:`, error);
            }
        });

        // Suscribirse a un canal específico
        socket.on('subscribe_channel', (data: { habitacion: string; posicion: string; origen: string; canal: string }) => {
            try {
                const { habitacion, posicion, origen, canal } = data;
                
                if (!habitacion || !posicion || !origen || !canal) {
                    socket.emit('subscription_error', {
                        error: 'Parámetros requeridos: habitacion, posicion, origen, canal',
                        timestamp: new Date()
                    });
                    return;
                }

                const channelRoom = `${habitacion}.${posicion}.${origen}.${canal}.tap`;
                socket.join(channelRoom);

                socket.emit('subscription_confirmed', {
                    channel: channelRoom,
                    timestamp: new Date()
                });

                console.log(`[ALERTA_CARE] ${socket.id} subscribed to channel: ${channelRoom}`);

            } catch (error) {
                socket.emit('subscription_error', {
                    error: 'Error en suscripción al canal',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[ALERTA_CARE] Subscription error for ${socket.id}:`, error);
            }
        });

        // Desuscribirse de un canal
        socket.on('unsubscribe_channel', (data: { habitacion: string; posicion: string; origen: string; canal: string }) => {
            try {
                const { habitacion, posicion, origen, canal } = data;
                const channelRoom = `${habitacion}.${posicion}.${origen}.${canal}.tap`;
                
                socket.leave(channelRoom);

                socket.emit('unsubscription_confirmed', {
                    channel: channelRoom,
                    timestamp: new Date()
                });

                console.log(`[ALERTA_CARE] ${socket.id} unsubscribed from channel: ${channelRoom}`);

            } catch (error) {
                socket.emit('unsubscription_error', {
                    error: 'Error en desuscripción del canal',
                    timestamp: new Date()
                });
                console.error(`[ALERTA_CARE] Unsubscription error for ${socket.id}:`, error);
            }
        });

        // Obtener eventos recientes de un canal
        socket.on('get_channel_events', (data: { habitacion: string; posicion: string; origen: string; canal: string }) => {
            try {
                const { habitacion, posicion, origen, canal } = data;
                
                if (!habitacion || !posicion || !origen || !canal) {
                    socket.emit('channel_events_error', {
                        error: 'Parámetros requeridos: habitacion, posicion, origen, canal',
                        timestamp: new Date()
                    });
                    return;
                }

                const eventos = this.alertaCareService.obtenerEventos({ habitacion, posicion, origen, canal });

                socket.emit('channel_events', {
                    channel: `${habitacion}.${posicion}.${origen}.${canal}.tap`,
                    eventos,
                    count: eventos.length,
                    timestamp: new Date()
                });

                console.log(`[ALERTA_CARE] Sent ${eventos.length} events to ${socket.id} for channel ${canal}`);

            } catch (error) {
                socket.emit('channel_events_error', {
                    error: 'Error obteniendo eventos del canal',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[ALERTA_CARE] Error getting channel events for ${socket.id}:`, error);
            }
        });
    }

    handleDisconnection(socket: Socket, reason: string): void {
        console.log(`[ALERTA_CARE] Client disconnected: ${socket.id}, reason: ${reason}`);
    }
} 
---
./infrastructure/websocket/communicationWebSocketController.ts

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
---
./infrastructure/websocket/managementWebSocketController.ts

import { Socket } from 'socket.io';
import { ManagementService } from '../../core/management/managementService';

export class ManagementWebSocketController {
    constructor(
        private managementService: ManagementService
    ) {}

    handleConnection(socket: Socket): void {
        this.setupManagementHandlers(socket);
    }

    private setupManagementHandlers(socket: Socket): void {
        // Obtener estadísticas del servidor
        socket.on('get_server_stats', () => {
            try {
                const stats = this.managementService.getServerStats();
                socket.emit('server_stats', stats);
                console.log(`[MANAGEMENT] Server stats sent to ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error obteniendo estadísticas del servidor',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error getting server stats for ${socket.id}:`, error);
            }
        });

        // Obtener estado de salud
        socket.on('get_health_status', () => {
            try {
                const health = this.managementService.getHealthStatus();
                socket.emit('health_status', health);
                console.log(`[MANAGEMENT] Health status sent to ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error obteniendo estado de salud',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error getting health status for ${socket.id}:`, error);
            }
        });

        // Obtener información del sistema
        socket.on('get_system_info', () => {
            try {
                const systemInfo = this.managementService.getSystemInfo();
                socket.emit('system_info', systemInfo);
                console.log(`[MANAGEMENT] System info sent to ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error obteniendo información del sistema',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error getting system info for ${socket.id}:`, error);
            }
        });

        // Obtener métricas detalladas
        socket.on('get_metrics', () => {
            try {
                const metrics = this.managementService.getMetrics();
                socket.emit('metrics', metrics);
                console.log(`[MANAGEMENT] Metrics sent to ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error obteniendo métricas',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error getting metrics for ${socket.id}:`, error);
            }
        });

        // Obtener logs
        socket.on('get_logs', (data: { limit?: number; level?: string } = {}) => {
            try {
                const { limit = 100, level } = data;
                const logs = this.managementService.getLogs(limit, level as any);
                socket.emit('logs', {
                    logs,
                    count: logs.length,
                    timestamp: new Date()
                });
                console.log(`[MANAGEMENT] ${logs.length} logs sent to ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error obteniendo logs',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error getting logs for ${socket.id}:`, error);
            }
        });

        // Limpiar logs
        socket.on('clear_logs', () => {
            try {
                this.managementService.clearLogs();
                socket.emit('logs_cleared', { timestamp: new Date() });
                console.log(`[MANAGEMENT] Logs cleared by ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error limpiando logs',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error clearing logs for ${socket.id}:`, error);
            }
        });

        // Reset de estadísticas
        socket.on('reset_stats', () => {
            try {
                this.managementService.resetStats();
                socket.emit('stats_reset', { timestamp: new Date() });
                console.log(`[MANAGEMENT] Stats reset by ${socket.id}`);
            } catch (error) {
                socket.emit('management_error', {
                    error: 'Error reseteando estadísticas',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    timestamp: new Date()
                });
                console.error(`[MANAGEMENT] Error resetting stats for ${socket.id}:`, error);
            }
        });

        // Suscribirse a actualizaciones de métricas en tiempo real
        socket.on('subscribe_metrics_updates', () => {
            socket.join('metrics_updates');
            socket.emit('metrics_subscription_confirmed', { timestamp: new Date() });
            console.log(`[MANAGEMENT] ${socket.id} subscribed to metrics updates`);
        });

        // Desuscribirse de actualizaciones de métricas
        socket.on('unsubscribe_metrics_updates', () => {
            socket.leave('metrics_updates');
            socket.emit('metrics_unsubscription_confirmed', { timestamp: new Date() });
            console.log(`[MANAGEMENT] ${socket.id} unsubscribed from metrics updates`);
        });
    }

    handleDisconnection(socket: Socket, reason: string): void {
        console.log(`[MANAGEMENT] Client disconnected: ${socket.id}, reason: ${reason}`);
    }

    // Método para broadcast de métricas (llamado externamente por un timer)
    broadcastMetricsUpdate(io: any): void {
        try {
            const metrics = this.managementService.getMetrics();
            io.to('metrics_updates').emit('metrics_update', {
                metrics,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('[MANAGEMENT] Error broadcasting metrics update:', error);
        }
    }
} 
---
./main.ts

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';

// Servicios principales
import { CommunicationService } from './core/communication/communicationService';
import { AlertaCareService } from './core/alertacare/alertaCareService';
import { ManagementService } from './core/management/managementService';

// Controladores WebSocket por contexto
import { CommunicationWebSocketController } from './infrastructure/websocket/communicationWebSocketController';
import { AlertaCareWebSocketController } from './infrastructure/websocket/alertaCareWebSocketController';
import { ManagementWebSocketController } from './infrastructure/websocket/managementWebSocketController';

// Controladores API por contexto
import { CommunicationApiController } from './infrastructure/api/communicationApiController';
import { AlertaCareApiController } from './infrastructure/api/alertaCareApiController';
import { ManagementApiController } from './infrastructure/api/managementApiController';

class CareRelayServer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;

    // Servicios principales
    private communicationService: CommunicationService;
    private alertaCareService: AlertaCareService;
    private managementService: ManagementService;

    // Controladores WebSocket por contexto
    private communicationWebSocketController: CommunicationWebSocketController;
    private alertaCareWebSocketController: AlertaCareWebSocketController;
    private managementWebSocketController: ManagementWebSocketController;

    // Controladores API por contexto
    private communicationApiController: CommunicationApiController;
    private alertaCareApiController: AlertaCareApiController;
    private managementApiController: ManagementApiController;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Configurar Socket.IO
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Inicializar servicios
        this.communicationService = new CommunicationService();
        this.alertaCareService = new AlertaCareService();
        this.managementService = new ManagementService(
            this.communicationService,
            this.alertaCareService
        );

        // Inicializar controladores WebSocket
        this.communicationWebSocketController = new CommunicationWebSocketController(
            this.io,
            this.communicationService
        );
        this.alertaCareWebSocketController = new AlertaCareWebSocketController(
            this.alertaCareService
        );
        this.managementWebSocketController = new ManagementWebSocketController(
            this.managementService
        );

        // Inicializar controladores API
        this.communicationApiController = new CommunicationApiController(
            this.communicationService
        );
        this.alertaCareApiController = new AlertaCareApiController(
            this.alertaCareService
        );
        this.managementApiController = new ManagementApiController(
            this.managementService
        );

        this.setupExpress();
        this.setupWebSocket();
        this.setupGracefulShutdown();
    }

    private setupExpress(): void {
        // Configurar CORS
        this.app.use(cors({
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"]
        }));
        
        // Servir archivos estáticos
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Middleware para parsing JSON
        this.app.use(express.json());
        
        // Configurar rutas de API por contexto
        this.app.use('/api/communication', this.communicationApiController.getRouter());
        this.app.use('/api/alertacare', this.alertaCareApiController.getRouter());
        this.app.use('/api/management', this.managementApiController.getRouter());
        
        // Ruta por defecto para SPA
        this.app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                res.sendFile(path.join(__dirname, '../public/index.html'));
            }
        });
    }

    private setupWebSocket(): void {
        // Configurar middleware de WebSocket
        this.io.use((socket, next) => {
            console.log(`Nueva conexión: ${socket.id} desde ${socket.handshake.address}`);
            next();
        });
        
        // Manejar conexiones
        this.io.on('connection', (socket) => {
            // Registrar nueva conexión
            this.communicationService.addConnection(socket.id);
            this.managementService.onConnectionAdded();

            console.log(`Cliente conectado: ${socket.id}`);

            // Enviar información de conexión
            socket.emit('connection_info', {
                id: socket.id,
                totalConnections: this.communicationService.getConnectionsCount(),
                timestamp: new Date()
            });

            // Notificar nueva conexión
            socket.broadcast.emit('user_connected', {
                userId: socket.id,
                totalConnections: this.communicationService.getConnectionsCount()
            });

            // Configurar handlers por contexto
            this.communicationWebSocketController.handleConnection(socket);
            this.alertaCareWebSocketController.handleConnection(socket);
            this.managementWebSocketController.handleConnection(socket);

            // Manejar desconexión
            socket.on('disconnect', (reason: string) => {
                // Llamar a los handlers de desconexión por contexto
                this.communicationWebSocketController.handleDisconnection(socket, reason);
                this.alertaCareWebSocketController.handleDisconnection(socket, reason);
                this.managementWebSocketController.handleDisconnection(socket, reason);

                // Limpiar conexión del servicio de comunicación
                this.communicationService.removeConnection(socket.id);

                // Notificar desconexión
                socket.broadcast.emit('user_disconnected', {
                    userId: socket.id,
                    totalConnections: this.communicationService.getConnectionsCount(),
                    reason: reason
                });
            });
        });
    }

    private setupGracefulShutdown(): void {
        const shutdown = () => {
            console.log('Shutting down gracefully...');
            this.server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }

    public start(port: number = 3000): void {
        this.server.listen(port, () => {
            console.log(`🚀 Care Relay Server running on port ${port}`);
            console.log(`📡 WebSocket ready for connections`);
            
            console.log(`\n📋 API Endpoints by Context:`);
            console.log(`   💬 Communication: http://localhost:${port}/api/communication/*`);
            console.log(`   🚨 Alerta Care: http://localhost:${port}/api/alertacare/*`);
            console.log(`   ⚙️  Management: http://localhost:${port}/api/management/*`);
            
            console.log(`\n🔗 Quick Links:`);
            console.log(`   📊 Server Stats: http://localhost:${port}/api/management/stats`);
            console.log(`   🏥 Health Check: http://localhost:${port}/api/management/health`);
            console.log(`   📈 Metrics: http://localhost:${port}/api/management/metrics`);
            console.log(`   💬 Connections: http://localhost:${port}/api/communication/connections`);
            console.log(`   🚨 AlertaCare Stats: http://localhost:${port}/api/alertacare/stats`);
            
            console.log(`\n📋 Available Contexts:`);
            console.log(`   💬 Communication: rooms, private messages, broadcast`);
            console.log(`   🚨 Alerta Care: inference.tap, tracker.tap channels`);
            console.log(`   ⚙️  Management: stats, health, logs, metrics`);
        });
    }

    // Métodos para acceder a los servicios (útil para testing)
    public getCommunicationService(): CommunicationService {
        return this.communicationService;
    }

    public getAlertaCareService(): AlertaCareService {
        return this.alertaCareService;
    }

    public getManagementService(): ManagementService {
        return this.managementService;
    }
}

// Inicializar y arrancar el servidor
const server = new CareRelayServer();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.start(PORT); 
---
./shared/circularBuffer.ts

export default class CircularBuffer<T> {
    private buffer: (T | undefined)[];
    private index: number;
    private filled: boolean;

    constructor(private size: number) {
        this.buffer = new Array<T | undefined>(size);
        this.index = 0;
        this.filled = false;
    }

    push(item: T): void {
        this.buffer[this.index] = item;
        this.index = (this.index + 1) % this.size;
        if (this.index === 0) this.filled = true;
    }

    getAll(): T[] {
        if (!this.filled) return this.buffer.slice(0, this.index) as T[];
        return this.buffer.slice(this.index).concat(this.buffer.slice(0, this.index)) as T[];
    }
} 

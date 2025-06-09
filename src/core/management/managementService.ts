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
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
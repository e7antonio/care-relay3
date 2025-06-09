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
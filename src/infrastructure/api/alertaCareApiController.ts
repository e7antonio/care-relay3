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
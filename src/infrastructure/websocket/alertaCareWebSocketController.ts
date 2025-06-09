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
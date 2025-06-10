import { Server, Socket } from 'socket.io';
import { InferenceEventDto } from '../../@types/InferenceEvent.dto.js';

/**
 * Manejador de eventos provenientes de la pipeline de inferencia
 */
export class PipelineHandler {
  constructor(private io: Server) {}

  /**
   * Inicializa los event listeners para la pipeline
   */
  public initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      // Escuchamos eventos específicos de la pipeline
      socket.on('pipeline:inference_event', (eventData: InferenceEventDto) => {
        this.handleInferenceEvent(socket, eventData);
      });

      socket.on('pipeline:heartbeat', (data: any) => {
        this.handleHeartbeat(socket, data);
      });

      console.log(`[PIPELINE] Nueva conexión desde pipeline: ${socket.id}`);
    });
  }

  /**
   * Procesa un evento de inferencia y lo retransmite a todos los clientes conectados
   */
  private handleInferenceEvent(socket: Socket, eventData: InferenceEventDto): void {
    try {
      // Validamos que el evento tenga la estructura esperada
      if (!this.validateInferenceEvent(eventData)) {
        console.error(`[PIPELINE] Evento inválido recibido de ${socket.id}:`, eventData);
        socket.emit('pipeline:error', { message: 'Formato de evento inválido' });
        return;
      }

      console.log(`[PIPELINE] Evento recibido: ${eventData.eventType} (${eventData.id})`);

      // Retransmitimos el evento a todos los clientes conectados
      this.io.emit('client:inference_event', eventData);

      // Confirmamos recepción a la pipeline
      socket.emit('pipeline:ack', { eventId: eventData.id, status: 'processed' });

    } catch (error) {
      console.error(`[PIPELINE] Error procesando evento:`, error);
      socket.emit('pipeline:error', { message: 'Error interno del servidor' });
    }
  }

  /**
   * Maneja el heartbeat de la pipeline para monitoreo de conexión
   */
  private handleHeartbeat(socket: Socket, data: any): void {
    console.log(`[PIPELINE] Heartbeat recibido de ${socket.id}`);
    socket.emit('pipeline:heartbeat_ack', { timestamp: new Date().toISOString() });
  }

  /**
   * Valida que un evento de inferencia tenga la estructura correcta
   */
  private validateInferenceEvent(event: any): event is InferenceEventDto {
    return (
      event &&
      typeof event.id === 'string' &&
      typeof event.timestamp === 'string' &&
      typeof event.eventType === 'string' &&
      event.data &&
      typeof event.data.confidence === 'number' &&
      typeof event.sourceId === 'string'
    );
  }
} 
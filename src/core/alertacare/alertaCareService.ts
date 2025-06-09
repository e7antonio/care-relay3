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
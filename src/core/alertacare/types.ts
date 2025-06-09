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
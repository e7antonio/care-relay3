/**
 * DTO que define la estructura de los eventos de inferencia que llegan desde la pipeline
 */
export interface InferenceEventDto {
  /** ID único del evento */
  id: string;
  
  /** Timestamp del evento (ISO 8601) */
  timestamp: string;
  
  /** Tipo de evento (ej: 'fall_detection', 'person_detected', 'emergency') */
  eventType: string;
  
  /** Datos específicos del evento */
  data: {
    /** Probabilidad/confianza de la inferencia (0-1) */
    confidence: number;
    
    /** Coordenadas de bounding box si aplica */
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    
    /** Metadatos adicionales */
    metadata?: Record<string, any>;
  };
  
  /** ID de la cámara/sensor que generó el evento */
  sourceId: string;
  
  /** ID de la habitación/zona */
  roomId?: string;
} 
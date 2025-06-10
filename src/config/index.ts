/**
 * Configuración centralizada del servidor Care Relay
 */
export const config = {
  /** Puerto del servidor */
  port: process.env.PORT || 3001,
  
  /** Configuración de CORS para Socket.IO */
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
      : "*", // En desarrollo permitimos cualquier origen
    methods: ["GET", "POST"] as string[]
  },
  
  /** Configuración de logs */
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
} as const; 
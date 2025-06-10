# Care Relay

Real-time event relay for Alerta Care using TypeScript, Express and Socket.IO.

## 🚀 Características

- **Tipado fuerte** con TypeScript
- **Arquitectura modular** y escalable
- **WebSockets** en tiempo real con Socket.IO
- **API REST** para estadísticas y health checks
- **Manejo de eventos** de pipeline de inferencia
- **Gestión de clientes** conectados

## 📁 Estructura del Proyecto

```
care-relay/
├── src/
│   ├── @types/           # Definiciones de tipos y DTOs
│   │   └── InferenceEvent.dto.ts
│   ├── config/           # Configuración centralizada
│   │   └── index.ts
│   ├── modules/          # Lógica de negocio por módulo
│   │   ├── pipeline/       # Manejador de eventos de la pipeline
│   │   │   └── pipeline.handler.ts
│   │   └── client/         # Manejador de conexiones de clientes
│   │       └── client.handler.ts
│   ├── server.ts         # Orquestador principal del servidor
│   └── index.ts          # Punto de entrada de la aplicación
├── package.json
├── tsconfig.json
└── .gitignore
```

## 🛠️ Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Compilar el proyecto:**
   ```bash
   npm run build
   ```

## 🏃 Ejecución

### Modo Desarrollo (con recarga automática)
```bash
npm run dev
```

### Modo Producción
```bash
npm run build && npm start
```

## 🔌 API Endpoints

### HTTP REST

- **GET /** - Estado general del servidor
- **GET /stats** - Estadísticas detalladas del servidor
- **GET /health** - Health check simple

### WebSocket Events

#### Pipeline → Relay
- `pipeline:inference_event` - Envía eventos de inferencia
- `pipeline:heartbeat` - Heartbeat para monitoreo

#### Relay → Pipeline
- `pipeline:ack` - Confirmación de recepción
- `pipeline:error` - Error en procesamiento
- `pipeline:heartbeat_ack` - Respuesta al heartbeat

#### Client → Relay
- `client:register` - Registro de cliente
- `client:request_status` - Solicitud de estado

#### Relay → Client
- `client:inference_event` - Evento de inferencia retransmitido
- `client:registration_success` - Confirmación de registro
- `client:status_response` - Respuesta de estado
- `client:current_stats` - Estadísticas actuales

## 🔧 Configuración

El archivo `src/config/index.ts` contiene la configuración centralizada:

- **Puerto:** `PORT` (default: 3001)
- **CORS:** Configurado para desarrollo (`*`) y producción (origins específicos)
- **Logging:** Nivel configurable via `LOG_LEVEL`

### Variables de Entorno

```bash
PORT=3001                           # Puerto del servidor
NODE_ENV=production                 # Entorno (development/production)
ALLOWED_ORIGINS=http://localhost:3000,https://mydomain.com  # Origins permitidos en producción
LOG_LEVEL=info                      # Nivel de logging
```

## 🏗️ Arquitectura

### Separación de Responsabilidades

1. **`index.ts`** - Punto de entrada y manejo de señales
2. **`server.ts`** - Configuración de Express y Socket.IO
3. **`config/`** - Configuración centralizada
4. **`modules/pipeline/`** - Lógica específica para eventos de pipeline
5. **`modules/client/`** - Lógica específica para clientes conectados
6. **`@types/`** - Definiciones de tipos TypeScript

### Flujo de Datos

```
Pipeline → Socket.IO → PipelineHandler → Validation → Relay → ClientHandler → UI Clients
```

## 🧪 Testing

Para probar la conexión WebSocket, puedes usar cualquier cliente Socket.IO:

```javascript
// Cliente de ejemplo
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// Registrarse como cliente
socket.emit('client:register', { name: 'Test Client' });

// Escuchar eventos de inferencia
socket.on('client:inference_event', (event) => {
  console.log('Evento recibido:', event);
});
```

## 📝 Tipo de Evento de Inferencia

```typescript
interface InferenceEventDto {
  id: string;                    // ID único del evento
  timestamp: string;             // Timestamp ISO 8601
  eventType: string;             // Tipo de evento
  data: {
    confidence: number;          // Confianza (0-1)
    boundingBox?: {              // Coordenadas opcionales
      x: number;
      y: number;
      width: number;
      height: number;
    };
    metadata?: Record<string, any>;
  };
  sourceId: string;              // ID de la fuente
  roomId?: string;               // ID de habitación (opcional)
}
```

## 🐛 Desarrollo

- **TypeScript** con configuración estricta
- **ES Modules** para sintaxis moderna
- **Hot reload** en modo desarrollo
- **Source maps** para debugging
- **Logging** estructurado con identificadores de módulo

## 📄 Licencia

MIT 
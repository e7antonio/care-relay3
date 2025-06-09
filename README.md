# Care Relay - Servidor de Comunicación en Tiempo Real

Un servidor de relay en tiempo real basado en Socket.IO con arquitectura por contextos, diseñado para facilitar la comunicación entre múltiples clientes y gestionar eventos de telemetría de sistemas de alerta médica.

## 🏗️ Arquitectura por Contextos

El sistema está organizado en tres contextos principales:

### 💬 **Communication Context**
- Mensajería en tiempo real entre clientes
- Gestión de salas (rooms) y usuarios
- Comunicación privada y broadcast
- Gestión de metadatos de usuarios

### 🚨 **Alerta Care Context**
- Canales específicos: `inference.tap` y `tracker.tap`
- Buffers circulares por canal para eventos de telemetría
- Suscripción a canales en tiempo real
- Validación de eventos de stream

### ⚙️ **Management Context**
- Monitoreo del sistema y métricas
- Logs centralizados con múltiples niveles
- Estado de salud del servidor
- Estadísticas en tiempo real

## 🌐 API Endpoints por Contexto

### Communication API (`/api/communication/`)
```bash
GET  /connections              # Conexiones activas
GET  /rooms                   # Información de salas
GET  /rooms/:roomName         # Info de sala específica
GET  /users/:userId           # Info de usuario específico
GET  /stats                   # Estadísticas de comunicación
```

### Alerta Care API (`/api/alertacare/`)
```bash
GET  /streams/:habitacion/:posicion/:origen/:canal/events  # Eventos de canal
GET  /stats                                               # Estadísticas de Alerta Care
GET  /channels                                           # Lista de canales
GET  /channels/:channelKey/events                        # Eventos por channel key
POST /streams/:habitacion/:posicion/:origen/:canal/events # Crear evento (testing)
```

### Management API (`/api/management/`)
```bash
GET    /stats                    # Estadísticas del servidor
GET    /health                   # Estado de salud del sistema
GET    /system                   # Información del sistema
GET    /metrics                  # Métricas detalladas
GET    /logs?limit=100&level=info # Logs del sistema
DELETE /logs                     # Limpiar logs
POST   /stats/reset              # Reset estadísticas
GET    /diagnostics              # Diagnósticos completos
```

## 🔌 WebSocket Events por Contexto

### Communication Events
- `relay_message`, `private_message`, `broadcast_data`
- `join_room`, `leave_room`, `room_message`
- `get_connected_users`, `get_rooms_info`
- `update_metadata`, `ping`

### Alerta Care Events
- `stream_event` (con validación de canales)
- `subscribe_channel`, `unsubscribe_channel`
- `get_channel_events`

### Management Events
- `get_server_stats`, `get_health_status`, `get_system_info`
- `get_metrics`, `get_logs`, `clear_logs`, `reset_stats`
- `subscribe_metrics_updates`, `unsubscribe_metrics_updates`

## 📊 Buffers Circulares por Canal

Los eventos de Alerta Care se almacenan en buffers circulares en memoria según la combinación:

```
<habitacion>.<posicion>.<origen>.<canal>.tap
```

- **Canales soportados**: `inference.tap`, `tracker.tap`
- **Capacidad por defecto**: 1080 eventos por canal
- **Acceso**: Los eventos incluyen metadatos y timestamp automático

## 🚀 Instalación y Uso

```bash
# Instalar dependencias
npm install

# Desarrollo (con recarga automática)
npm run dev

# Compilar TypeScript
npm run build

# Ejecutar en producción
npm start
```

## 📁 Estructura del Proyecto

```
src/
├── main.ts                      # Orchestador principal
├── shared/                      # Componentes compartidos
│   └── circularBuffer.ts       # Buffer circular
├── core/                        # Lógica de negocio por contexto
│   ├── communication/           # Contexto de mensajería
│   ├── alertacare/             # Contexto de Alerta Care
│   └── management/             # Contexto de management
└── infrastructure/             # Infraestructura
    ├── websocket/              # Controladores WebSocket
    └── api/                    # Controladores API REST
```

## 🔗 URLs de Acceso Rápido

Una vez iniciado el servidor (puerto 3000 por defecto):

- **📊 Estadísticas**: http://localhost:3000/api/management/stats
- **🏥 Health Check**: http://localhost:3000/api/management/health
- **📈 Métricas**: http://localhost:3000/api/management/metrics
- **💬 Conexiones**: http://localhost:3000/api/communication/connections
- **🚨 Alerta Care**: http://localhost:3000/api/alertacare/stats

## 📚 Documentación

- [Arquitectura del Sistema](docs/arquitectura/)
- [Especificación Funcional](docs/funcional/)
- [Memorias de Desarrollo](docs/memorias/)

## 🛠️ Tecnologías

- **Runtime**: Node.js + TypeScript
- **WebSocket**: Socket.IO
- **API REST**: Express.js
- **Arquitectura**: DDD con separación por contextos
- **Logging**: Sistema propio con múltiples niveles

# 🏗️ Bounded Contexts y Puertos - AlertaCare Relay

## 🎯 **CORE CONTEXTS** (Valor de Negocio)

### **1. Real-time Communication Context**
**Responsabilidad**: Comunicación universal en tiempo real
**Conceptos del Dominio**:
- `Connection` - Conexión de cliente
- `Room` - Sala de comunicación
- `Message` - Mensaje entre usuarios
- `Broadcast` - Difusión masiva
- `PrivateMessage` - Mensaje directo

**Operaciones Core**:
```javascript
// Operaciones de negocio puras
CommunicationService.connectUser(userId, metadata)
CommunicationService.joinRoom(userId, roomName)
CommunicationService.sendMessage(from, to, message)
CommunicationService.broadcastToRoom(roomName, message)
CommunicationService.disconnectUser(userId)
```

**Puerto Principal**: WebSocket
**Puerto Secundario**: REST (solo consultas)

---

### **2. AlertaCare Monitoring Context**
**Responsabilidad**: Monitoreo médico especializado
**Conceptos del Dominio**:
- `ChannelKey` - Identificador semántico habitación.posición.origen.canal
- `Event` - Evento de monitoreo médico
- `CircularBuffer` - Buffer temporal para análisis
- `Stream` - Flujo continuo de eventos
- `Metadata` - Trazabilidad completa

**Operaciones Core**:
```javascript
// Operaciones de negocio médico
AlertaCareService.storeEvent(channelKey, event)
AlertaCareService.getEventStream(channelKey, options)
AlertaCareService.analyzePattern(channelKey, timeWindow)
AlertaCareService.detectAnomalies(channelKey)
```

**Puerto Principal**: WebSocket (tiempo real)
**Puerto Secundario**: REST (management + consultas)

---

## 🔧 **SUPPORT CONTEXTS** (Infraestructura)

### **3. System Management Context**
**Responsabilidad**: Administración y observabilidad
**Conceptos del Dominio**:
- `SystemStats` - Métricas del sistema
- `HealthCheck` - Estado de salud
- `Configuration` - Configuración dinámica
- `AuditLog` - Registro de auditoría

**Operaciones Core**:
```javascript
// Operaciones de sistema
SystemService.getStats()
SystemService.healthCheck()
SystemService.updateConfiguration(key, value)
SystemService.getAuditLog(timeRange)
```

**Puerto Principal**: REST API
**Puerto Secundario**: N/A

---

### **4. Infrastructure Context**
**Responsabilidad**: Servicios técnicos de soporte
**Conceptos del Dominio**:
- `BufferStorage` - Almacenamiento circular
- `ConnectionManager` - Gestión de conexiones
- `EventBus` - Bus de eventos interno
- `Serializer` - Serialización de datos

**Operaciones Core**:
```javascript
// Operaciones de infraestructura
BufferService.createBuffer(key, size)
ConnectionService.trackConnection(socketId)
EventBusService.publish(topic, event)
SerializerService.serialize(object)
```

**Puerto Principal**: Interno (no expuesto)
**Puerto Secundario**: N/A

---

## 🔌 **DEFINICIÓN DE PUERTOS**

### **Puerto WebSocket (Tiempo Real)**
```javascript
interface RealtimePort {
    // Communication Context
    onJoinRoom(userId: string, room: string): void
    onLeaveRoom(userId: string, room: string): void
    onSendMessage(from: string, to: string, message: any): void
    onBroadcast(from: string, data: any): void
    
    // AlertaCare Context  
    onStoreEvent(meta: ChannelMeta, event: any): void
    onGetEvents(meta: ChannelMeta, options: QueryOptions): void
    onSubscribeToChannel(meta: ChannelMeta): void
}
```

### **Puerto REST (Management)**
```javascript
interface ManagementPort {
    // AlertaCare Management
    GET /streams/:habitacion/:posicion/:origen/:canal/events
    POST /streams/:habitacion/:posicion/:origen/:canal/events
    DELETE /streams/:habitacion/:posicion/:origen/:canal/events
    GET /streams/channels
    
    // System Management
    GET /stats
    GET /health
    GET /config
    PUT /config/:key
}
```

---

## 📊 **MATRIZ DE RESPONSABILIDADES**

| Context | Puerto Principal | Puerto Secundario | Estado |
|---------|------------------|-------------------|---------|
| **Communication** | WebSocket | REST (readonly) | ✅ Maduro |
| **AlertaCare** | WebSocket | REST (full) | ✅ Maduro |
| **System Mgmt** | REST | - | 🔄 En desarrollo |
| **Infrastructure** | Interno | - | ✅ Base sólida |

---

## 🎯 **PRINCIPIOS ARQUITECTÓNICOS**

1. **Separación de Puertos**: Diferentes protocolos para diferentes necesidades
2. **Autonomía de Contextos**: Cada contexto puede evolucionar independientemente  
3. **Comunicación Asíncrona**: Eventos entre contextos vía EventBus
4. **Inmutabilidad de Interfaces**: Los puertos son contratos estables
5. **Observabilidad**: System Management observa todos los contextos

---

## 🚀 **EVOLUCIÓN PROPUESTA**

### **Fase 1: Formalizar Contextos**
- ✅ AlertaCare Context (completo)
- 🔄 Communication Context (extraer del monolito)
- 🔄 System Management Context (centralizar)
- 🔄 Infrastructure Context (abstraer)

### **Fase 2: Hexagonal Ports**
- 🔄 WebSocket Port (formalizar interfaces)
- 🔄 REST Port (estandarizar)
- 🔄 EventBus interno (comunicación entre contextos)

### **Fase 3: Advanced Patterns**
- 🔄 CQRS para AlertaCare (separar lecturas/escrituras)
- 🔄 Event Sourcing para auditabilidad
- 🔄 Circuit Breakers entre contextos 
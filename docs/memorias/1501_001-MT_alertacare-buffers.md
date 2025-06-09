# Memoria Técnica - AlertaCare Buffers Circulares por Canal

**Fecha**: 15 de Enero 2024  
**ID**: 1501_001-MT_alertacare-buffers  
**Versión**: 1.0  
**Estado**: IMPLEMENTADO  

## ⚠️ NOTA DE SINCRONIZACIÓN
**Esta memoria técnica está sincronizada con el código actual en server.js.**

**Refleja las decisiones técnicas para la implementación del sistema de buffers circulares AlertaCare con convención de naming extendida.**

---

## 1. Introducción

### 1.1 Propósito del Documento
Este documento describe las decisiones técnicas tomadas para implementar el sistema de **buffers circulares por canal** en el relay AlertaCare, incluyendo la convención de naming extendida, arquitectura de almacenamiento y APIs de acceso.

### 1.2 Contexto del Proyecto
**AlertaCare** es un sistema de asistencia inteligente para residencias geriátricas donde múltiples microservicios monitoran y asisten a residentes en tiempo real. El relay actúa como agente centralizador que **recibe, bufferiza y expone eventos** JSON sin procesarlos.

### 1.3 Alcance de esta Implementación
- Sistema de buffers circulares en memoria
- Convención de naming por canal extendido
- API REST para almacenamiento y consulta
- Integración Socket.IO para tiempo real
- Metadata completa de trazabilidad

### 1.4 Principios de Diseño
- **Separación de responsabilidades**: El relay solo bufferiza, los expertos procesan
- **Escalabilidad**: Soporte para múltiples cámaras, posiciones y streams
- **Trazabilidad**: Metadata completa para auditoría y debugging
- **Flexibilidad**: Permite expertos rápidos, criteriosos o paralelos

---

## 2. Contexto Técnico y Problemática

### 2.1 Problemática AlertaCare
En un entorno de residencia geriátrica:
- **Múltiples cámaras** por habitación (diferentes posiciones físicas)
- **Múltiples streams** por cámara (principal, secundario)
- **Múltiples canales** de información (inference, tracker, alerts)
- **Expertos especializados** que necesitan subconjuntos específicos de datos
- **Requisitos de auditoría** y análisis forense

### 2.2 Restricciones Técnicas
- **Sin persistencia**: Todo en memoria para máxima velocidad
- **Sin procesamiento**: El relay no interpreta ni modifica eventos
- **Trazabilidad completa**: Cada evento debe identificar su origen exacto
- **Escalabilidad inmediata**: Cientos de canales simultáneos
- **Latencia ultra-baja**: < 10ms para almacenamiento/consulta

### 2.3 Convención de Naming Requerida
```
<habitacion>.<posicion>.<origen>.<canal>.tap
```

**Ejemplos reales:**
- `habitacion12.base_larga.principal.inference.tap`
- `habitacion13.lateral_izq.secundario.tracker.tap`
- `habitacion12.base_corta.principal.alerts.tap`

---

## 3. Decisiones Técnicas Críticas

### 3.1 Arquitectura de Buffer Circular

#### 3.1.1 Decisión: Implementación Custom vs Librerías
**Decisión Tomada**: Implementación custom de CircularBuffer

**Razones**:
- **Control total** sobre comportamiento de overflow
- **Metadata integrada** en cada evento almacenado
- **Orden cronológico garantizado** sin complejidad externa
- **Zero dependencies** para funcionalidad crítica
- **Debugging simplificado** con índices de buffer

**Alternativas Evaluadas**:
- **circular-buffer npm**: Descartado por falta de metadata integrada
- **ringbufferjs**: Descartado por overhead de serialización
- **Array nativo + shift()**: Descartado por performance O(n)

#### 3.1.2 Estructura del Buffer Implementada
```javascript
class CircularBuffer {
    constructor(size) {
        this.size = size;           // Tamaño fijo: 1080 eventos
        this.buffer = new Array(size);
        this.index = 0;             // Índice de escritura
        this.filled = false;        // Flag de buffer lleno
        this.count = 0;             // Contador total de eventos
    }
}
```

**Características técnicas**:
- **Fixed size**: 1080 eventos por canal (30 fps * 36 segundos)
- **O(1) insertion**: Escritura directa por índice
- **O(n) retrieval**: Lectura completa ordenada cronológicamente
- **Auto-cleanup**: Sobrescritura automática de eventos antiguos

### 3.2 Sistema de Gestión de Canales

#### 3.2.1 Decisión: Map vs Object para Storage
**Decisión Tomada**: Map nativo de JavaScript

**Razones**:
- **Keys no string**: Evita conflictos con propiedades Object
- **Performance superior**: Optimizado para add/delete frecuente
- **Iteration order**: Garantiza orden de inserción
- **Size property**: O(1) para conteo de canales

**Estructura implementada**:
```javascript
const buffersPorCanal = new Map(); // canalKey -> CircularBuffer
```

#### 3.2.2 Algoritmo de Generación de Keys
```javascript
function canalKey({ habitacion, posicion, origen, canal }) {
    if (!habitacion || !posicion || !origen || !canal) {
        throw new Error('Missing required fields');
    }
    return `${habitacion}.${posicion}.${origen}.${canal}.tap`;
}
```

**Validaciones implementadas**:
- **Required fields**: Los 4 campos son obligatorios
- **No empty strings**: Evita keys malformadas
- **Consistent format**: Garantiza unicidad de canales

### 3.3 API Design Decisions

#### 3.3.1 REST Endpoints Strategy
**Decisión Tomada**: RESTful design con path parameters

**Estructura elegida**:
```
GET/POST/DELETE /streams/:habitacion/:posicion/:origen/:canal/events
```

**Razones**:
- **Semantic URLs**: Autodocumentadas y legibles
- **Parameter validation**: Express valida automáticamente
- **Cacheable**: Compatible con proxies HTTP
- **Standard HTTP methods**: GET/POST/DELETE según semántica

**Alternativas descartadas**:
- **Query parameters**: Menos legible, más propenso a errores
- **Single endpoint + body**: Pierde semántica REST
- **GraphQL**: Overhead innecesario para operaciones simples

#### 3.3.2 Response Format Standardization
```javascript
// Success response format
{
    "success": true,
    "channel": "habitacion12.base_larga.principal.inference.tap",
    "eventCount": 450,
    "eventos": [...]
}

// Error response format  
{
    "success": false,
    "error": "Missing required fields: habitacion, posicion, origen, canal"
}
```

### 3.4 Metadata and Traceability

#### 3.4.1 Event Enrichment Strategy
**Decisión Tomada**: Automatic metadata injection

**Campos agregados automáticamente**:
```javascript
{
    ...evento_original,
    _meta: { habitacion, posicion, origen, canal },
    _timestamp: "2024-01-15T10:30:00.000Z",
    _channel: "habitacion12.base_larga.principal.inference.tap",
    _buffered_at: "2024-01-15T10:30:00.001Z",
    _buffer_index: 1205
}
```

**Razones**:
- **Trazabilidad completa**: Identificación exacta del origen
- **Auditoría forense**: Timestamps precisos de almacenamiento
- **Debugging**: Índices de buffer para replay
- **No intrusivo**: El evento original se preserva intacto

---

## 4. Consideraciones de Performance

### 4.1 Optimizaciones Implementadas

#### 4.1.1 Memory Management
- **Fixed buffer size**: Evita garbage collection frecuente
- **Object reuse**: Los slots del array se reutilizan
- **No deep cloning**: Referencias directas cuando es seguro
- **Lazy initialization**: Buffers se crean solo cuando se necesitan

#### 4.1.2 Access Patterns Optimizados
- **O(1) storage**: Inserción directa por índice
- **O(1) channel lookup**: Map lookup por clave
- **Efficient retrieval**: Slice operations optimizadas
- **Latest events**: Método específico para consultas frecuentes

### 4.2 Métricas de Performance Esperadas

| Operación | Complejidad | Latencia Esperada |
|-----------|------------|-------------------|
| Store event | O(1) | < 1ms |
| Get all events | O(n) | < 10ms |
| Get latest N | O(n) | < 5ms |
| Channel lookup | O(1) | < 0.1ms |
| Create channel | O(1) | < 1ms |

### 4.3 Memory Footprint Estimation

**Por canal (1080 eventos)**:
- Buffer array: ~1080 * 500 bytes = 540KB
- Metadata overhead: ~1080 * 200 bytes = 216KB
- **Total per channel**: ~756KB

**Sistema completo (100 canales)**:
- Total memory: ~75.6MB
- Overhead: ~10MB (Maps, strings, etc.)
- **Total system**: ~85MB

---

## 5. Integración con Sistema Existente

### 5.1 Backward Compatibility
**Mantenida completamente**: Toda la funcionalidad Socket.IO original permanece intacta

**APIs preservadas**:
- `relay_message` / `relayed_message`
- `private_message` / `message_delivered`
- `join_room` / `leave_room` / `room_message`
- `get_connected_users` / `get_rooms_info`

### 5.2 Socket.IO Extensions
**Nuevos eventos agregados**:
```javascript
// Storage
socket.emit('store_event', { meta, evento });
socket.on('event_stored', { success, channel, timestamp });

// Retrieval  
socket.emit('get_events', { meta, options });
socket.on('events_response', { success, channel, eventos });

// Discovery
socket.emit('get_channels_info');
socket.on('channels_info', { totalChannels, channels });
```

### 5.3 Enhanced Stats and Health
**Endpoints expandidos**:
- `/stats`: Incluye métricas de canales y eventos
- `/health`: Incluye estado de buffers AlertaCare
- `/streams/channels`: Nuevo endpoint de discovery

---

## 6. Error Handling y Resilience

### 6.1 Failure Modes Identificados

#### 6.1.1 Memory Exhaustion
**Síntoma**: Demasiados canales activos
**Mitigación**: Monitoring de memoria + alertas
**Recovery**: Restart graceful con limpieza de buffers

#### 6.1.2 Malformed Requests
**Síntoma**: Campos faltantes en metadata
**Mitigación**: Validación estricta en canalKey()
**Recovery**: Error response inmediato con detalles

#### 6.1.3 Buffer Overflow
**Síntoma**: Eventos muy frecuentes
**Mitigación**: Circular buffer design automático
**Recovery**: No hay pérdida de servicio, solo datos antiguos

### 6.2 Monitoring y Observability

**Métricas críticas**:
- Número de canales activos
- Eventos por segundo por canal
- Memoria utilizada por buffers
- Latencia de operaciones

**Logs estructurados**:
```javascript
console.log(`📦 Created new buffer for channel: ${key}`);
console.log(`✅ Event stored in channel: ${key}`);
console.error(`❌ Error storing event:`, error.message);
```

---

## 7. Consideraciones de Seguridad

### 7.1 Threat Model
**Entorno**: Red interna de residencia geriátrica
**Usuarios**: Sistemas internos de confianza
**Datos**: Eventos de sensores, no PII directo

### 7.2 Security Measures
- **No authentication**: Apropiado para red interna controlada
- **Input validation**: Validación de estructura de metadata
- **No data persistence**: Reduce superficie de ataque
- **Rate limiting**: A implementar si se detecta abuso

### 7.3 Privacy Considerations
- **No PII storage**: Solo eventos de sensores técnicos
- **Temporary storage**: Datos se pierden en restart
- **Access control**: A nivel de red/firewall

---

## 8. Testing Strategy

### 8.1 Unit Tests Requeridos
- **CircularBuffer class**: Overflow, ordering, retrieval
- **Channel key generation**: Validation, uniqueness
- **Event storage**: Metadata injection, error handling
- **API endpoints**: Response formats, error cases

### 8.2 Integration Tests
- **Socket.IO + REST**: Consistencia entre APIs
- **Multiple channels**: Isolation, no cross-talk
- **High load**: Performance bajo estrés

### 8.3 Load Testing Scenarios
- **1000 channels simultáneos**: Memory y performance
- **10k events/second**: Throughput y latency
- **Buffer overflow**: Comportamiento en saturación

---

## 9. Deployment y Operations

### 9.1 Configuration
```bash
PORT=3000                    # Puerto del servidor
DEFAULT_BUFFER_SIZE=1080     # Eventos por canal
NODE_ENV=production          # Optimizaciones runtime
```

### 9.2 Resource Requirements
- **RAM**: 512MB base + 1MB por cada 10 canales
- **CPU**: 1 core, uso < 30% en operación normal
- **Network**: 1Gbps recomendado para alta carga
- **Storage**: No persistente, solo binario de aplicación

### 9.3 Monitoring Dashboard
**Métricas clave a monitorear**:
- Active channels count
- Events per second
- Memory usage
- Buffer utilization per channel
- API response times

---

## 10. Evolución y Roadmap

### 10.1 Phase 2 Enhancements
- **Redis backend**: Para persistencia y clustering
- **Event filtering**: Filtros por confianza, tipo, etc.
- **Batch operations**: Bulk insert/retrieve
- **Compression**: Para canales de alta frecuencia

### 10.2 Phase 3 Scale-out
- **Multi-instance**: Load balancing con Redis
- **Stream processing**: Integration con Kafka/Pulsar
- **ML pipeline**: Integration con modelos en tiempo real

### 10.3 Backwards Compatibility Promise
**Garantías**:
- API REST mantendrá formato actual
- Socket.IO events no cambiarán
- Channel naming convention es final
- Migration path para nuevas versiones

---

## 11. Conclusiones

### 11.1 Objetivos Alcanzados
✅ **Sistema de buffers circulares** funcional y eficiente  
✅ **Convención de naming** escalable y clara  
✅ **APIs REST y Socket.IO** completas y documentadas  
✅ **Trazabilidad total** con metadata automática  
✅ **Performance óptima** para casos de uso AlertaCare  

### 11.2 Technical Debt Identificado
- **No persistence**: Limitación para auditoría a largo plazo
- **Single instance**: Bottleneck para escala extrema
- **No authentication**: Seguridad básica para redes abiertas

### 11.3 Lessons Learned
- **Custom implementation**: Más control que librerías genéricas
- **Metadata enrichment**: Crítico para debugging y auditoría
- **REST + Socket.IO**: Combinación perfecta para flexibility
- **Circular buffers**: Ideal para streaming data patterns

---

**Memoria Técnica AlertaCare v1.0** - Sistema de bufferización inteligente implementado 🏥✨

**Revisado por**: Equipo AlertaCare  
**Aprobado por**: Arquitecto Principal  
**Próxima revisión**: 30 días post-implementación 
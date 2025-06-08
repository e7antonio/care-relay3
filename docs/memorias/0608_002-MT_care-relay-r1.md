# Memoria Técnica - care-relay-r1

## 1. Introducción

### 1.1 Propósito del Documento
Este documento describe las decisiones técnicas tomadas para el desarrollo del sistema de relay en tiempo real **care-relay-r1**, incluyendo las alternativas evaluadas y las razones de su selección o descarte.

### 1.2 Alcance
- Decisiones de arquitectura técnica
- Selección de tecnologías
- Patrones de diseño implementados
- Alternativas evaluadas y descartadas
- Consideraciones de performance y escalabilidad

### 1.3 Definiciones
- **Relay**: Sistema intermediario que retransmite mensajes entre múltiples clientes
- **WebSocket**: Protocolo de comunicación bidireccional en tiempo real
- **Room**: Agrupación lógica de usuarios para comunicación segmentada

## 2. Contexto Técnico

### 2.1 Problemática
Se requiere un sistema de comunicación en tiempo real que permita:
- Relay de mensajes entre múltiples clientes
- Comunicación privada punto a punto
- Agrupación de usuarios en salas temáticas
- Escalabilidad horizontal
- Baja latencia en la comunicación

### 2.2 Restricciones Técnicas
- Debe soportar múltiples conexiones concurrentes (>1000)
- Latencia menor a 100ms para mensajes locales
- Compatibilidad con navegadores modernos
- Facilidad de despliegue y mantenimiento

## 3. Decisiones Técnicas

### 3.1 Selección de Tecnologías

#### 3.1.1 Runtime: Node.js
**Decisión Tomada**: Node.js v14+

**Razones**:
- Event loop no bloqueante ideal para I/O intensivo
- Ecosistema maduro para WebSockets
- Single-threaded simplifica la gestión de estado
- NPM ecosystem robusto

**Alternativas Evaluadas**:
- **Python + asyncio**: Descartado por menor performance en conexiones concurrentes
- **Go**: Descartado por complejidad de desarrollo vs beneficio
- **Java + Spring WebSocket**: Descartado por overhead de JVM y complejidad

#### 3.1.2 WebSocket Library: Socket.IO
**Decisión Tomada**: Socket.IO v4.7.5

**Razones**:
- Fallback automático a polling si WebSocket falla
- Room management nativo
- Middleware system robusto
- Broadcasting eficiente
- Cliente JavaScript robusto

**Alternativas Evaluadas**:
- **ws (WebSocket nativo)**: Descartado por falta de features avanzadas
- **uws**: Descartado por complejidad de configuración
- **Primus**: Descartado por menor adopción y documentación

#### 3.1.3 Web Framework: Express.js
**Decisión Tomada**: Express.js v4.18.2

**Razones**:
- Integración nativa con Socket.IO
- Middleware ecosystem maduro
- Simplicidad para endpoints REST
- Amplia documentación y comunidad

**Alternativas Evaluadas**:
- **Fastify**: Descartado por posibles incompatibilidades con Socket.IO
- **Koa**: Descartado por overhead de async/await innecesario
- **HTTP nativo**: Descartado por complejidad de implementación

### 3.2 Patrones de Arquitectura

#### 3.2.1 Event-Driven Architecture
**Implementación**: Sistema basado en eventos Socket.IO

**Razones**:
- Desacoplamiento entre emisores y receptores
- Escalabilidad natural
- Facilita testing unitario
- Extensibilidad futura

#### 3.2.2 In-Memory State Management
**Implementación**: Map/Set nativas de JavaScript

**Razones**:
- Baja latencia de acceso
- Simplicidad de implementación
- Suficiente para MVP y pruebas de concepto

**Alternativas Evaluadas**:
- **Redis**: Reservado para escalabilidad futura
- **MongoDB**: Innecesario para datos temporales
- **PostgreSQL**: Overhead excesivo para datos volátiles

### 3.3 Decisiones de Diseño

#### 3.3.1 Gestión de Conexiones
**Patrón**: Connection Registry + Room Mapping

```javascript
const connections = new Map(); // socketId -> connectionInfo
const rooms = new Map();       // roomName -> Set<socketId>
```

**Razones**:
- O(1) lookup para operaciones frecuentes
- Limpieza automática en desconexión
- Estructura simple para debugging

#### 3.3.2 Message Routing
**Patrón**: Event-based routing con middleware

**Implementación**:
- Middleware de logging automático
- Validación de payloads
- Error handling centralizado

#### 3.3.3 Error Handling
**Estrategia**: Graceful degradation + Circuit breaker pattern

**Implementación**:
- Try-catch en todos los handlers
- Error events específicos al cliente
- Logging estructurado de errores

## 4. Consideraciones de Performance

### 4.1 Optimizaciones Implementadas
- **Connection pooling**: Reutilización de conexiones TCP
- **Event batching**: Agrupación de eventos de baja prioridad
- **Memory cleanup**: Limpieza automática de referencias
- **Efficient broadcasting**: Uso de Socket.IO rooms nativas

### 4.2 Métricas de Performance Esperadas
- **Throughput**: 10,000 mensajes/segundo
- **Latencia**: < 50ms local, < 200ms WAN
- **Memoria**: ~1KB per conexión activa
- **CPU**: < 70% con 1000 conexiones concurrentes

### 4.3 Limitaciones Identificadas
- **Single-threaded**: CPU-bound operations bloquean event loop
- **Memory-only state**: Pérdida de estado en restart
- **No persistence**: Mensajes no se almacenan

## 5. Escalabilidad y Evolución

### 5.1 Arquitectura Actual (Fase 1)
```
Client <-> Load Balancer <-> Single Node.js Instance <-> In-Memory State
```

### 5.2 Evolución Planificada (Fase 2)
```
Client <-> Load Balancer <-> Multiple Node.js Instances <-> Redis Cluster
```

### 5.3 Consideraciones para Escalabilidad Horizontal
- **Sticky sessions**: Requeridas sin Redis
- **State synchronization**: Redis pub/sub entre instancias
- **Load balancing**: Round-robin con health checks

## 6. Security Considerations

### 6.1 Medidas Implementadas
- **CORS configuration**: Origen específico en producción
- **Rate limiting**: Por implementar en middleware
- **Input validation**: Validación básica de payloads

### 6.2 Vulnerabilidades Identificadas
- **No authentication**: Cualquier cliente puede conectarse
- **No authorization**: Sin control de permisos por sala
- **Message flooding**: Sin rate limiting implementado
- **Memory exhaustion**: Posible DoS con muchas salas

### 6.3 Mitigaciones Futuras
- OAuth 2.0 / JWT authentication
- Role-based access control (RBAC)
- Rate limiting por IP/usuario
- Message size limits
- Connection limits por origen

## 7. Testing Strategy

### 7.1 Niveles de Testing
- **Unit tests**: Funciones puras y utilities
- **Integration tests**: Socket.IO event handlers
- **E2E tests**: Flujo completo cliente-servidor
- **Load tests**: Performance bajo carga

### 7.2 Herramientas Recomendadas
- **Jest**: Unit testing framework
- **Supertest**: HTTP endpoint testing
- **Socket.IO-client**: Integration testing
- **Artillery**: Load testing

## 8. Deployment y DevOps

### 8.1 Containerización
**Decisión**: Docker + Node.js Alpine

**Dockerfile optimizado**:
- Multi-stage build
- Non-root user
- Health checks integrados
- Environment-based configuration

### 8.2 Observabilidad
**Logging**: Structured logging con Winston
**Metrics**: Prometheus + Grafana (futuro)
**Tracing**: OpenTelemetry (futuro)
**Health checks**: /health y /stats endpoints

### 8.3 CI/CD Pipeline
- **Linting**: ESLint + Prettier
- **Testing**: Jest + coverage reports
- **Security**: npm audit + Snyk
- **Deployment**: Docker + Kubernetes/Docker Compose

## 9. Conclusiones y Próximos Pasos

### 9.1 Decisiones Clave Validadas
- Socket.IO como WebSocket library principal
- In-memory state para MVP es suficiente
- Express.js como framework base apropiado
- Event-driven architecture escalable

### 9.2 Deuda Técnica Identificada
- Falta de persistencia de mensajes
- Sin autenticación/autorización
- Rate limiting no implementado
- Métricas de observabilidad básicas

### 9.3 Roadmap Técnico
**Fase 2** (Q2):
- Redis integration para state distribuido
- Authentication layer (JWT)
- Rate limiting middleware
- Comprehensive testing suite

**Fase 3** (Q3):
- Message persistence (PostgreSQL)
- Advanced monitoring (Prometheus)
- Multi-region deployment
- API versioning

### 9.4 Riesgos Técnicos
- **Single point of failure**: Instancia única actual
- **Memory leaks**: Gestión manual de conexiones
- **Performance degradation**: Sin circuit breakers
- **Security gaps**: Sin authentication implementada

---

**Documento creado**: ${new Date().toISOString()}
**Versión**: 1.0
**Autor**: Equipo de Desarrollo
**Próxima revisión**: +30 días
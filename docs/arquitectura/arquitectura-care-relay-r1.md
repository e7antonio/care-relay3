# Documento de Arquitectura - care-relay-r1

## 1. Visión General de la Arquitectura

### 1.1 Propósito
Este documento define la arquitectura del sistema **care-relay-r1**, un relay de comunicación en tiempo real basado en WebSockets que facilita la comunicación entre múltiples clientes conectados.

### 1.2 Objetivos Arquitectónicos
- **Alta disponibilidad**: 99.9% uptime
- **Baja latencia**: < 100ms para comunicación local
- **Escalabilidad**: Soporte para 10K+ conexiones concurrentes
- **Extensibilidad**: Arquitectura modular para futuras funcionalidades
- **Mantenibilidad**: Código limpio y bien documentado

## 2. Arquitectura de Alto Nivel

### 2.1 Diagrama de Arquitectura General

```mermaid
graph TB
    subgraph "Cliente"
        WC[Web Client]
        MC[Mobile Client]
        DC[Desktop Client]
    end
    
    subgraph "Load Balancer Layer"
        LB[Load Balancer/Proxy]
    end
    
    subgraph "Application Layer"
        subgraph "Node.js Instance"
            WS[WebSocket Server<br/>Socket.IO]
            API[REST API<br/>Express.js]
            EM[Event Manager]
            CM[Connection Manager]
        end
    end
    
    subgraph "Data Layer"
        MS[Memory Store<br/>Maps/Sets]
        RC[Redis Cache<br/>Future]
        DB[(Database<br/>Future)]
    end
    
    subgraph "Monitoring"
        LOG[Logging<br/>Winston]
        MET[Metrics<br/>Prometheus]
        HLT[Health Checks]
    end
    
    WC --> LB
    MC --> LB
    DC --> LB
    
    LB --> WS
    LB --> API
    
    WS --> EM
    API --> EM
    EM --> CM
    CM --> MS
    
    WS --> LOG
    API --> LOG
    EM --> MET
    CM --> HLT
    
    MS -.-> RC
    RC -.-> DB
    
    classDef client fill:#e1f5fe
    classDef server fill:#f3e5f5
    classDef data fill:#e8f5e8
    classDef monitor fill:#fff3e0
    
    class WC,MC,DC client
    class LB,WS,API,EM,CM server
    class MS,RC,DB data
    class LOG,MET,HLT monitor
```

### 2.2 Patrones Arquitectónicos Aplicados

#### 2.2.1 Event-Driven Architecture (EDA)
- **Desacoplamiento**: Componentes se comunican via eventos
- **Escalabilidad**: Fácil adición de nuevos event handlers
- **Resilencia**: Fallos aislados no afectan todo el sistema

#### 2.2.2 Layered Architecture
- **Presentation Layer**: Cliente WebSocket/HTTP
- **Application Layer**: Lógica de negocio y routing
- **Data Layer**: Gestión de estado y persistencia

#### 2.2.3 Pub/Sub Pattern
- **Publishers**: Clientes que envían mensajes
- **Subscribers**: Clientes que reciben mensajes
- **Broker**: Servidor relay que distribuye mensajes

## 3. Componentes Arquitectónicos Detallados

### 3.1 WebSocket Server (Socket.IO)

```mermaid
classDiagram
    class SocketIOServer {
        +io: Server
        +connections: Map
        +rooms: Map
        +middleware: Array
        
        +onConnection(socket)
        +onDisconnection(socket)
        +registerHandlers(socket)
        +broadcastMessage(data)
        +emitToRoom(room, data)
    }
    
    class SocketHandler {
        +handleRelayMessage(data)
        +handlePrivateMessage(data)
        +handleRoomMessage(data)
        +handleJoinRoom(room)
        +handleLeaveRoom(room)
    }
    
    class ConnectionManager {
        +connections: Map~string, ConnectionInfo~
        +rooms: Map~string, Set~
        
        +addConnection(socketId, info)
        +removeConnection(socketId)
        +getConnection(socketId)
        +getUsersInRoom(room)
        +cleanup()
    }
    
    class ConnectionInfo {
        +id: string
        +rooms: Set~string~
        +metadata: Object
        +connectedAt: Date
    }
    
    SocketIOServer --> SocketHandler
    SocketIOServer --> ConnectionManager
    ConnectionManager --> ConnectionInfo
```

### 3.2 REST API Layer

```mermaid
classDiagram
    class ExpressServer {
        +app: Express
        +routes: Router[]
        
        +setupMiddleware()
        +setupRoutes()
        +setupErrorHandling()
        +start(port)
    }
    
    class StatsController {
        +getStats()
        +getHealth()
        +getConnections()
        +getRooms()
    }
    
    class Middleware {
        +cors()
        +rateLimit()
        +logging()
        +errorHandler()
    }
    
    ExpressServer --> StatsController
    ExpressServer --> Middleware
```

### 3.3 Event Management System

```mermaid
stateDiagram-v2
    [*] --> Connected
    Connected --> Authenticated: auth_event
    Connected --> Disconnected: disconnect
    
    Authenticated --> JoinedRoom: join_room
    Authenticated --> SendMessage: relay_message
    Authenticated --> SendPrivate: private_message
    
    JoinedRoom --> InRoom: success
    JoinedRoom --> Authenticated: error
    
    InRoom --> RoomMessage: room_message
    InRoom --> LeaveRoom: leave_room
    InRoom --> Disconnected: disconnect
    
    RoomMessage --> InRoom: success
    LeaveRoom --> Authenticated: success
    
    SendMessage --> Authenticated: completed
    SendPrivate --> Authenticated: completed
    
    Authenticated --> Disconnected: disconnect
    Disconnected --> [*]
```

## 4. Flujo de Datos y Comunicación

### 4.1 Flujo de Mensajes Generales

```mermaid
sequenceDiagram
    participant C1 as Client 1
    participant S as Server
    participant C2 as Client 2
    participant C3 as Client 3
    
    C1->>S: emit('relay_message', data)
    S->>S: validate & process
    S->>C2: emit('relayed_message', {from: C1, data})
    S->>C3: emit('relayed_message', {from: C1, data})
    Note over S: Broadcast to all except sender
```

### 4.2 Flujo de Mensajes Privados

```mermaid
sequenceDiagram
    participant C1 as Client 1
    participant S as Server
    participant C2 as Client 2
    
    C1->>S: emit('private_message', {targetId, message})
    S->>S: validate target exists
    alt Target exists
        S->>C2: emit('private_message', {from: C1, message})
        S->>C1: emit('message_delivered', {targetId})
    else Target not found
        S->>C1: emit('message_error', {error})
    end
```

### 4.3 Flujo de Gestión de Salas

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant R as Room Members
    
    C->>S: emit('join_room', roomName)
    S->>S: add client to room
    S->>S: update room registry
    S->>R: emit('user_joined_room', {userId, room})
    S->>C: emit('joined_room', {room, size})
    
    Note over C, R: Client can now send room messages
    
    C->>S: emit('room_message', {room, message})
    S->>R: emit('room_message', {from: C, room, message})
    
    C->>S: emit('leave_room', roomName)
    S->>S: remove client from room
    S->>R: emit('user_left_room', {userId, room})
```

## 5. Modelo de Datos

### 5.1 Estructura de Datos en Memoria

```mermaid
erDiagram
    CONNECTION {
        string id PK
        Set rooms
        Object metadata
        Date connectedAt
    }
    
    ROOM {
        string name PK
        Set users
        Date createdAt
        Object settings
    }
    
    MESSAGE {
        string id PK
        string from
        string to
        string room
        Object payload
        Date timestamp
        string type
    }
    
    CONNECTION ||--o{ ROOM : "joins"
    CONNECTION ||--o{ MESSAGE : "sends"
    ROOM ||--o{ MESSAGE : "contains"
```

### 5.2 Eventos del Sistema

```mermaid
classDiagram
    class BaseEvent {
        +id: string
        +timestamp: Date
        +type: string
        +source: string
    }
    
    class ConnectionEvent {
        +socketId: string
        +address: string
        +userAgent: string
    }
    
    class MessageEvent {
        +from: string
        +to: string
        +payload: Object
        +messageType: string
    }
    
    class RoomEvent {
        +room: string
        +userId: string
        +action: string
    }
    
    BaseEvent <|-- ConnectionEvent
    BaseEvent <|-- MessageEvent
    BaseEvent <|-- RoomEvent
```

## 6. Seguridad y Autenticación

### 6.1 Modelo de Seguridad Actual (MVP)

```mermaid
graph LR
    subgraph "Current State"
        C[Client] --> |No Auth| S[Server]
        S --> |CORS Check| V[Validation]
        V --> |Basic| P[Processing]
    end
    
    subgraph "Future State"
        C2[Client] --> |JWT Token| A[Auth Middleware]
        A --> |Validated| S2[Server]
        S2 --> |RBAC| V2[Authorization]
        V2 --> |Secure| P2[Processing]
    end
```

### 6.2 Consideraciones de Seguridad

#### 6.2.1 Vulnerabilidades Actuales
- Sin autenticación de usuarios
- Sin autorización por salas
- Sin rate limiting
- Sin validación exhaustiva de payloads

#### 6.2.2 Mitigaciones Planificadas
- JWT authentication
- Role-based access control
- Rate limiting por usuario/IP
- Input sanitization
- Message encryption (TLS)

## 7. Performance y Escalabilidad

### 7.1 Métricas de Performance

```mermaid
graph LR
    subgraph "Performance Metrics"
        LAT[Latency<br/>< 100ms]
        THR[Throughput<br/>10K msg/s]
        CON[Connections<br/>10K concurrent]
        MEM[Memory<br/>1KB per conn]
        CPU[CPU Usage<br/>< 70%]
    end
    
    subgraph "Monitoring"
        LAT --> PROM[Prometheus]
        THR --> PROM
        CON --> PROM
        MEM --> PROM
        CPU --> PROM
        PROM --> GRAF[Grafana]
    end
```

### 7.2 Estrategia de Escalabilidad

#### 7.2.1 Escalabilidad Vertical (Fase 1)
- Incremento de CPU/RAM en instancia única
- Optimización de algoritmos
- Memory pooling
- Connection pooling

#### 7.2.2 Escalabilidad Horizontal (Fase 2)

```mermaid
graph TB
    subgraph "Horizontal Scaling"
        LB[Load Balancer]
        
        subgraph "App Cluster"
            N1[Node 1]
            N2[Node 2]
            N3[Node 3]
        end
        
        subgraph "State Layer"
            R[Redis Cluster]
            direction TB
            R1[Redis 1]
            R2[Redis 2]
            R3[Redis 3]
        end
        
        LB --> N1
        LB --> N2
        LB --> N3
        
        N1 --> R1
        N2 --> R2
        N3 --> R3
        
        R1 -.-> R2
        R2 -.-> R3
        R3 -.-> R1
    end
```

## 8. Deployment Architecture

### 8.1 Containerización

```mermaid
graph TB
    subgraph "Container Architecture"
        subgraph "App Container"
            APP[Node.js App]
            PM2[PM2 Process Manager]
        end
        
        subgraph "Reverse Proxy"
            NGINX[Nginx]
        end
        
        subgraph "Monitoring"
            PROM[Prometheus]
            GRAF[Grafana]
        end
        
        subgraph "Storage"
            VOL[Docker Volumes]
        end
    end
    
    NGINX --> APP
    APP --> VOL
    PROM --> APP
    GRAF --> PROM
```

### 8.2 CI/CD Pipeline

```mermaid
graph LR
    subgraph "Development"
        DEV[Developer]
        GIT[Git Repository]
    end
    
    subgraph "CI Pipeline"
        LINT[Linting]
        TEST[Testing]
        SEC[Security Scan]
        BUILD[Build Image]
    end
    
    subgraph "CD Pipeline"
        STAGE[Staging Deploy]
        PROD[Production Deploy]
    end
    
    DEV --> GIT
    GIT --> LINT
    LINT --> TEST
    TEST --> SEC
    SEC --> BUILD
    BUILD --> STAGE
    STAGE --> PROD
```

## 9. Monitoreo y Observabilidad

### 9.1 Logging Strategy

```mermaid
graph TB
    subgraph "Application Logs"
        APP[Application] --> WINSTON[Winston Logger]
        WINSTON --> CONSOLE[Console Output]
        WINSTON --> FILE[Log Files]
    end
    
    subgraph "Log Aggregation"
        CONSOLE --> DOCKER[Docker Logs]
        FILE --> FLUENTD[Fluentd]
        DOCKER --> ELK[ELK Stack]
        FLUENTD --> ELK
    end
    
    subgraph "Analysis"
        ELK --> KIBANA[Kibana Dashboard]
        ELK --> ALERTS[Alert Manager]
    end
```

### 9.2 Health Checks

```mermaid
graph LR
    subgraph "Health Monitoring"
        HC[Health Check Endpoint]
        STATS[Stats Endpoint]
        PING[WebSocket Ping/Pong]
    end
    
    subgraph "External Monitoring"
        UPT[Uptime Robot]
        PROM[Prometheus]
        K8S[Kubernetes Probes]
    end
    
    HC --> UPT
    STATS --> PROM
    PING --> K8S
```

## 10. Consideraciones Futuras

### 10.1 Roadmap Arquitectónico

#### Fase 1 (Actual) - MVP
- ✅ WebSocket relay básico
- ✅ Gestión de salas
- ✅ Mensajes privados
- ✅ API REST básica

#### Fase 2 - Escalabilidad
- 🔄 Redis para estado distribuido
- 🔄 Load balancing
- 🔄 Authentication/Authorization
- 🔄 Rate limiting

#### Fase 3 - Enterprise
- ⏳ Message persistence
- ⏳ Multi-region deployment
- ⏳ Advanced monitoring
- ⏳ API versioning

### 10.2 Evolución de la Arquitectura

```mermaid
graph TB
    subgraph "Current Architecture"
        C1[Single Node]
        M1[In-Memory State]
    end
    
    subgraph "Phase 2 Architecture"
        C2[Multi-Node Cluster]
        R[Redis Cluster]
        LB2[Load Balancer]
    end
    
    subgraph "Phase 3 Architecture"
        MR[Multi-Region]
        DB[Persistent Storage]
        CDN[CDN/Edge]
        API[API Gateway]
    end
    
    C1 --> |Scale| C2
    C2 --> |Global| MR
    M1 --> |Distribute| R
    R --> |Persist| DB
```

---

**Versión**: 1.0  
**Fecha**: ${new Date().toISOString()}  
**Estado**: En desarrollo  
**Próxima revisión**: +30 días
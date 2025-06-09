# AlertaCare Relay Server

Sistema de relay inteligente para AlertaCare - Asistencia en residencias geriátricas.

## 🏥 Descripción

El **AlertaCare Relay** es el agente centralizador que **recibe, bufferiza y expone eventos** (en JSON) generados por los distintos módulos de percepción y tracking. Funciona como infraestructura base para el sistema de monitoreo en tiempo real en residencias geriátricas.

### Características principales:
- **Buffers circulares por canal** con convención de naming extendida
- **REST API** para consulta y almacenamiento de eventos
- **Socket.IO** para comunicación en tiempo real
- **Sin persistencia** - Todo en memoria, volátil
- **Sin procesamiento** - Solo bufferiza y expone eventos

---

## 🏗️ Arquitectura - Buffers Circulares por Canal Extendido

### Convención de Naming

Cada canal sigue la convención AlertaCare:

```
<habitacion>.<posicion>.<origen>.<canal>.tap
```

**Campos:**
- **habitacion:** Identificador lógico (ej: `habitacion12`)
- **posicion:** `base_larga`, `base_corta`, `lateral_der`, `lateral_izq`, etc.
- **origen:** `principal`, `secundario`, etc. (stream físico/lógico)
- **canal:** `inference`, `tracker`, `alerts`, etc.
- **tap:** Sufijo fijo que indica buffer/debug

**Ejemplos:**
```
habitacion12.base_larga.principal.inference.tap
habitacion12.base_larga.secundario.tracker.tap
habitacion13.lateral_izq.secundario.inference.tap
```

### Ventajas del Sistema

✅ **Escalabilidad:** Soporta cualquier cantidad de cámaras, posiciones y streams  
✅ **Flexibilidad:** Permite expertos rápidos, criteriosos o paralelos  
✅ **Debugging:** Facilita análisis forense, replay y merge/fan-in  
✅ **Separación de responsabilidades:** El relay solo bufferiza, los expertos procesan  
✅ **Sin deuda técnica:** Naming convention preparada para el futuro  

---

## 🔧 Instalación y Uso

### Instalación
```bash
npm install express socket.io
```

### Iniciar servidor
```bash
node server.js
```

### Configuración
- **Puerto:** `PORT` env var (default: 3000)
- **Buffer size:** `DEFAULT_BUFFER_SIZE = 1080` eventos por canal

---

## 📡 API REST - AlertaCare Endpoints

### 1. Obtener eventos de canal específico
```http
GET /streams/:habitacion/:posicion/:origen/:canal/events[?latest=N]
```

**Parámetros:**
- `habitacion`: ID de habitación
- `posicion`: Posición de cámara
- `origen`: Stream origen 
- `canal`: Tipo de canal
- `latest` (opcional): Número de eventos más recientes

**Ejemplo:**
```bash
curl http://localhost:3000/streams/habitacion12/base_larga/principal/inference/events?latest=10
```

**Respuesta:**
```json
{
  "success": true,
  "channel": "habitacion12.base_larga.principal.inference.tap",
  "eventCount": 10,
  "eventos": [...]
}
```

### 2. Almacenar evento en canal
```http
POST /streams/:habitacion/:posicion/:origen/:canal/events
Content-Type: application/json

{
  "tipo": "deteccion_persona",
  "confianza": 0.95,
  "coordenadas": [100, 200, 150, 300]
}
```

**Respuesta:**
```json
{
  "success": true,
  "channel": "habitacion12.base_larga.principal.inference.tap",
  "message": "Event stored successfully"
}
```

### 3. Listar todos los canales disponibles
```http
GET /streams/channels
```

**Respuesta:**
```json
{
  "success": true,
  "totalChannels": 3,
  "channels": [
    {
      "channel": "habitacion12.base_larga.principal.inference.tap",
      "habitacion": "habitacion12",
      "posicion": "base_larga", 
      "origen": "principal",
      "canal": "inference",
      "eventCount": 450,
      "totalStored": 1205
    }
  ]
}
```

### 4. Limpiar buffer de canal
```http
DELETE /streams/:habitacion/:posicion/:origen/:canal/events
```

### 5. Estadísticas del sistema
```http
GET /stats
```

### 6. Health check
```http
GET /health
```

---

## 🔌 Socket.IO API - AlertaCare Events

### Almacenar evento
```javascript
socket.emit('store_event', {
    meta: {
        habitacion: 'habitacion12',
        posicion: 'base_larga', 
        origen: 'principal',
        canal: 'inference'
    },
    evento: {
        tipo: 'deteccion_caida',
        confianza: 0.87,
        timestamp: new Date().toISOString()
    }
});

socket.on('event_stored', (response) => {
    console.log('Event stored:', response.channel);
});
```

### Obtener eventos
```javascript
socket.emit('get_events', {
    meta: {
        habitacion: 'habitacion12',
        posicion: 'base_larga',
        origen: 'principal', 
        canal: 'inference'
    },
    options: { latest: 20 }
});

socket.on('events_response', (response) => {
    console.log(`Received ${response.eventCount} events`);
    console.log(response.eventos);
});
```

### Obtener información de canales
```javascript
socket.emit('get_channels_info');

socket.on('channels_info', (response) => {
    console.log(`Total channels: ${response.totalChannels}`);
    response.channels.forEach(channel => {
        console.log(`${channel.channel}: ${channel.eventCount} events`);
    });
});
```

---

## 💡 Ejemplos de Uso

### Caso 1: Sistema de inferencia almacenando detecciones
```bash
# Almacenar detección de persona
curl -X POST http://localhost:3000/streams/habitacion12/base_larga/principal/inference/events \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "deteccion_persona",
    "confianza": 0.95,
    "bbox": [100, 200, 150, 300],
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

### Caso 2: Sistema de tracking consultando eventos
```bash
# Obtener últimos 50 eventos de tracking
curl http://localhost:3000/streams/habitacion12/base_larga/principal/tracker/events?latest=50
```

### Caso 3: Dashboard consultando todos los canales
```bash
# Ver todos los canales activos
curl http://localhost:3000/streams/channels
```

---

## 🏛️ Arquitectura del Sistema

### Flujo de Datos
```
[Cámara] → [Módulo Inferencia] → [Relay Buffer] → [Expertos/Dashboard]
         ↘ [Módulo Tracking]  ↗              ↘ [Sistema Alertas]
```

### Responsabilidades

**Relay (este servidor):**
- ✅ Recibir eventos JSON
- ✅ Bufferizar en canales circulares 
- ✅ Exponer vía REST y Socket.IO
- ❌ NO procesa ni filtra eventos
- ❌ NO fusiona ni interpreta datos

**Expertos (consumidores):**
- ✅ Suscribirse a canales específicos
- ✅ Mergear y componer según necesidades
- ✅ Implementar lógica de negocio
- ✅ Generar alertas y acciones

### Buffer Circular

Cada canal mantiene un buffer circular de **1080 eventos** por defecto:
- Sobrescribe eventos más antiguos cuando se llena
- Mantiene orden cronológico
- Incluye metadata de trazabilidad completa
- Permite consultas eficientes

---

## 🔧 Configuración Avanzada

### Variables de Entorno
```bash
PORT=3000                    # Puerto del servidor
DEFAULT_BUFFER_SIZE=1080     # Tamaño de buffer por canal
```

### Logs
El servidor registra automáticamente:
- Conexiones y desconexiones
- Creación de nuevos buffers
- Almacenamiento de eventos
- Errores y excepciones

---

## 🚨 Consideraciones Importantes

### Memoria
- **Todo es volátil** - Los eventos se pierden al reiniciar
- Cada canal puede almacenar hasta `DEFAULT_BUFFER_SIZE` eventos
- Monitor de memoria recomendado para sistemas en producción

### Seguridad
- **Sin autenticación** - Pensado para red interna
- **Sin validación avanzada** - Los expertos validan según contexto
- **Sin rate limiting** - Configurar proxy/firewall si es necesario

### Escalabilidad
- Un buffer por combinación única de 5 campos
- Búsquedas O(1) por canal
- Consultas cronológicas eficientes
- Preparado para cientos de canales simultáneos

---

## 🤝 Casos de Uso AlertaCare

### Monitoreo Multi-Cámara
```javascript
// Diferentes streams de la misma habitación
guardarEvento({
    habitacion: 'habitacion12',
    posicion: 'base_larga', 
    origen: 'principal',
    canal: 'inference'
}, eventoDeteccion);

guardarEvento({
    habitacion: 'habitacion12',
    posicion: 'lateral_der',
    origen: 'secundario', 
    canal: 'tracker'
}, eventoMovimiento);
```

### Expertos Especializados
```javascript
// Experto rápido - solo eventos de alta confianza
const eventosRapidos = obtenerEventos({
    habitacion: 'habitacion12',
    posicion: 'base_larga',
    origen: 'principal',
    canal: 'alerts'
});

// Experto criterioso - analiza histórico completo
const eventosCompletos = obtenerEventos({
    habitacion: 'habitacion12', 
    posicion: 'base_larga',
    origen: 'principal',
    canal: 'inference'
});
```

---

## 📋 API Compatibility

### Socket.IO (Legacy)
El servidor mantiene compatibilidad con la API Socket.IO original:
- `relay_message` - Relay general
- `private_message` - Mensajes directos
- `room_message` - Mensajes por sala
- `join_room` / `leave_room` - Gestión de salas

### REST (Original)
- `GET /stats` - Estadísticas (expandidas con info AlertaCare)
- `GET /health` - Health check (expandido con métricas de buffers)

---

**AlertaCare Relay v1.0** - Sistema de bufferización inteligente para residencias geriátricas 🏥✨ 
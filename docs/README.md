# Documentación Care Relay

Este directorio contiene toda la documentación del proyecto Care Relay, organizada por categorías.

## 📋 Índice de Documentación

### 🏗️ Arquitectura del Sistema

- **[Arquitectura R2 (Actual)](arquitectura/arquitectura-care-relay-r2.md)** - Documentación de la arquitectura refactorizada por contextos
- **[Arquitectura R1 (Legacy)](arquitectura/arquitectura-care-relay-r1.md)** - Documentación de la arquitectura original

### 📚 Especificación Funcional

- **[Funcional R2 (Actual)](funcional/funcional-care-relay-r2.md)** - Especificación funcional de la versión refactorizada
- **[Funcional R1 (Legacy)](funcional/funcional-care-relay-r1.md)** - Especificación funcional de la versión original

### 📝 Memorias de Desarrollo

- **[Refactorización por Contextos](memorias/0608_004.refactor_contextos.md)** - Memoria de la refactorización R1 → R2
- **[Refactorización DDD](memorias/0608_003.refactor_ddd.md)** - Análisis previo de Domain-Driven Design
- **[Memoria Técnica R1](memorias/0608_002-MT_care-relay-r1.md)** - Memoria técnica de la versión original
- **[Memoria Inicial](memorias/0608_001.md)** - Memoria inicial del proyecto

## 🎯 Versiones del Sistema

### Versión R2 (Actual) ✅
**Estado**: Implementada y Operacional  
**Características**:
- Arquitectura por contextos (Communication, AlertaCare, Management)
- Controladores separados para WebSocket y API REST
- Sistema de logging contextualizado
- Métricas y monitoreo avanzados
- API REST organizada por dominio

### Versión R1 (Legacy)
**Estado**: Deprecada  
**Características**:
- Arquitectura monolítica en un solo archivo
- Funcionalidad básica de relay
- Buffers circulares para AlertaCare
- API REST básica

## 📖 Guía de Lectura

### Para Nuevos Desarrolladores
1. **Inicio**: Leer [README principal](../README.md)
2. **Arquitectura**: Revisar [Arquitectura R2](arquitectura/arquitectura-care-relay-r2.md)
3. **Funcionalidad**: Estudiar [Funcional R2](funcional/funcional-care-relay-r2.md)
4. **Contexto**: Leer [Memoria de Refactorización](memorias/0608_004.refactor_contextos.md)

### Para Arquitectos de Software
1. **Diseño**: [Arquitectura R2](arquitectura/arquitectura-care-relay-r2.md)
2. **Evolución**: [Memoria de Refactorización](memorias/0608_004.refactor_contextos.md)
3. **Decisiones**: [Refactorización DDD](memorias/0608_003.refactor_ddd.md)

### Para Product Owners
1. **Funcionalidades**: [Funcional R2](funcional/funcional-care-relay-r2.md)
2. **Capacidades**: [README principal](../README.md)
3. **Evolución**: [Memoria de Refactorización](memorias/0608_004.refactor_contextos.md)

## 🔄 Actualización de Documentación

Esta documentación se mantiene sincronizada con el código implementado. Última actualización: **Diciembre 2024**

### Política de Actualización
- **Cambios de arquitectura**: Actualizar documentación de arquitectura
- **Nuevas funcionalidades**: Actualizar documentación funcional
- **Refactorizaciones**: Crear nueva memoria de desarrollo

### Versionado
- **R1**: Versión original monolítica
- **R2**: Versión refactorizada por contextos
- **R3+**: Futuras versiones (planeadas)

## 📞 Contacto

Para dudas sobre la documentación o sugerencias de mejora, consultar con el equipo de desarrollo. 
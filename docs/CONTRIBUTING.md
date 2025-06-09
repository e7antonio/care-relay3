# Política de Contribución — care-relay-r1

## Sincronización Código ↔ Documentación

- **La documentación debe reflejar siempre el estado real del código.**
- No se mergea ningún feature, cambio de API, ni fix, sin la correspondiente actualización en los documentos relevantes (README, docs funcionales, arquitectura, memoria técnica).
- La sección “Features No Implementadas / Fuera de Alcance” debe actualizarse en cada release.
- Si una feature es removida, debe eliminarse de la documentación.
- Los diagramas y ejemplos deben coincidir siempre con la implementación.
- Cualquier promesa de roadmap debe ir al final, en sección separada.

## Proceso para cada PR

1. Revisar qué se agrega, elimina o modifica en el código.
2. Actualizar la documentación correspondiente.
3. Incluir en el PR una breve descripción de los cambios de documentación.
4. Los reviewers deben verificar que la doc esté alineada con el código antes de aprobar el merge.

**No hay excepciones:**  
La documentación es la fuente de verdad del producto.

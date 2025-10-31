# Notas del Proyecto - Sistema de Gestión de Lavadoras

## Estado Actual del Proyecto
Última actualización: 2025-01-27 (Después de implementar modal detallado en Operadores)

## Cambios Recientes Implementados

### 1. Permisos de Usuario Actualizados
- **Eliminados permisos obsoletos:**
  - `verAuditoria` - eliminado de la interfaz `Permisos`
  - `verIndicadoresAuditoria` - eliminado de la interfaz `Permisos`
  - Estos permisos ya no aparecen en el formulario de gestión de usuarios

- **Permisos de Inventario ajustados:**
  - **Operador:**
    - `verInventario: true` - Puede ver el inventario
    - `gestionarInventario: false` - NO puede crear/eliminar lavadoras ni marcarlas fuera de servicio
    - ✅ SÍ puede crear y finalizar mantenimientos (controlado por `esOperador()` en el código)
  - **Manager:**
    - `verInventario: true`
    - `gestionarInventario: true` - Puede crear/eliminar lavadoras y marcarlas fuera de servicio
  - **Admin:**
    - Todos los permisos en `true` (acceso total)

### 2. Restricciones de UI en Inventario
- Botón "Crear 15 Lavadoras" - Solo visible si `tienePermiso('gestionarInventario')`
- Botón "Registrar Lavadora" - Solo visible si `tienePermiso('gestionarInventario')`
- Botón "Marcar como fuera de servicio" - Solo visible si `!esOperador()`
- Botón "Marcar como disponible" (desde fuera_servicio) - Solo visible si `!esOperador()`
- Botones de mantenimiento - Visibles para todos (operadores pueden crear y finalizar)

### 3. Gestión de Permisos en Configuración
- **Operador:** Los permisos pueden ser editados por administradores
- **Manager:** Los permisos pueden ser editados por administradores
- **Admin:** Los permisos NO pueden ser editados (acceso total automático)
- Al seleccionar un rol, se cargan los permisos por defecto correspondientes
- Si se edita un usuario existente y se mantiene su rol, se conservan los permisos personalizados

### 4. Nueva Página "Operadores" (Versión Mejorada)
- ✅ **Reporte de Arqueo por Usuario** movido desde "Reportes" a nueva página dedicada "Operadores"
- ✅ **Vista inicial con cards/tags de operadores:**
  - Muestra resumen financiero rápido: Ingresos, Gastos, Saldo
  - Contador de acciones: pagos, gastos, mantenimientos
  - Click en card abre modal detallado
- ✅ **Modal detallado con filtros avanzados:**
  - **Filtros rápidos:** Hoy (por defecto), Ayer, Esta Semana, Este Mes
  - **Filtros de fecha personalizados:** Fecha Inicio y Fecha Fin
  - **Selector de tipo de acción:**
    - Todos (muestra todas las actividades agrupadas por tipo)
    - Pedidos Creados
    - Pedidos Entregados
    - Pedidos Recogidos
    - Modificaciones
    - Pagos Recibidos
    - Gastos Registrados
    - Mantenimientos Registrados
- ✅ **Resumen financiero destacado:**
  - Cards visuales con: Ingresos, Gastos (gastos + mantenimientos), Saldo Final
  - Se actualiza dinámicamente según filtros aplicados
  - Muestra conteo de acciones en cada categoría
- ✅ **Detalles completos por tipo de acción:**
  - **Pedidos (creados/entregados/recogidos):** Cliente, teléfono, plan, total, fecha/hora
  - **Modificaciones:** Desglose completo de horas extras, cobros adicionales, descuentos, cambio de plan, total
  - **Pagos:** Cliente, teléfono, plan, monto, medio de pago, referencia, fecha/hora
  - **Gastos:** Concepto, descripción, monto, medio de pago, fecha/hora
  - **Mantenimientos:** Tipo de falla, descripción, costo, medio de pago, fechas inicio/fin
- ✅ **Funcionalidades técnicas:**
  - Carga automática de nombres de usuarios desde IDs (`createdBy`)
  - Filtrado combinado: operador + fecha + tipo de acción
  - Cálculo correcto de fechas normalizadas para comparaciones
  - Manejo correcto de fechas tipo Timestamp de Firebase
- ✅ Ruta: `/operadores`
- ✅ Opción agregada al menú principal (requiere permiso `verReportes`)
- ✅ El reporte de arqueo fue completamente removido de la página "Reportes"

### 5. Funcionalidades Implementadas Previamente

#### Registro de Usuarios en Acciones
- ✅ Nombres de usuarios registrados en:
  - Creación de pedidos (`createdBy`)
  - Entrega de servicios (`entregadoPor`)
  - Recogida de servicios (`recogidoPor`)
  - Registro de pagos (`registradoPor`)
  - Aplicación de modificaciones (`aplicadoPor`)
  - Registro de gastos (`registradoPor`)
  - Registro de mantenimientos (`registradoPor`)
  - Finalización de mantenimientos (`finalizadoPor`)

#### UI de Pedidos
- ✅ Lista de servicios como cards/tags (no tabla)
- ✅ Ordenados por fecha de creación (más recientes primero)
- ✅ Filtro por defecto: "Hoy"
- ✅ Cronología del pedido en modal de detalles (pasos numerados)
- ✅ Modificaciones mostradas como pasos numerados en la cronología
- ✅ Nombres de usuarios mostrados en todas las acciones relevantes

#### QR Codes
- ✅ Generación con error correction level 'H' (máxima tolerancia)
- ✅ Escaneo mejorado con 60 FPS y mayor área de detección
- ✅ Exportación cambiada de Word a PDF estático (`QR-Lavadoras pdf.pdf`)

#### Sincronización de Estados
- ✅ Función `sincronizarLavadorasHuerfanas` que corrige lavadoras marcadas como "alquilada" sin pedido activo asociado
- ✅ Se ejecuta automáticamente al cargar el inventario

## Archivos Clave Modificados

### Tipos y Interfaces
- `src/types/index.ts` - Interfaz `Permisos` actualizada (sin auditoría)

### Servicios
- `src/services/usuarioService.ts` - Permisos por defecto actualizados, sin auditoría

### Componentes
- `src/components/GestorUsuarios.tsx` - Formulario de permisos actualizado, operadores pueden editar permisos

### Páginas
- `src/pages/InventarioLavadoras.tsx` - Restricciones de UI basadas en permisos
- `src/pages/Pedidos.tsx` - UI de cards, cronología mejorada, nombres de usuarios
- `src/pages/Gastos.tsx` - Registro de usuario en gastos
- `src/pages/Pagos.tsx` - Registro de usuario en pagos
- `src/pages/Operadores.tsx` - **NUEVA:** Página completa con cards de operadores, modal detallado, filtros avanzados (fecha y tipo de acción), resumen financiero destacado y visualización detallada por tipo de acción
- `src/pages/Reportes.tsx` - Reporte de arqueo removido (movido a Operadores)
- `src/components/ModalHistorialMantenimiento.tsx` - Registro de usuarios en mantenimientos

### Layout y Routing
- `src/components/Layout.tsx` - Opción "Auditoría" oculta del menú (comentada), nueva opción "Operadores" agregada
- `src/App.tsx` - Nueva ruta `/operadores` agregada

## Notas Importantes

1. **Solo aplica a servicios nuevos:** El registro de nombres de usuarios solo se aplica a servicios creados después de la implementación. Servicios antiguos no tienen estos campos.

2. **Permisos de Operador:** 
   - Puede VER inventario ✅
   - Puede CREAR mantenimientos ✅
   - Puede FINALIZAR mantenimientos ✅
   - NO puede crear/eliminar lavadoras ❌
   - NO puede marcar fuera de servicio ❌

3. **Auditoría:** La opción está oculta del menú pero el código sigue existiendo por si se necesita en el futuro.

4. **Exportación QR:** Se cambió de generación dinámica en Word a descarga de PDF estático desde la carpeta `public`.

## Próximos Pasos Sugeridos (si aplica)
- [ ] Revisar si hay más permisos obsoletos que eliminar
- [ ] Considerar si se necesitan permisos más granulares para inventario (separar crear/eliminar de marcar fuera de servicio)
- [ ] Documentar flujo completo de permisos para nuevos desarrolladores
- [ ] Considerar agregar exportación de reporte de arqueo (Excel/PDF) en la página Operadores

## Deployment
- URL de producción: https://global-da5ac.web.app
- Firebase Console: https://console.firebase.google.com/project/global-da5ac/overview
- Último deploy: 2025-01-27 (Página Operadores con modal detallado y filtros avanzados)
- Último commit: b5393d3 - "feat: Implementar página Operadores con filtros avanzados y modal detallado"

---

*Este archivo se actualiza manualmente. Mantener actualizado después de cambios importantes.*


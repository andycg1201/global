# Notas de Progreso - Sistema de Lavadoras Global

## Fecha: 19 de Noviembre 2025

### Estado Actual del Sistema
- ✅ Sistema funcionando en producción
- ✅ URL: https://global-da5ac.web.app
- ✅ Último commit: 90ea1b8

---

## Cambios Realizados Hoy (19/11/2025)

### 1. Corrección del Filtro de Plan en Reportes
**Problema:** Al filtrar por un plan específico (ej: PLAN 1), aparecían otros planes en el análisis.

**Solución Implementada:**
- Modificado `calcularAnalisisPlanes` para recibir `planIdFiltro` como parámetro
- Cuando hay un filtro de plan activo, el análisis muestra SOLO ese plan
- Uso del plan actual desde la lista de planes (no del objeto `plan` del pedido que puede estar desactualizado)
- Filtro mejorado para verificar `planId`, `plan?.id` y el plan actual desde la lista

**Archivos Modificados:**
- `src/pages/Reportes.tsx`

**Cambios Clave:**
```typescript
// Ahora calcularAnalisisPlanes recibe el planIdFiltro
await calcularAnalisisPlanes(todosLosPedidos, filtros.planId);

// Si hay filtro activo, solo muestra ese plan
if (planIdFiltro && planIdFiltro !== 'todos' && planFiltrado) {
  analisisPlanesArray = analisisPlanesArray.filter(p => p.planId === planIdFiltro);
}
```

---

### 2. Corrección de la Tabla Cruzada en Reportes
**Problema:** La tabla cruzada no estaba estructurada correctamente (fechas en filas, planes en columnas).

**Solución Implementada:**
- Uso de `planId` en lugar de `plan.id` para mayor confiabilidad
- Búsqueda del plan actual desde la lista de planes disponibles
- Uso de `fechaAsignacion` en lugar de `createdAt` para la fecha del pedido
- Normalización correcta de fechas del pedido antes de comparar
- Exportación a Excel corregida con estructura correcta

**Archivos Modificados:**
- `src/pages/Reportes.tsx` (función `generarTablaCruzada` y `exportarTablaCruzada`)

**Estructura de la Tabla Cruzada:**
- **Filas:** Fechas por día (desde fechaInicio hasta fechaFin)
- **Columnas:** Planes (cada plan con 4 subcolumnas: Servicios, Valor Base, Extras, Total)
- **Columna TOTAL:** Al final con los totales del día

---

### 3. Corrección de Filtros de Fecha en Pedidos
**Problema:** A las 23:53 del 19 de noviembre, los filtros mostraban el 20 de noviembre.

**Solución Implementada:**
- Normalización correcta de fechas al inicializar los filtros
  - `fechaInicio`: 00:00:00
  - `fechaFin`: 23:59:59
- Corrección de `aplicarFiltroRapido` para normalizar todas las fechas
- Corrección de inputs de fecha manuales para usar zona horaria local (no UTC)
- Normalización de fecha del pedido antes de comparar en el filtro

**Archivos Modificados:**
- `src/pages/Pedidos.tsx`

**Cambios Clave:**
```typescript
// Inicialización correcta
fechaInicio: (() => {
  const hoy = getCurrentDateColombia();
  const fechaNormalizada = new Date(hoy);
  fechaNormalizada.setHours(0, 0, 0, 0);
  return fechaNormalizada;
})()

// Inputs de fecha manuales
const [year, month, day] = fechaValue.split('-').map(Number);
const fechaLocal = new Date(year, month - 1, day, 0, 0, 0, 0);
```

---

### 4. Actualización de planId en Modificaciones y Edición
**Problema:** Cuando se modificaba un plan, el `planId` no se actualizaba, causando problemas en los filtros.

**Solución Implementada:**
- En `ModalModificacionesServicio.tsx`: Actualizar `planId` cuando se cambia el plan
- En `EditarPedido.tsx`: Actualizar `planId` cuando se edita el plan

**Archivos Modificados:**
- `src/components/ModalModificacionesServicio.tsx`
- `src/components/EditarPedido.tsx`

---

## Problemas Resueltos Anteriormente (Resumen)

### 1. Reconciliación Financiera (Dashboard vs Libro Diario)
- ✅ Capital card refleja el capital disponible neto
- ✅ Saldos por Medio de Pago calculados correctamente
- ✅ Libro Diario muestra el medio de pago real (efectivo, Nequi, Daviplata)
- ✅ Exportación a Excel del Libro Diario implementada

### 2. Filtros en Operadores
- ✅ Filtro de "modificaciones" ahora funciona correctamente
- ✅ Carga de `modificacionesServicio` para cada pedido
- ✅ Normalización correcta de fechas en todos los filtros

### 3. Cálculo de Modificaciones
- ✅ `totalModificaciones` ahora incluye la diferencia del cambio de plan
- ✅ Actualización de `planId` cuando se cambia el plan

### 4. WhatsApp Editable
- ✅ Mensaje completo editable (no solo la hora)
- ✅ Plantilla cargada automáticamente pero editable

### 5. Filtro por Defecto en Pagos
- ✅ Por defecto muestra pagos del día actual

---

## Archivos Modificados en el Último Commit

1. `src/pages/Reportes.tsx` - Filtro de plan, tabla cruzada, exportación Excel
2. `src/pages/Pedidos.tsx` - Filtros de fecha corregidos
3. `src/components/ModalModificacionesServicio.tsx` - Actualización de planId
4. `src/components/EditarPedido.tsx` - Actualización de planId
5. `src/pages/Operadores.tsx` - Filtros de modificaciones

---

## Estado de Funcionalidades

### ✅ Funcionando Correctamente
- Dashboard con saldos correctos
- Libro Diario con medios de pago reales
- Exportación a Excel del Libro Diario
- Filtros en Operadores (incluyendo modificaciones)
- Filtro de plan en Reportes (muestra solo el plan seleccionado)
- Tabla cruzada con estructura correcta
- Exportación a Excel de tabla cruzada
- Filtros de fecha en Pedidos (zona horaria correcta)
- WhatsApp editable completo
- Filtro por defecto en Pagos (día actual)

### 🔍 Verificar en Próxima Sesión
- Confirmar que el filtro de plan en Reportes funciona correctamente en producción
- Verificar que la tabla cruzada exporta correctamente a Excel
- Confirmar que los filtros de fecha en Pedidos muestran el día correcto

---

## Notas Técnicas Importantes

### Manejo de Fechas
- **Siempre usar `getCurrentDateColombia()`** para obtener la fecha actual
- **Normalizar fechas** antes de comparar: `setHours(0, 0, 0, 0)` para inicio, `setHours(23, 59, 59, 999)` para fin
- **Inputs de fecha:** Crear fechas en zona horaria local usando `new Date(year, month - 1, day, hours, minutes, seconds)`
- **Firebase Timestamps:** Convertir correctamente con `.toDate()` antes de usar

### Manejo de Planes
- **Siempre usar `planId`** como fuente principal, con fallback a `plan?.id`
- **Buscar plan actual** desde la lista de planes disponibles (no usar `pedido.plan` que puede estar desactualizado)
- **Actualizar `planId`** cuando se modifica el plan en `ModalModificacionesServicio` y `EditarPedido`

### Estructura de Datos
- **Pedidos:** Tienen `planId` y `plan` (objeto completo)
- **Modificaciones:** Se cargan por separado usando `modificacionesService.obtenerModificacionesPorPedido()`
- **Fechas:** Usar `fechaAsignacion` para la fecha real del pedido, no `createdAt`

---

## Comandos Útiles

### Git
```bash
git status --short
git add -A
git commit -m "mensaje descriptivo"
git push
```

### Firebase
```bash
firebase projects:list
firebase use global-da5ac
npm run build
firebase deploy --only hosting
```

### Build y Verificación
```bash
npm run build
npm run dev  # Para desarrollo local
```

---

## Próximos Pasos Sugeridos

1. **Verificar en producción:**
   - Probar el filtro de plan en Reportes
   - Exportar tabla cruzada a Excel y verificar estructura
   - Verificar que los filtros de fecha en Pedidos muestran el día correcto

2. **Mejoras Futuras (si es necesario):**
   - Optimizar carga de modificaciones (actualmente se cargan una por una)
   - Considerar cacheo de planes para evitar múltiples consultas
   - Revisar logs de depuración y remover los que no sean necesarios

---

## Contacto y Referencias

- **Proyecto Firebase:** global-da5ac
- **URL Producción:** https://global-da5ac.web.app
- **Repositorio:** https://github.com/andycg1201/global.git

---

**Última actualización:** 19 de Noviembre 2025, 23:53 (hora Colombia)


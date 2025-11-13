# Notas del Proyecto - Sistema de Gestión de Lavadoras

## Estado Actual del Proyecto
Última actualización: 2025-01-28 (Validación y formateo mejorado de números telefónicos colombianos)

## Cambios Recientes Implementados

### 1. Importación de Contactos desde Dispositivo Móvil
- ✅ **Funcionalidad implementada:** Importar contactos del celular directamente al crear nuevo cliente
  - Botón "📱 Importar contacto" visible junto al campo de teléfono
  - Solo aparece al crear nuevo cliente (no al editar)
  - Solo se muestra si la API de contactos está disponible en el navegador
  - Abre el selector nativo de contactos del dispositivo
  - Auto-completa nombre y teléfono del contacto seleccionado
  - Formatea automáticamente el teléfono al formato colombiano (+57)

- ✅ **Manejo de múltiples números telefónicos:**
  - Si un contacto tiene múltiples números, automáticamente toma el primero
  - Se registra en consola cuántos números tiene el contacto
  - No requiere selección manual por parte del usuario

- ✅ **Compatibilidad:**
  - **Android:** Chrome/Edge actualizado ✅
  - **iOS:** Safari 16.4+ ✅
  - **Desktop:** Chrome/Edge ✅
  - **Brave browser:** Detectado y bloqueado (muestra mensaje específico) ⚠️
  - **Firefox:** No disponible (botón no se muestra)

- ✅ **Corrección de ubicación GPS opcional:**
  - **Problema resuelto:** Error "Los datos ingresados no son válidos" al guardar cliente sin ubicación GPS
  - **Causa:** Se enviaba `ubicacionGPS: undefined` a Firebase, causando error `invalid-argument`
  - **Solución:** El campo `ubicacionGPS` solo se incluye en el objeto si está definido y tiene coordenadas válidas
  - Si no hay ubicación GPS, el campo simplemente no se incluye (no se envía `undefined`)

- ✅ **Mensaje de ayuda para ubicación GPS:**
  - Agregado mensaje claro indicando que la ubicación GPS es opcional
  - Instrucciones de que debe hacer clic en "Mi Ubicación GPS" para guardarla
  - Indicador visual: "✓ Ubicación guardada" (verde) o "No se ha guardado ubicación" (gris)

- ✅ **Mejoras en validación y manejo de errores:**
  - Validación mejorada de nombre y teléfono antes de guardar
  - Limpieza automática de datos importados (espacios, caracteres especiales)
  - Manejo de errores con mensajes descriptivos específicos por tipo de error
  - Logging detallado en consola para diagnóstico

- ✅ **Implementación técnica:**
  - Declaraciones TypeScript agregadas en `src/vite-env.d.ts` para Contacts Picker API
  - Detección automática de disponibilidad de API
  - Múltiples métodos de acceso a ContactsManager para diferentes navegadores
  - Implementado en `src/components/ModalCliente.tsx`

- 📝 **Commit:** `944c36f` - "feat: Agregar importación de contactos desde celular y mejoras en modal cliente"
- 📝 **Archivos modificados:** 13 archivos (365 insertions, 294 deletions)

### 2. Validación y Formateo Mejorado de Números Telefónicos Colombianos
- ✅ **Conversión automática de prefijo 0057 a +57:**
  - Si un número viene como `00573205257502`, se convierte automáticamente a `+573205257502`
  - Remueve el `00` inicial si existe antes del `57`
  - Asegura que siempre tenga el prefijo `+57` correcto

- ✅ **Validación de celulares colombianos:**
  - Valida que los primeros 3 dígitos después de `+57` sean >= 300
  - Números válidos: empiezan con 300, 315, 320, 301, etc. (celulares colombianos)
  - Números no válidos: empiezan con 099, 050, etc. (menores a 300, posiblemente no celulares)

- ✅ **Mensaje de advertencia visual:**
  - Se muestra debajo del campo de teléfono cuando el número no es válido
  - Mensaje: "⚠️ **Advertencia:** Este número posiblemente no tenga WhatsApp."
  - Fondo amarillo claro con borde amarillo para destacar
  - Es solo una advertencia informativa: el usuario puede continuar guardando

- ✅ **Validación en múltiples momentos:**
  - Al importar contacto desde el celular
  - Al escribir/editar manualmente el teléfono (se valida al salir del campo - `onBlur`)
  - La advertencia se limpia automáticamente cuando el usuario empieza a escribir de nuevo

- ✅ **Implementación técnica:**
  - Nueva función `isValidColombianCellphone()` en `src/utils/dateUtils.ts`
  - Mejora en `formatColombianPhone()` para manejar prefijo `0057`
  - Estado `telefonoAdvertencia` en `ModalCliente.tsx` para mostrar mensaje visual
  - Validación integrada en proceso de importación y en evento `onBlur` del campo

- 📝 **Commit:** `3c4271f` - "feat: Mejorar validación y formateo de números telefónicos colombianos"
- 📝 **Archivos modificados:** 4 archivos (175 insertions, 36 deletions)

### 3. Mejoras de UI para Operadores y Corrección de Fechas
- ✅ **Ocultar saldos disponibles para operadores:**
  - El mensaje "💰 Saldos disponibles: Efectivo: $... | Nequi: ... | Daviplata: ..." ahora solo se muestra para administradores y managers
  - Los operadores no ven este mensaje de ayuda al agregar gastos o crear mantenimientos
  - Implementado en `src/pages/Gastos.tsx` y `src/components/ModalMantenimiento.tsx`
  - Condición: `!esOperador()` para mostrar el mensaje

- ✅ **Corrección de fechas en historial de saldos del Dashboard:**
  - **Problema resuelto:** Las horas de los gastos se actualizaban cada vez que se recargaba la página
  - **Causa:** El servicio buscaba `data.fecha` pero Firebase guarda los gastos como `data.date`
  - **Solución implementada:**
    - Cambio de `data.fecha` a `data.date` para leer correctamente la fecha de los gastos
    - Reemplazo de `new Date()` como fallback por `createdAt` (timestamp original del documento)
    - Esto evita que la hora se actualice y mantiene la hora original del registro
  - **Aplicado a:** Gastos y Mantenimientos en el historial de saldos
  - Implementado en `src/services/movimientosSaldosService.ts`

### 4. Permisos de Usuario Actualizados
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

### 5. Restricciones de UI en Inventario
- Botón "Crear 15 Lavadoras" - Solo visible si `tienePermiso('gestionarInventario')`
- Botón "Registrar Lavadora" - Solo visible si `tienePermiso('gestionarInventario')`
- Botón "Marcar como fuera de servicio" - Solo visible si `!esOperador()`
- Botón "Marcar como disponible" (desde fuera_servicio) - Solo visible si `!esOperador()`
- Botones de mantenimiento - Visibles para todos (operadores pueden crear y finalizar)

### 6. Gestión de Permisos en Configuración
- **Operador:** Los permisos pueden ser editados por administradores
- **Manager:** Los permisos pueden ser editados por administradores
- **Admin:** Los permisos NO pueden ser editados (acceso total automático)
- Al seleccionar un rol, se cargan los permisos por defecto correspondientes
- Si se edita un usuario existente y se mantiene su rol, se conservan los permisos personalizados

### 7. Nueva Página "Operadores" (Versión Mejorada)
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
- ✅ **Regla de Negocio: Arqueo solo en efectivo**
  - **IMPORTANTE:** Los pagos de clientes por Nequi o Daviplata van directo a la cuenta del administrador
  - **Para el arqueo del operador:** Se cuenta SOLO el efectivo en ingresos, gastos y mantenimientos
  - **Los pagos/detalles:** Se muestran TODOS (efectivo, nequi, daviplata) con su medio de pago para información
  - **Los resúmenes financieros:** Calculan solo efectivo para el balance final del operador
  - Aplica tanto en las cards iniciales como en el modal detallado
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
  - Filtrado de cálculos por `medioPago === 'efectivo'` en todos los resúmenes
- ✅ Ruta: `/operadores`
- ✅ Opción agregada al menú principal (requiere permiso `verReportes`)
- ✅ El reporte de arqueo fue completamente removido de la página "Reportes"

### 8. Restricciones de Medios de Pago
- ✅ **Operadores solo pueden registrar Gastos y Mantenimientos en efectivo**
  - En `Gastos`: Si el usuario es operador, el selector de medios de pago solo muestra "efectivo"
  - En `Inventario/Mantenimientos`: Si el usuario es operador, el selector de medios de pago solo muestra "efectivo"
  - **Administradores:** Tienen acceso a los 3 medios (efectivo, nequi, daviplata)
  - **No aplica a pagos de clientes:** Los clientes pueden pagar por cualquier medio de pago
- ✅ Implementado en:
  - `src/pages/Gastos.tsx` - Lógica de validación y filtrado de medios
  - `src/components/ModalMantenimiento.tsx` - Lógica de validación y filtrado de medios

### 9. Filtrado de Datos por Usuario para Operadores
- ✅ **Operadores solo ven SUS propios movimientos en Pagos y Gastos**
  - **Página Pagos:** Los operadores solo ven los pagos que ellos mismos registraron (`registradoPor === user.name`)
  - **Página Gastos:** Los operadores solo ven los gastos que ellos registraron (`registradoPor === user.name`)
  - **Mantenimientos en Gastos:** Los operadores solo ven los mantenimientos que ellos registraron (`registradoPor === user.name`)
- ✅ **Administradores y Managers:** Ven TODOS los movimientos (sin filtrado)
- ✅ **IMPORTANTE:** Este filtrado es SOLO VISUAL. NO afecta:
  - Cálculos de saldos
  - Registro de movimientos en BD
  - Funcionalidad de creación/edición
  - Otras partes del sistema
- ✅ Implementado en:
  - `src/pages/Pagos.tsx` - Filtrado visual de pagos por `user.name` si es operador
  - `src/pages/Gastos.tsx` - Filtrado visual de gastos y mantenimientos por `user.name` si es operador

### 10. Funcionalidades Implementadas Previamente

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
- `src/vite-env.d.ts` - Declaraciones TypeScript agregadas para Contacts Picker API (`ContactsManager`, `Contact`, extensiones de `Navigator` y `Window`)
- `src/utils/dateUtils.ts` - **ACTUALIZADO:** Nueva función `isValidColombianCellphone()` para validar celulares colombianos, mejora en `formatColombianPhone()` para convertir `0057...` a `+57...`

### Servicios
- `src/services/usuarioService.ts` - Permisos por defecto actualizados, sin auditoría
- `src/services/movimientosSaldosService.ts` - Corrección de lectura de fechas: usar `data.date` en lugar de `data.fecha`, usar `createdAt` como fallback en lugar de `new Date()` para evitar actualización de hora

### Componentes
- `src/components/GestorUsuarios.tsx` - Formulario de permisos actualizado, operadores pueden editar permisos
- `src/components/ModalMantenimiento.tsx` - Restricción de medios de pago para operadores, ocultar saldos para operadores
- `src/components/ModalCliente.tsx` - **ACTUALIZADO:** Importación de contactos desde celular, manejo de múltiples números telefónicos, corrección de ubicación GPS opcional, mensaje de ayuda para ubicación, mejoras en validación y manejo de errores, validación visual de números telefónicos colombianos

### Páginas
- `src/pages/InventarioLavadoras.tsx` - Restricciones de UI basadas en permisos
- `src/pages/Pedidos.tsx` - UI de cards, cronología mejorada, nombres de usuarios
- `src/pages/Gastos.tsx` - Registro de usuario en gastos, restricción de medios de pago para operadores, filtrado visual por usuario, ocultar saldos disponibles para operadores
- `src/pages/Pagos.tsx` - Registro de usuario en pagos, filtrado visual por usuario
- `src/pages/Operadores.tsx` - **NUEVA:** Página completa con cards de operadores, modal detallado, filtros avanzados (fecha y tipo de acción), resumen financiero destacado y visualización detallada por tipo de acción, **arqueo solo efectivo**
- `src/pages/Reportes.tsx` - Reporte de arqueo removido (movido a Operadores)
- `src/components/ModalHistorialMantenimiento.tsx` - Registro de usuarios en mantenimientos
- `src/components/ModalMantenimiento.tsx` - Restricción de medios de pago para operadores, ocultar saldos disponibles para operadores

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

5. **Importación de Contactos:**
   - Funciona en Chrome/Edge (Android y Desktop) y Safari 16.4+ (iOS)
   - Brave browser bloquea la API por privacidad (muestra mensaje específico)
   - Si un contacto tiene múltiples números, automáticamente se importa el primero
   - La ubicación GPS es completamente opcional y no causa errores si no se proporciona

6. **Validación de Números Telefónicos:**
   - Conversión automática: `0057...` se convierte a `+57...`
   - Validación: números celulares colombianos deben empezar con 300, 315, 320, etc. (>= 300)
   - Advertencia visual cuando el número no parece tener WhatsApp (primeros 3 dígitos < 300)
   - La advertencia es solo informativa, permite guardar de todas formas

## Próximos Pasos Sugeridos (si aplica)
- [ ] Revisar si hay más permisos obsoletos que eliminar
- [ ] Considerar si se necesitan permisos más granulares para inventario (separar crear/eliminar de marcar fuera de servicio)
- [ ] Documentar flujo completo de permisos para nuevos desarrolladores
- [ ] Considerar agregar exportación de reporte de arqueo (Excel/PDF) en la página Operadores

## Deployment
- URL de producción: https://global-da5ac.web.app
- Firebase Console: https://console.firebase.google.com/project/global-da5ac/overview
- Último deploy: 2025-01-28 (Validación y formateo mejorado de números telefónicos colombianos)
- Último commit: 3c4271f - "feat: Mejorar validación y formateo de números telefónicos colombianos"

## Flujo de Trabajo con Git

### Conceptos Básicos

**Git** es un sistema de control de versiones que permite:
- Guardar el historial de cambios
- Colaborar con otros desarrolladores
- Tener respaldo del código

### Comandos Principales

1. **`git add`** - Preparar cambios para guardar
   ```bash
   git add archivo.tsx          # Agregar un archivo específico
   git add -A                   # Agregar todos los archivos modificados
   ```

2. **`git commit`** - Guardar cambios localmente (solo en tu computadora)
   ```bash
   git commit -m "Descripción del cambio"
   ```
   - Los commits quedan guardados en tu máquina
   - Aún no son visibles para otros o en el servidor

3. **`git push`** - Subir commits al repositorio remoto (GitHub/GitLab)
   ```bash
   git push                     # Subir a la rama actual
   ```
   - Envía tus commits locales al servidor
   - Hace que tus cambios sean visibles para otros
   - Crea un backup en la nube
   - Es necesario para colaborar en equipo

4. **`git pull`** - Bajar cambios del servidor a tu computadora
   ```bash
   git pull                     # Descargar cambios remotos
   ```
   - Actualiza tu código local con cambios de otros
   - Útil antes de empezar a trabajar

5. **`git status`** - Ver el estado de tus archivos
   ```bash
   git status                   # Ver qué archivos están modificados
   ```

### Flujo de Trabajo Típico

```
1. Modificar archivos
   ↓
2. git add -A                    # Preparar cambios
   ↓
3. git commit -m "mensaje"        # Guardar localmente
   ↓
4. git push                       # Subir al servidor
   ↓
5. (Opcional) Firebase deploy     # Desplegar a producción
```

### Diferencia entre Commit y Push

- **Commit:** Guarda cambios en tu computadora (local)
  - Solo tú puedes verlos
  - No están respaldados en la nube aún
  
- **Push:** Sube los commits al servidor remoto
  - Todos pueden ver tus cambios
  - El código queda respaldado
  - Necesario para colaboración

### Analogía Simple

- **Commit** = Guardar documento en tu computadora
- **Push** = Subir documento a Google Drive/OneDrive
- **Pull** = Descargar documento del Drive

### Repositorio Remoto

- **URL:** https://github.com/andycg1201/global.git
- **Rama principal:** `main`
- **Commits recientes:** Se pueden ver en GitHub

---

*Este archivo se actualiza manualmente. Mantener actualizado después de cambios importantes.*


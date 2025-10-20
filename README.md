# Sistema de Lavadoras - Colombia

Sistema de gestión para empresa de alquiler de lavadoras en Colombia, desarrollado con React + TypeScript + Firebase.

## 🚀 Características

- **Gestión de Planes**: 5 planes de alquiler con lógica de horarios específicos
- **Gestión de Clientes**: Registro y búsqueda de clientes
- **Gestión de Pedidos**: Creación, seguimiento y actualización de pedidos
- **Sistema de Pagos**: Efectivo, Nequi, Daviplata con comprobantes
- **Gestión de Gastos**: Registro de gastos con conceptos configurables
- **Reportes**: Arque diario y análisis financiero
- **Dashboard**: Resumen ejecutivo del negocio
- **Configuración**: Parámetros del sistema (precios, horarios, etc.)
- **Autenticación**: Sistema de roles (Admin/Empleado)
- **Zona Horaria**: Configurada para Colombia (COT)
- **Moneda**: Pesos colombianos

## 📋 Planes de Alquiler

1. **PLAN 1**: 5 horas (7am-1pm) - $12,000
2. **PLAN 2**: 2pm hasta 7am siguiente día - $15,000
3. **PLAN 3**: 7am hasta 7am siguiente día - $24,000
4. **PLAN 4**: Sábado 7am hasta Lunes 7am - $30,000
5. **PLAN 5**: Sábado 2pm hasta Lunes 7am - $25,000

**Hora adicional**: $2,000

## 🛠️ Tecnologías

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Hosting)
- **Zona Horaria**: Colombia (COT)
- **Moneda**: Pesos colombianos (COP)

## 📦 Instalación

1. **Clonar el repositorio**:
   ```bash
   git clone <repository-url>
   cd lavadoras-app
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar Firebase**:
   - Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
   - Habilitar Authentication (Email/Password)
   - Crear base de datos Firestore
   - Copiar configuración a `src/lib/firebase.ts`

4. **Configurar Firebase**:
   ```typescript
   // src/lib/firebase.ts
   const firebaseConfig = {
     apiKey: "tu-api-key",
     authDomain: "tu-proyecto.firebaseapp.com",
     projectId: "tu-proyecto",
     storageBucket: "tu-proyecto.appspot.com",
     messagingSenderId: "123456789",
     appId: "tu-app-id"
   };
   ```

5. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

6. **Construir para producción**:
   ```bash
   npm run build
   ```

## 🔐 Usuarios Iniciales

### Administrador
- **Email**: admin@lavadoras.com
- **Contraseña**: admin123
- **Rol**: Administrador (acceso completo)

### Empleado
- **Email**: empleado@lavadoras.com
- **Contraseña**: empleado123
- **Rol**: Empleado (acceso limitado)

> **Nota**: Crear estos usuarios manualmente en Firebase Authentication

## 📊 Estructura de Datos

### Colecciones Firebase

- **planes**: Planes de alquiler
- **clientes**: Información de clientes
- **pedidos**: Pedidos de alquiler
- **gastos**: Gastos del negocio
- **conceptosGastos**: Conceptos de gastos
- **users**: Usuarios del sistema
- **configuracion**: Configuración del sistema

## 🚀 Despliegue

### Firebase Hosting

1. **Instalar Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Inicializar Firebase**:
   ```bash
   firebase init hosting
   ```

3. **Configurar**:
   - Public directory: `dist`
   - Single-page app: `Yes`
   - Overwrite index.html: `No`

4. **Desplegar**:
   ```bash
   npm run build
   firebase deploy
   ```

## 📱 Funcionalidades Principales

### Dashboard
- Resumen financiero del día
- Pedidos pendientes de recogida
- Estadísticas de pedidos
- Acciones rápidas

### Nuevo Pedido
- Búsqueda/creación de clientes
- Selección de planes
- Cálculo automático de recogida
- Gestión de pagos y descuentos
- Observaciones

### Gestión de Pedidos
- Lista de pedidos con filtros
- Actualización de estados
- Acciones rápidas por estado

### Reportes
- Arque diario
- Análisis financiero
- Exportación de datos
- Gráficos de distribución

### Configuración
- Precios y horarios
- Días no laborales
- Ubicación de oficina
- Notificaciones

## 🔧 Configuración Avanzada

### Reglas de Negocio
- No se trabaja los domingos
- Planes 4 y 5 solo sábados
- Cálculo automático de recogida
- Descuentos configurables

### Optimizaciones Firebase
- Índices optimizados para búsquedas
- Estructura de datos eficiente
- Caché local para datos estáticos

## 📞 Soporte

Para soporte técnico o consultas sobre el sistema, contactar al desarrollador.

## 📄 Licencia

Este proyecto es privado y confidencial.





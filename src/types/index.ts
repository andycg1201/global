// Tipos de permisos granulares
export interface Permisos {
  // Navegación y secciones principales
  verDashboard: boolean;
  verPedidos: boolean;
  verClientes: boolean;
  verInventario: boolean;
  verGastos: boolean;
  verCapital: boolean;
  verReportes: boolean;
  verConfiguracion: boolean;
  verPagos: boolean; // Nueva sección de pagos
  
  // Acciones en servicios
  crearServicios: boolean;
  modificarServicios: boolean;
  eliminarServicios: boolean;
  entregarServicios: boolean;
  recogerServicios: boolean;
  
  // Acciones en clientes
  crearClientes: boolean;
  editarClientes: boolean;
  eliminarClientes: boolean;
  
  // Acciones en inventario
  gestionarInventario: boolean; // crear, editar, eliminar lavadoras, marcar fuera de servicio
  
  // Acciones en gastos
  crearGastos: boolean;
  eliminarGastos: boolean; // Solo eliminar, no editar
  
  // Acciones en pagos
  crearPagos: boolean;
  eliminarPagos: boolean;
  
  // Acciones en capital
  gestionarCapital: boolean; // movimientos, capital inicial
  
  // Acciones en reportes
  exportarReportes: boolean;
  verFiltrosReportes: boolean; // solo para ver filtros avanzados (operador solo ve "hoy")
  
  // Gestión de usuarios
  gestionarUsuarios: boolean;
}

// Tipos de usuario
export type UserRole = 'admin' | 'manager' | 'operador';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permisos?: Permisos; // Solo para manager, admin tiene todos los permisos
  createdAt: Date;
  isActive: boolean;
  updatedAt?: Date;
  updatedBy?: string; // ID del usuario que lo actualizó
}

// Tipo para acciones de auditoría
export type TipoAccionAuditoria = 
  | 'crear_servicio'
  | 'modificar_servicio'
  | 'eliminar_servicio'
  | 'entregar_servicio'
  | 'recoger_servicio'
  | 'crear_cliente'
  | 'editar_cliente'
  | 'eliminar_cliente'
  | 'crear_gasto'
  | 'editar_gasto'
  | 'eliminar_gasto'
  | 'registrar_pago'
  | 'modificar_pago'
  | 'crear_lavadora'
  | 'editar_lavadora'
  | 'eliminar_lavadora'
  | 'gestionar_capital'
  | 'gestionar_inventario'
  | 'crear_usuario'
  | 'editar_usuario'
  | 'eliminar_usuario'
  | 'restablecer_contraseña'
  | 'crear_capital_inicial'
  | 'crear_movimiento_capital'
  | 'eliminar_movimiento_capital'
  | 'crear_mantenimiento'
  | 'finalizar_mantenimiento'
  | 'eliminar_mantenimiento';

// Registro de auditoría
export interface Auditoria {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  tipoAccion: TipoAccionAuditoria;
  entidadId: string; // ID de la entidad afectada (pedido, cliente, etc.)
  entidadTipo: string; // 'pedido', 'cliente', 'gasto', etc.
  detalles: string; // Descripción detallada de la acción
  valoresAnteriores?: Record<string, any>; // Valores antes del cambio
  valoresNuevos?: Record<string, any>; // Valores después del cambio
  fecha: Date;
  ip?: string;
  userAgent?: string;
}

// Tipos de planes
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // en horas
  startTime: string; // formato "HH:mm"
  endTime: string; // formato "HH:mm"
  isWeekendOnly: boolean; // para planes 4 y 5
  isActive: boolean;
  createdAt: Date;
}

// Tipos de cliente
export interface Cliente {
  id: string;
  name: string;
  phone: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  ubicacionGPS?: {
    lat: number;
    lng: number;
  };
  notes?: string;
  createdAt: Date;
  isActive: boolean;
}

// Tipos de pago
export interface PaymentMethod {
  type: 'efectivo' | 'nequi' | 'daviplata';
  method: 'efectivo' | 'deposito' | 'transferencia';
  reference?: string; // número de comprobante
  amount: number;
}

// Tipos de modificaciones dinámicas
export interface ModificacionPedido {
  id: string;
  pedidoId: string;
  tipo: 'horas_extras' | 'cobro_adicional' | 'descuento' | 'cambio_plan' | 'reembolso';
  concepto: string;
  descripcion?: string;
  monto: number; // positivo para cobros, negativo para descuentos/reembolsos
  cantidad?: number; // para horas extras
  precioUnitario?: number; // para horas extras
  fecha: Date;
  estado: 'pendiente' | 'aplicada' | 'cancelada';
  motivo?: string;
  aplicadoPor: string; // ID del usuario que aplicó la modificación
  createdAt: Date;
  updatedAt: Date;
}

// Sistema de modificaciones unificado
export interface ModificacionServicio {
  id: string;
  pedidoId: string;
  
  // Horas extras - Array de entradas individuales
  horasExtras: Array<{
    concepto: string; // Ej: "1 hora adicional", "2 horas extras"
    cantidad: number;
    precioUnitario: number;
    total: number;
  }>;
  
  // Cobros adicionales
  cobrosAdicionales: Array<{
    concepto: string;
    monto: number;
  }>;
  
  // Descuentos
  descuentos: Array<{
    concepto: string;
    monto: number;
  }>;
  
  // Cambio de plan
  cambioPlan?: {
    planAnterior: string;
    planNuevo: string;
    diferencia: number; // positivo si aumenta, negativo si disminuye
  };
  
  // Observaciones generales
  observaciones: string;
  
  // Totales calculados
  totalHorasExtras: number;
  totalCobrosAdicionales: number;
  totalDescuentos: number;
  totalModificaciones: number; // horas + cobros - descuentos + diferencia plan
  
  // Metadatos
  aplicadoPor: string; // Nombre del usuario que aplicó la modificación (cambiar de ID a nombre para pedidos nuevos)
  fecha: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de descuento
export interface Descuento {
  type: string; // "corte_agua", "problema_tecnico", etc.
  amount: number;
  reason: string;
}

// Tipos de cobros adicionales
export interface CobroAdicional {
  concepto: string; // "zona_alejada", "instalacion_especial", etc.
  monto: number;
  descripcion?: string;
}

// Tipos de reembolso
export interface Reembolso {
  monto: number;
  motivo: string;
  fecha: Date;
  metodo: 'efectivo' | 'nequi' | 'daviplata';
  referencia?: string;
}

// Tipos de pago anticipado
export interface PagoAnticipado {
  monto: number;
  metodo: PaymentMethod;
  fecha: Date;
  referencia?: string;
}

// Tipos de pedido
export interface Pedido {
  id: string;
  clienteId: string;
  cliente: Cliente; // datos del cliente
  planId: string;
  plan: Plan; // datos del plan
  status: 'pendiente' | 'entregado' | 'recogido' | 'cancelado';
  
  // Sistema de prioridades
  isPrioritario: boolean; // true = pedido prioritario, false = normal
  motivoPrioridad?: string; // motivo de la prioridad (ej: "cliente sale a las 8 AM")
  
  // Sistema de recogida prioritaria
  recogidaPrioritaria?: boolean; // true = recogida prioritaria, false = normal
  horaRecogida?: string; // hora prioritaria de recogida (formato "HH:mm")
  observacionRecogida?: string; // observaciones para la recogida prioritaria
  
  // Timestamps editables
  fechaAsignacion: Date;
  fechaEntrega?: Date;
  fechaRecogida?: Date;
  
  // Usuarios que realizaron las acciones (solo para pedidos nuevos)
  entregadoPor?: string; // Nombre del usuario que realizó la entrega
  recogidoPor?: string; // Nombre del usuario que realizó la recogida
  
  // Cálculos automáticos (solo se calculan cuando se entrega)
  fechaRecogidaCalculada?: Date; // opcional hasta que se entregue
  horasAdicionales: number;
  
  // Sistema de facturación separado
  estadoPago: 'pendiente' | 'pagado_anticipado' | 'pagado_entrega' | 'pagado_recogida' | 'debe';
  pagoAnticipado?: PagoAnticipado;
  cobrosAdicionales: CobroAdicional[];
  descuentos: Descuento[];
  reembolsos: Reembolso[];
  
  // Totales (calculados dinámicamente)
  subtotal: number; // precio del plan
  totalCobrosAdicionales: number;
  totalDescuentos: number;
  totalReembolsos: number;
  total: number; // subtotal + cobros - descuentos - reembolsos
  
  // Método de pago (solo si no pagó anticipado)
  paymentMethod?: PaymentMethod;
  
  // Observaciones
  observaciones?: string;
  observacionesPago?: string; // observaciones específicas del pago
  
  // Sistema de liquidación universal
  pagosRealizados?: PagoRealizado[]; // historial de pagos realizados
  saldoPendiente: number; // saldo pendiente de liquidación
  
  // Sistema de modificaciones dinámicas
  modificaciones?: ModificacionPedido[]; // historial de modificaciones al pedido
  modificacionesServicio?: ModificacionServicio[]; // historial de modificaciones del nuevo sistema
  
  // Gestión de lavadoras
  lavadoraAsignada?: {
    lavadoraId: string;
    codigoQR: string;
    marca: string;
    modelo: string;
    fotoInstalacion?: string;
    observacionesInstalacion?: string;
  };
  
  // Validación QR en entrega
  validacionQR?: {
    lavadoraEscaneada: string; // Código QR escaneado
    lavadoraOriginal: string; // Código QR originalmente asignado
    cambioRealizado: boolean; // Si se cambió la lavadora
    fechaValidacion: Date;
    fotoInstalacion?: string; // URL de la foto
    observacionesValidacion?: string;
  };
  
  // Cancelación
  motivoCancelacion?: string; // motivo de la cancelación (opcional)
  
  // Metadatos
  createdBy: string; // ID del usuario que creó el pedido
  createdAt: Date;
  updatedAt: Date;
  
  // Sistema de auditoría
  eliminado?: boolean; // true = servicio eliminado, false/undefined = activo
  fechaEliminacion?: Date; // fecha y hora de eliminación
  eliminadoPor?: string; // ID del usuario que eliminó el servicio
  motivoEliminacion?: string; // motivo de la eliminación (opcional)
}

// Tipos de pago
export interface PagoRealizado {
  monto: number;
  medioPago: 'efectivo' | 'nequi' | 'daviplata';
  referencia?: string;
  fecha: Date;
  isPartial: boolean;
  registradoPor?: string; // Nombre del usuario que registró el pago (solo para pedidos nuevos)
}

// Tipos de mantenimiento
export interface Mantenimiento {
  id: string;
  lavadoraId: string;
  tipoFalla: string; // "motor", "bomba", "electrónica", etc.
  descripcion: string; // descripción detallada del problema
  costoReparacion: number;
  servicioTecnico: string; // nombre del servicio técnico
  fechaInicio: Date;
  fechaEstimadaFin: Date;
  fechaFin?: Date; // cuando se marca como disponible
  fotos?: string[]; // URLs de fotos del daño
  observaciones?: string;
  medioPago?: 'efectivo' | 'nequi' | 'daviplata'; // medio de pago para el mantenimiento
  createdBy: string;
  registradoPor?: string; // Nombre del usuario que registró el mantenimiento (solo para mantenimientos nuevos)
  finalizadoPor?: string; // Nombre del usuario que finalizó el mantenimiento (solo para mantenimientos nuevos)
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de lavadoras
export interface Lavadora {
  id: string;
  codigoQR: string; // Código único para identificar la lavadora
  marca: string; // "LG"
  modelo: string; // "18kg"
  numeroSerie: string;
  estado: 'disponible' | 'alquilada' | 'mantenimiento' | 'retirada' | 'fuera_servicio';
  ubicacion: 'bodega' | 'cliente' | 'taller';
  
  // Información del alquiler actual (si está alquilada)
  clienteId?: string; // ID del cliente que la tiene alquilada
  pedidoId?: string; // ID del pedido asociado
  fechaInstalacion?: Date;
  fotoInstalacion?: string; // URL de la foto de instalación
  observacionesInstalacion?: string;
  
  // Información de mantenimiento actual (si está en mantenimiento)
  mantenimientoActual?: {
    mantenimientoId: string;
    fechaInicio: Date;
    fechaEstimadaFin: Date;
    tipoFalla: string;
    servicioTecnico: string;
  };
  
  // Metadatos
  createdBy: string; // ID del usuario que registró la lavadora
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de gastos
export interface ConceptoGasto {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Gasto {
  id: string;
  conceptoId: string;
  concepto: ConceptoGasto;
  amount: number;
  description: string;
  date: Date;
  medioPago: 'efectivo' | 'nequi' | 'daviplata';
  createdBy: string;
  registradoPor?: string; // Nombre del usuario que registró el gasto (solo para gastos nuevos)
  createdAt: Date;
}

// Tipos de reportes
export interface ReporteDiario {
  fecha: Date;
  ingresos: number;
  gastos: number;
  neto: number;
  pedidos: number;
  pedidosCompletados: number;
  ingresosPorMetodo?: {
    efectivo: number;
    nequi: number;
    daviplata: number;
  };
}

export interface ReporteMensual {
  mes: number;
  año: number;
  ingresos: number;
  gastos: number;
  neto: number;
  pedidos: number;
  pedidosCompletados: number;
  planesMasUsados: Array<{
    planId: string;
    planName: string;
    cantidad: number;
  }>;
}

// Tipos para WhatsApp
export interface WhatsAppMessage {
  id: string;
  pedidoId: string;
  phone: string;
  message: string;
  type: 'entrega' | 'recogida' | 'recordatorio';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  createdAt: Date;
}

// Tipos de configuración
export interface Configuracion {
  id: string;
  horaAdicional: number; // precio por hora adicional
  horarioTrabajo: {
    inicio: string; // "07:00"
    fin: string; // "19:00"
  };
  diasNoTrabajo: number[]; // [0] = domingo
  notificacionesWhatsApp: boolean;
  ubicacionOficina: {
    lat: number;
    lng: number;
  };
  updatedAt: Date;
}

// Tipos de capital
export interface CapitalInicial {
  id: string;
  efectivo: number;
  nequi: number;
  daviplata: number;
  fecha: Date;
  createdBy: string;
  createdAt: Date;
}

export interface MovimientoCapital {
  id: string;
  tipo: 'inyeccion' | 'retiro';
  concepto: string;
  efectivo: number;
  nequi: number;
  daviplata: number;
  observaciones?: string;
  fecha: Date;
  createdBy: string;
  createdAt: Date;
}

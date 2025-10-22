// Tipos de usuario
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'empleado';
  createdAt: Date;
  isActive: boolean;
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
}

// Tipos de pago
export interface PagoRealizado {
  monto: number;
  medioPago: 'efectivo' | 'nequi' | 'daviplata';
  referencia?: string;
  fecha: Date;
  isPartial: boolean;
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

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

// Tipos de pedido
export interface Pedido {
  id: string;
  clienteId: string;
  cliente: Cliente; // datos del cliente
  planId: string;
  plan: Plan; // datos del plan
  status: 'pendiente' | 'entregado' | 'recogido' | 'cancelado';
  
  // Timestamps editables
  fechaAsignacion: Date;
  fechaEntrega?: Date;
  fechaRecogida?: Date;
  
  // Cálculos automáticos (solo se calculan cuando se entrega)
  fechaRecogidaCalculada?: Date; // opcional hasta que se entregue
  horasAdicionales: number;
  
  // Pagos y descuentos (siempre editables)
  paymentMethod: PaymentMethod;
  descuentos: Descuento[];
  total: number;
  
  // Observaciones
  observaciones?: string;
  
  // Metadatos
  createdBy: string; // ID del usuario que creó el pedido
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

import { Plan, ConceptoGasto, Configuracion } from '../types';

// Planes iniciales del sistema
export const initialPlans: Omit<Plan, 'id' | 'createdAt'>[] = [
  {
    name: 'PLAN 1',
    description: '5 horas (7am-1pm del mismo día)',
    price: 12000,
    duration: 5,
    startTime: '07:00',
    endTime: '13:00',
    isWeekendOnly: false,
    isActive: true
  },
  {
    name: 'PLAN 2',
    description: '2pm de un día hasta 7am del siguiente día',
    price: 15000,
    duration: 17,
    startTime: '14:00',
    endTime: '07:00',
    isWeekendOnly: false,
    isActive: true
  },
  {
    name: 'PLAN 3',
    description: '7am de un día hasta 7am del siguiente día',
    price: 24000,
    duration: 24,
    startTime: '07:00',
    endTime: '07:00',
    isWeekendOnly: false,
    isActive: true
  },
  {
    name: 'PLAN 4',
    description: 'Sábado 7am hasta Lunes 7am',
    price: 30000,
    duration: 48,
    startTime: '07:00',
    endTime: '07:00',
    isWeekendOnly: true,
    isActive: true
  },
  {
    name: 'PLAN 5',
    description: 'Sábado 2pm hasta Lunes 7am',
    price: 25000,
    duration: 41,
    startTime: '14:00',
    endTime: '07:00',
    isWeekendOnly: true,
    isActive: true
  }
];

// Conceptos de gastos iniciales
export const initialConceptosGastos: Omit<ConceptoGasto, 'id' | 'createdAt'>[] = [
  {
    name: 'Combustible',
    description: 'Gastos de combustible para vehículos',
    isActive: true
  },
  {
    name: 'Mantenimiento',
    description: 'Mantenimiento de lavadoras y equipos',
    isActive: true
  },
  {
    name: 'Servicios Públicos',
    description: 'Agua, luz, gas, internet',
    isActive: true
  },
  {
    name: 'Alimentación',
    description: 'Gastos de alimentación del personal',
    isActive: true
  },
  {
    name: 'Transporte',
    description: 'Gastos de transporte y logística',
    isActive: true
  },
  {
    name: 'Marketing',
    description: 'Publicidad y promoción',
    isActive: true
  },
  {
    name: 'Oficina',
    description: 'Gastos de oficina y suministros',
    isActive: true
  },
  {
    name: 'Otros',
    description: 'Otros gastos varios',
    isActive: true
  }
];

// Configuración inicial del sistema
export const initialConfiguracion: Omit<Configuracion, 'id' | 'updatedAt'> = {
  horaAdicional: 2000,
  horarioTrabajo: {
    inicio: '07:00',
    fin: '19:00'
  },
  diasNoTrabajo: [0], // Domingo
  notificacionesWhatsApp: true,
  ubicacionOficina: {
    lat: 4.6097, // Bogotá
    lng: -74.0817
  }
};

// Usuario administrador inicial
export const initialAdminUser = {
  email: 'admin@lavadoras.com',
  password: 'admin123',
  name: 'Administrador',
  role: 'admin' as const
};

// Usuario empleado inicial
export const initialEmployeeUser = {
  email: 'empleado@lavadoras.com',
  password: 'empleado123',
  name: 'Empleado',
  role: 'empleado' as const
};





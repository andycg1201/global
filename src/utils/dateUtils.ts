import { format, addHours, addDays, isWeekend } from 'date-fns';
import { es } from 'date-fns/locale';

// Configuración de zona horaria Colombia (COT)
export const COLOMBIA_TIMEZONE = 'America/Bogota';

// Formatear fecha para Colombia
export const formatDate = (date: Date, formatStr: string = 'dd/MM/yyyy HH:mm') => {
  return format(date, formatStr, { locale: es });
};

// Formatear moneda en pesos colombianos
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Obtener fecha actual en Colombia
export const getCurrentDateColombia = (): Date => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: COLOMBIA_TIMEZONE}));
};

// Calcular fecha de recogida según el plan
export const calculatePickupDate = (
  deliveryDate: Date,
  planId: string,
  horasAdicionales: number = 0
): Date => {
  let pickupDate = new Date(deliveryDate);

  switch (planId) {
    case 'plan1':
      // PLAN 1: 5 horas desde entrega
      pickupDate = addHours(deliveryDate, 5 + horasAdicionales);
      break;
      
    case 'plan2':
      // PLAN 2: Siempre recogida a las 7 AM del día siguiente
      pickupDate = addDays(deliveryDate, 1);
      pickupDate.setHours(7, 0, 0, 0);
      // Agregar horas adicionales si las hay
      if (horasAdicionales > 0) {
        pickupDate = addHours(pickupDate, horasAdicionales);
      }
      break;
      
    case 'plan3':
      // PLAN 3: 24 horas desde entrega
      pickupDate = addHours(deliveryDate, 24 + horasAdicionales);
      break;
      
    case 'plan4':
      // PLAN 4: Sábado 7am hasta Lunes 7am (siempre Lunes 7am)
      pickupDate = addDays(deliveryDate, 2);
      pickupDate.setHours(7, 0, 0, 0);
      // Agregar horas adicionales si las hay
      if (horasAdicionales > 0) {
        pickupDate = addHours(pickupDate, horasAdicionales);
      }
      break;
      
    case 'plan5':
      // PLAN 5: Sábado 2pm hasta Lunes 7am (siempre Lunes 7am)
      pickupDate = addDays(deliveryDate, 2);
      pickupDate.setHours(7, 0, 0, 0);
      // Agregar horas adicionales si las hay
      if (horasAdicionales > 0) {
        pickupDate = addHours(pickupDate, horasAdicionales);
      }
      break;
      
    default:
      pickupDate = addHours(deliveryDate, 5 + horasAdicionales);
  }

  // Si la recogida cae en domingo, mover al lunes 7am
  if (pickupDate.getDay() === 0) { // Domingo
    pickupDate = addDays(pickupDate, 1);
    pickupDate.setHours(7, 0, 0, 0);
  }

  return pickupDate;
};

// Verificar si es domingo (día no laboral)
export const isNonWorkingDay = (date: Date): boolean => {
  return date.getDay() === 0; // Domingo
};

// Obtener el siguiente día laboral
export const getNextWorkingDay = (date: Date): Date => {
  let nextDay = addDays(date, 1);
  while (isNonWorkingDay(nextDay)) {
    nextDay = addDays(nextDay, 1);
  }
  return nextDay;
};

// Validar si un plan se puede usar en la fecha actual
export const canUsePlan = (planId: string, date: Date): boolean => {
  const dayOfWeek = date.getDay();
  
  // Planes 4 y 5 solo se pueden usar los sábados
  if ((planId === 'plan4' || planId === 'plan5') && dayOfWeek !== 6) {
    return false;
  }
  
  // No se puede usar ningún plan los domingos
  if (dayOfWeek === 0) {
    return false;
  }
  
  return true;
};

// Obtener planes disponibles para una fecha
export const getAvailablePlans = (date: Date): string[] => {
  const dayOfWeek = date.getDay();
  const availablePlans = ['plan1', 'plan2', 'plan3'];
  
  // Solo sábados se pueden usar planes 4 y 5
  if (dayOfWeek === 6) {
    availablePlans.push('plan4', 'plan5');
  }
  
  return availablePlans;
};

// Calcular total del pedido
export const calculateOrderTotal = (
  planPrice: number,
  horasAdicionales: number,
  precioHoraAdicional: number,
  descuentos: Array<{ amount: number }>
): number => {
  const subtotal = planPrice + (horasAdicionales * precioHoraAdicional);
  const totalDescuentos = descuentos.reduce((sum, descuento) => sum + descuento.amount, 0);
  return Math.max(0, subtotal - totalDescuentos);
};

// Formatear duración en horas
export const formatDuration = (hours: number): string => {
  if (hours < 24) {
    return `${hours} horas`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (remainingHours === 0) {
    return `${days} día${days > 1 ? 's' : ''}`;
  }
  
  return `${days} día${days > 1 ? 's' : ''} y ${remainingHours} horas`;
};

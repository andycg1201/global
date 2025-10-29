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

// Obtener fecha actual real en Colombia (sin lógica de horario laboral)
export const getCurrentDateColombia = (): Date => {
  return new Date();
};

// Obtener fecha de entrega por defecto con lógica de horario laboral
export const getDefaultDeliveryDate = (): Date => {
  const now = new Date();
  
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const hour = now.getHours();
  
  // Si es domingo, saltar al lunes 7:00 AM
  if (dayOfWeek === 0) {
    const monday = new Date(now);
    monday.setDate(now.getDate() + 1);
    monday.setHours(7, 0, 0, 0);
    return monday;
  }
  
  // Si es después de las 6:00 PM (18:00), ir al día siguiente a las 7:00 AM
  if (hour >= 18) {
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    
    // Si el día siguiente es domingo, saltar al lunes
    if (nextDay.getDay() === 0) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    nextDay.setHours(7, 0, 0, 0);
    return nextDay;
  }
  
  // Si es antes de las 6:00 AM, usar 7:00 AM del día actual
  if (hour < 6) {
    const sameDay = new Date(now);
    sameDay.setHours(7, 0, 0, 0);
    return sameDay;
  }
  
  // Entre 6:00 AM y 6:00 PM, usar la hora actual
  return now;
};

// Función de debug para verificar fechas (solo para desarrollo)
export const debugFechaColombia = () => {
  const now = new Date();
  const colombiaTime = getCurrentDateColombia();
  
  console.log('🔍 Debug de Fechas:');
  console.log('Fecha local del sistema:', now.toLocaleString());
  console.log('Zona horaria local:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('Offset local (minutos):', now.getTimezoneOffset());
  console.log('Fecha Colombia calculada:', colombiaTime.toLocaleString());
  console.log('Diferencia (horas):', (colombiaTime.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  return {
    fechaLocal: now,
    fechaColombia: colombiaTime,
    diferenciaHoras: (colombiaTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  };
};

// Calcular fecha de recogida según el plan
export const calculatePickupDate = (
  deliveryDate: Date,
  plan: { name: string; duration: number },
  horasAdicionales: number = 0
): Date => {
  let pickupDate = new Date(deliveryDate);
  
  if (plan.name === 'PLAN 1') {
    // PLAN 1: Recogida 5 horas después de la entrega
    pickupDate.setHours(pickupDate.getHours() + 5);
  } else if (plan.name === 'PLAN 2') {
    // PLAN 2: Recogida día siguiente a las 7 AM (independientemente de la hora de entrega)
    pickupDate.setDate(pickupDate.getDate() + 1);
    pickupDate.setHours(7, 0, 0, 0);
  } else if (plan.name === 'PLAN 3') {
    // PLAN 3: Recogida 24 horas después de la entrega
    pickupDate.setHours(pickupDate.getHours() + 24);
  } else if (plan.name === 'PLAN 4') {
    // PLAN 4: Recogida lunes a las 7 AM (solo sábados)
    const diasHastaLunes = (1 + 7 - pickupDate.getDay()) % 7 || 7;
    pickupDate.setDate(pickupDate.getDate() + diasHastaLunes);
    pickupDate.setHours(7, 0, 0, 0);
  } else if (plan.name === 'PLAN 5') {
    // PLAN 5: Recogida lunes a las 7 AM (solo sábados)
    const diasHastaLunes = (1 + 7 - pickupDate.getDay()) % 7 || 7;
    pickupDate.setDate(pickupDate.getDate() + diasHastaLunes);
    pickupDate.setHours(7, 0, 0, 0);
  } else {
    // Fallback: usar duración del plan
    pickupDate = addHours(deliveryDate, plan.duration);
  }

  // Agregar horas adicionales si las hay
  if (horasAdicionales > 0) {
    pickupDate = addHours(pickupDate, horasAdicionales);
  }

  return pickupDate;
};

// Verificar si es domingo (día no laboral)
export const isNonWorkingDay = (date: Date): boolean => {
  return date.getDay() === 0; // Domingo
};

// Formatear número de teléfono colombiano
export const formatColombianPhone = (phone: string): string => {
  // Si ya tiene +57, devolverlo tal como está
  if (phone.startsWith('+57')) {
    return phone;
  }
  
  // Remover todos los caracteres no numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Si ya tiene código de país colombiano (57), agregar el +
  if (cleanPhone.startsWith('57') && cleanPhone.length === 12) {
    return `+${cleanPhone}`;
  }
  
  // Si tiene 10 dígitos (número colombiano sin código de país)
  if (cleanPhone.length === 10) {
    return `+57${cleanPhone}`;
  }
  
  // Si tiene 11 dígitos y empieza con 3 (celular colombiano)
  if (cleanPhone.length === 11 && cleanPhone.startsWith('3')) {
    return `+57${cleanPhone}`;
  }
  
  // Para otros casos, devolver tal como está
  return phone;
};

// Generar enlace de WhatsApp para recogida
export const generateWhatsAppLink = (phone: string, clientName: string): string => {
  // Si el número ya tiene +57, usarlo tal como está
  // Si no, formatearlo
  const formattedPhone = phone.startsWith('+57') ? phone : formatColombianPhone(phone);
  const cleanPhone = formattedPhone.replace('+', '');
  
  const message = `Hola, te saludamos de Lavadoras Global`;
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
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
export const canUsePlan = (planId: string, date: Date, planName?: string): boolean => {
  const dayOfWeek = date.getDay();
  
  // Planes 4 y 5 solo se pueden usar los sábados (verificar por nombre también)
  const isWeekendPlan = planId === 'plan4' || planId === 'plan5' || 
                       planName === 'PLAN 4' || planName === 'PLAN 5';
  
  if (isWeekendPlan && dayOfWeek !== 6) {
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

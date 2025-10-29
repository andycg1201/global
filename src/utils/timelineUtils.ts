import { Pedido, ModificacionServicio, Plan } from '../types';

export interface TimelineEvent {
  id: string;
  tipo: 'creacion' | 'cambio_plan' | 'horas_extras' | 'cobros_adicionales' | 'descuentos' | 'pago' | 'entrega' | 'recogida';
  titulo: string;
  descripcion: string;
  fecha: Date;
  monto?: number;
  montoAnterior?: number;
  montoNuevo?: number;
  icono: string;
  color: string;
}

// Función auxiliar para convertir fechas a Date
const convertirFecha = (fecha: any): Date => {
  if (fecha instanceof Date) {
    return fecha;
  }
  if (fecha && typeof fecha.toDate === 'function') {
    return fecha.toDate();
  }
  if (typeof fecha === 'string' || typeof fecha === 'number') {
    return new Date(fecha);
  }
  return new Date();
};

export const generarTimelineServicio = (pedido: Pedido, planes: Plan[]): TimelineEvent[] => {
  const eventos: TimelineEvent[] = [];

  // 1. Evento de creación del servicio
  eventos.push({
    id: 'creacion',
    tipo: 'creacion',
    titulo: 'Servicio Creado',
    descripcion: `Plan ${pedido.plan.name} para ${pedido.cliente.name}`,
    fecha: convertirFecha(pedido.createdAt),
    monto: pedido.subtotal,
    icono: '📋',
    color: 'blue'
  });

  // 2. Eventos de modificaciones del servicio
  if (pedido.modificacionesServicio && pedido.modificacionesServicio.length > 0) {
    pedido.modificacionesServicio.forEach((modificacion, modIndex) => {
      const fechaModificacion = convertirFecha(modificacion.fecha || modificacion.createdAt);

      // Cambio de plan
      if (modificacion.cambioPlan) {
        const planAnterior = planes.find(p => p.id === modificacion.cambioPlan!.planAnterior);
        const planNuevo = planes.find(p => p.id === modificacion.cambioPlan!.planNuevo);
        
        eventos.push({
          id: `cambio-plan-${modIndex}`,
          tipo: 'cambio_plan',
          titulo: 'Cambio de Plan',
          descripcion: `${planAnterior?.name || 'Plan anterior'} → ${planNuevo?.name || 'Plan nuevo'}`,
          fecha: fechaModificacion,
          montoAnterior: planAnterior?.price || 0,
          montoNuevo: planNuevo?.price || 0,
          monto: modificacion.cambioPlan.diferencia,
          icono: '🔄',
          color: modificacion.cambioPlan.diferencia > 0 ? 'green' : 'red'
        });
      }

      // Horas extras
      if (modificacion.horasExtras && modificacion.horasExtras.length > 0) {
        modificacion.horasExtras.forEach((hora, horaIndex) => {
          eventos.push({
            id: `hora-extra-${modIndex}-${horaIndex}`,
            tipo: 'horas_extras',
            titulo: 'Horas Extras Agregadas',
            descripcion: hora.concepto,
            fecha: fechaModificacion,
            monto: hora.total,
            icono: '⏰',
            color: 'orange'
          });
        });
      }

      // Cobros adicionales
      if (modificacion.cobrosAdicionales && modificacion.cobrosAdicionales.length > 0) {
        modificacion.cobrosAdicionales.forEach((cobro, cobroIndex) => {
          eventos.push({
            id: `cobro-${modIndex}-${cobroIndex}`,
            tipo: 'cobros_adicionales',
            titulo: 'Cobro Adicional',
            descripcion: cobro.concepto,
            fecha: fechaModificacion,
            monto: cobro.monto,
            icono: '💰',
            color: 'green'
          });
        });
      }

      // Descuentos
      if (modificacion.descuentos && modificacion.descuentos.length > 0) {
        modificacion.descuentos.forEach((descuento, descIndex) => {
          eventos.push({
            id: `descuento-${modIndex}-${descIndex}`,
            tipo: 'descuentos',
            titulo: 'Descuento Aplicado',
            descripcion: descuento.concepto,
            fecha: fechaModificacion,
            monto: descuento.monto,
            icono: '🎯',
            color: 'red'
          });
        });
      }
    });
  }

  // 3. Evento de entrega
  if (pedido.fechaEntrega) {
    eventos.push({
      id: 'entrega',
      tipo: 'entrega',
      titulo: 'Servicio Entregado',
      descripcion: `Lavadora ${pedido.lavadoraAsignada?.codigoQR || 'N/A'} instalada`,
      fecha: convertirFecha(pedido.fechaEntrega),
      icono: '✅',
      color: 'green'
    });
  }

  // 4. Eventos de pagos
  if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
    pedido.pagosRealizados.forEach((pago, index) => {
      eventos.push({
        id: `pago-${index}`,
        tipo: 'pago',
        titulo: `Pago ${pago.medioPago}`,
        descripcion: pago.referencia ? `Ref: ${pago.referencia}` : 'Sin referencia',
        fecha: convertirFecha(pago.fecha),
        monto: pago.monto,
        icono: '💳',
        color: 'blue'
      });
    });
  }

  // 5. Evento de recogida
  if (pedido.fechaRecogida) {
    eventos.push({
      id: 'recogida',
      tipo: 'recogida',
      titulo: 'Servicio Recogido',
      descripcion: 'Servicio completado',
      fecha: convertirFecha(pedido.fechaRecogida),
      icono: '🏁',
      color: 'purple'
    });
  }

  // Ordenar eventos por fecha
  return eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
};

export const formatearFechaTimeline = (fecha: Date): string => {
  const ahora = new Date();
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutos < 60) {
    return `hace ${diffMinutos} min`;
  } else if (diffHoras < 24) {
    return `hace ${diffHoras}h`;
  } else if (diffDias < 7) {
    return `hace ${diffDias} días`;
  } else {
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

import { pedidoService, gastoService } from '../services/firebaseService';
import { obtenerMantenimientosActivos } from '../services/mantenimientoService';

export interface SaldoPorMedio {
  efectivo: number;
  nequi: number;
  daviplata: number;
}

export const calcularSaldosActuales = async (): Promise<SaldoPorMedio> => {
  try {
    // Obtener todos los pedidos
    const pedidos = await pedidoService.getAllPedidos();
    
    // Obtener todos los gastos (usar un rango amplio para obtener todos)
    const fechaInicio = new Date('2020-01-01'); // Fecha muy antigua
    const fechaFin = new Date(); // Fecha actual
    const gastos = await gastoService.getGastosDelRango(fechaInicio, fechaFin);
    
    // Obtener todos los mantenimientos
    const mantenimientos = await obtenerMantenimientosActivos();
    
    // Inicializar saldos
    const saldos: SaldoPorMedio = {
      efectivo: 0,
      nequi: 0,
      daviplata: 0
    };
    
    // Calcular ingresos por medio de pago
    pedidos.forEach(pedido => {
      if (pedido.pagosRealizados) {
        pedido.pagosRealizados.forEach(pago => {
          if (pago.medioPago === 'efectivo') {
            saldos.efectivo += pago.monto;
          } else if (pago.medioPago === 'nequi') {
            saldos.nequi += pago.monto;
          } else if (pago.medioPago === 'daviplata') {
            saldos.daviplata += pago.monto;
          }
        });
      }
    });
    
    // Calcular gastos por medio de pago
    gastos.forEach(gasto => {
      if (gasto.medioPago === 'efectivo') {
        saldos.efectivo -= gasto.amount;
      } else if (gasto.medioPago === 'nequi') {
        saldos.nequi -= gasto.amount;
      } else if (gasto.medioPago === 'daviplata') {
        saldos.daviplata -= gasto.amount;
      }
    });
    
    // Calcular gastos de mantenimiento por medio de pago
    mantenimientos.forEach(mantenimiento => {
      if (mantenimiento.medioPago === 'efectivo') {
        saldos.efectivo -= mantenimiento.costoReparacion;
      } else if (mantenimiento.medioPago === 'nequi') {
        saldos.nequi -= mantenimiento.costoReparacion;
      } else if (mantenimiento.medioPago === 'daviplata') {
        saldos.daviplata -= mantenimiento.costoReparacion;
      }
    });
    
    return saldos;
  } catch (error) {
    console.error('Error al calcular saldos actuales:', error);
    return {
      efectivo: 0,
      nequi: 0,
      daviplata: 0
    };
  }
};

export const validarSaldoSuficiente = (saldos: SaldoPorMedio, monto: number, medioPago: 'efectivo' | 'nequi' | 'daviplata'): boolean => {
  return saldos[medioPago] >= monto;
};

export const obtenerMediosDisponibles = (saldos: SaldoPorMedio, monto: number): Array<'efectivo' | 'nequi' | 'daviplata'> => {
  const mediosDisponibles: Array<'efectivo' | 'nequi' | 'daviplata'> = [];
  
  if (saldos.efectivo >= monto) {
    mediosDisponibles.push('efectivo');
  }
  if (saldos.nequi >= monto) {
    mediosDisponibles.push('nequi');
  }
  if (saldos.daviplata >= monto) {
    mediosDisponibles.push('daviplata');
  }
  
  return mediosDisponibles;
};

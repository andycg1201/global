import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface MovimientoSaldo {
  id: string;
  fecha: Date;
  concepto: string;
  referencia: string;
  monto: number;
  tipo: 'ingreso' | 'gasto';
  descripcion?: string;
  medioPago: 'efectivo' | 'nequi' | 'daviplata';
  pedidoId?: string;
  clienteName?: string;
  planName?: string;
}

export class MovimientosSaldosService {
  /**
   * Obtener todos los movimientos de un medio de pago específico
   */
  static async obtenerMovimientosPorMedioPago(
    medioPago: 'efectivo' | 'nequi' | 'daviplata'
  ): Promise<MovimientoSaldo[]> {
    try {
      console.log('🔍 MovimientosSaldosService - Buscando movimientos para:', medioPago);
      const movimientos: MovimientoSaldo[] = [];

      // 1. Obtener pagos de clientes desde pedidos
      console.log('📊 Consultando pedidos para obtener pagos...');
      const pedidosQuery = query(collection(db, 'pedidos'));
      const pedidosSnapshot = await getDocs(pedidosQuery);
      console.log('📋 Pedidos encontrados:', pedidosSnapshot.docs.length);
      
      pedidosSnapshot.forEach(doc => {
        const pedidoData = doc.data();
        const pagosRealizados = pedidoData.pagosRealizados || [];
        
        pagosRealizados.forEach((pago: any, index: number) => {
          if (pago.medioPago === medioPago) {
            const movimiento: MovimientoSaldo = {
              id: `pago-${doc.id}-${index}`,
              fecha: pago.fecha?.toDate ? pago.fecha.toDate() : new Date(pago.fecha),
              concepto: `Pago de ${pedidoData.cliente?.name || 'Cliente'}`,
              referencia: `Pedido #${doc.id.slice(-6)}`,
              monto: pago.monto,
              tipo: 'ingreso' as const,
              descripcion: `Plan ${pedidoData.plan?.name || 'N/A'}`,
              medioPago: pago.medioPago,
              pedidoId: doc.id,
              clienteName: pedidoData.cliente?.name,
              planName: pedidoData.plan?.name
            };
            console.log('💰 Pago agregado:', movimiento);
            movimientos.push(movimiento);
          }
        });
      });
      
      console.log('💰 Total pagos encontrados:', movimientos.length);

      // 2. Obtener capital inicial
      console.log('💰 Consultando capital inicial...');
      const capitalInicialQuery = query(collection(db, 'capitalInicial'));
      const capitalInicialSnapshot = await getDocs(capitalInicialQuery);
      console.log('💰 Documentos de capital inicial encontrados:', capitalInicialSnapshot.docs.length);
      
      capitalInicialSnapshot.forEach(doc => {
        const data = doc.data();
        const montoCapitalInicial = data[medioPago] || 0;
        
        if (montoCapitalInicial > 0) {
          const movimiento: MovimientoSaldo = {
            id: `capital-inicial-${doc.id}`,
            fecha: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            concepto: 'Capital Inicial',
            referencia: `Cap Inicial #${doc.id.slice(-6)}`,
            monto: montoCapitalInicial,
            tipo: 'ingreso' as const,
            descripcion: 'Capital inicial del negocio',
            medioPago: medioPago
          };
          console.log('💰 Capital inicial agregado:', movimiento);
          movimientos.push(movimiento);
        }
      });

      // 3. Obtener gastos generales
      console.log('💸 Consultando gastos para:', medioPago);
      const gastosQuery = query(
        collection(db, 'gastos'),
        where('medioPago', '==', medioPago)
      );
      const gastosSnapshot = await getDocs(gastosQuery);
      console.log('💸 Gastos encontrados:', gastosSnapshot.docs.length);
      
      gastosSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Manejar fechas de manera más robusta
        let fecha: Date;
        if (data.fecha?.toDate) {
          fecha = data.fecha.toDate();
        } else if (data.fecha instanceof Date) {
          fecha = data.fecha;
        } else if (data.fecha && typeof data.fecha === 'string') {
          fecha = new Date(data.fecha);
        } else {
          // Si no hay fecha válida, usar la fecha de creación del documento
          fecha = new Date(doc.id.substring(0, 8)); // Usar timestamp del ID como fallback
        }
        
        // Validar que la fecha sea válida
        if (isNaN(fecha.getTime())) {
          console.warn('⚠️ Fecha inválida para gasto:', doc.id, 'usando fecha actual');
          fecha = new Date();
        }
        
        const movimiento: MovimientoSaldo = {
          id: `gasto-${doc.id}`,
          fecha: fecha,
          concepto: typeof data.concepto === 'object' ? data.concepto?.name || 'Gasto General' : data.concepto || 'Gasto General',
          referencia: `Ref #${doc.id.slice(-6)}`,
          monto: data.amount,
          tipo: 'gasto' as const,
          descripcion: data.descripcion,
          medioPago: data.medioPago
        };
        console.log('💸 Gasto agregado:', movimiento);
        movimientos.push(movimiento);
      });

      // 4. Obtener gastos de mantenimiento
      console.log('🔧 Consultando mantenimientos para:', medioPago);
      const mantenimientosQuery = query(
        collection(db, 'mantenimientos'),
        where('medioPago', '==', medioPago)
      );
      const mantenimientosSnapshot = await getDocs(mantenimientosQuery);
      console.log('🔧 Mantenimientos encontrados:', mantenimientosSnapshot.docs.length);
      
      mantenimientosSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Manejar fechas de manera más robusta
        let fecha: Date;
        if (data.fechaInicio?.toDate) {
          fecha = data.fechaInicio.toDate();
        } else if (data.fechaInicio instanceof Date) {
          fecha = data.fechaInicio;
        } else if (data.fechaInicio && typeof data.fechaInicio === 'string') {
          fecha = new Date(data.fechaInicio);
        } else {
          // Si no hay fecha válida, usar la fecha de creación del documento
          fecha = new Date(doc.id.substring(0, 8)); // Usar timestamp del ID como fallback
        }
        
        // Validar que la fecha sea válida
        if (isNaN(fecha.getTime())) {
          console.warn('⚠️ Fecha inválida para mantenimiento:', doc.id, 'usando fecha actual');
          fecha = new Date();
        }
        
        const movimiento: MovimientoSaldo = {
          id: `mantenimiento-${doc.id}`,
          fecha: fecha,
          concepto: `Mantenimiento - ${data.tipoFalla || 'Reparación'}`,
          referencia: `Mant #${doc.id.slice(-6)}`,
          monto: data.costoReparacion || 0,
          tipo: 'gasto' as const,
          descripcion: data.descripcion,
          medioPago: data.medioPago
        };
        console.log('🔧 Mantenimiento agregado:', movimiento);
        movimientos.push(movimiento);
      });

      // 5. Obtener movimientos de capital (inyecciones y retiros)
      console.log('💰 Consultando movimientos de capital...');
      const capitalQuery = query(
        collection(db, 'movimientosCapital')
      );
      const capitalSnapshot = await getDocs(capitalQuery);
      console.log('💰 Movimientos de capital encontrados:', capitalSnapshot.docs.length);
      
      capitalSnapshot.forEach(doc => {
        const data = doc.data();
        const monto = data[medioPago] || 0;
        
        if (monto !== 0) {
          const movimiento: MovimientoSaldo = {
            id: `capital-${doc.id}`,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
            concepto: data.tipo === 'inyeccion' ? 'Inyección de Capital' : 'Retiro de Capital',
            referencia: `Cap #${doc.id.slice(-6)}`,
            monto: Math.abs(monto),
            tipo: data.tipo === 'inyeccion' ? 'ingreso' as const : 'gasto' as const,
            descripcion: data.descripcion,
            medioPago: medioPago
          };
          console.log('💰 Movimiento de capital agregado:', movimiento);
          movimientos.push(movimiento);
        }
      });

      // Ordenar todos los movimientos por fecha
      const movimientosOrdenados = movimientos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      console.log('✅ Total movimientos encontrados:', movimientosOrdenados.length);
      
      // Resumen de movimientos
      const totalIngresos = movimientosOrdenados
        .filter(m => m.tipo === 'ingreso')
        .reduce((sum, m) => sum + m.monto, 0);
      const totalGastos = movimientosOrdenados
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + m.monto, 0);
      const saldoCalculado = totalIngresos - totalGastos;
      
      console.log('📊 RESUMEN DE MOVIMIENTOS:');
      console.log('  - Total ingresos:', totalIngresos);
      console.log('  - Total gastos:', totalGastos);
      console.log('  - Saldo calculado:', saldoCalculado);
      console.log('  - Movimientos detallados:', movimientosOrdenados);
      
      return movimientosOrdenados;

    } catch (error) {
      console.error('Error al obtener movimientos de saldos:', error);
      throw error;
    }
  }

  /**
   * Obtener movimientos en un rango de fechas específico
   */
  static async obtenerMovimientosEnRango(
    medioPago: 'efectivo' | 'nequi' | 'daviplata',
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<MovimientoSaldo[]> {
    try {
      const todosLosMovimientos = await this.obtenerMovimientosPorMedioPago(medioPago);
      
      return todosLosMovimientos.filter(movimiento => {
        const fechaMovimiento = movimiento.fecha;
        return fechaMovimiento >= fechaInicio && fechaMovimiento <= fechaFin;
      });
    } catch (error) {
      console.error('Error al obtener movimientos en rango:', error);
      throw error;
    }
  }

  /**
   * Calcular saldo hasta una fecha específica
   */
  static async calcularSaldoHastaFecha(
    medioPago: 'efectivo' | 'nequi' | 'daviplata',
    fechaLimite: Date
  ): Promise<number> {
    try {
      const todosLosMovimientos = await this.obtenerMovimientosPorMedioPago(medioPago);
      
      const movimientosHastaFecha = todosLosMovimientos.filter(movimiento => 
        movimiento.fecha <= fechaLimite
      );

      return movimientosHastaFecha.reduce((saldo, movimiento) => {
        return saldo + (movimiento.tipo === 'ingreso' ? movimiento.monto : -movimiento.monto);
      }, 0);
    } catch (error) {
      console.error('Error al calcular saldo hasta fecha:', error);
      throw error;
    }
  }
}

export const movimientosSaldosService = new MovimientosSaldosService();

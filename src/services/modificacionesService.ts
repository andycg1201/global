import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ModificacionPedido, ResumenModificaciones, Pedido } from '../types';

export interface CrearModificacionData {
  pedidoId: string;
  tipo: 'horas_extras' | 'cobro_adicional' | 'descuento' | 'cambio_plan' | 'reembolso';
  concepto: string;
  descripcion?: string;
  monto: number;
  cantidad?: number;
  precioUnitario?: number;
  motivo?: string;
  aplicadoPor: string;
}

export class ModificacionesService {
  /**
   * Crear una nueva modificación para un pedido
   */
  static async crearModificacion(data: CrearModificacionData): Promise<string> {
    try {
      const modificacionData: Omit<ModificacionPedido, 'id'> = {
        pedidoId: data.pedidoId,
        tipo: data.tipo,
        concepto: data.concepto,
        descripcion: data.descripcion,
        monto: data.monto,
        cantidad: data.cantidad,
        precioUnitario: data.precioUnitario,
        fecha: new Date(),
        estado: 'aplicada',
        motivo: data.motivo,
        aplicadoPor: data.aplicadoPor,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'modificacionesPedidos'), modificacionData);
      
      // Actualizar el resumen de modificaciones del pedido
      await this.actualizarResumenModificaciones(data.pedidoId);
      
      return docRef.id;
    } catch (error) {
      console.error('Error al crear modificación:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las modificaciones de un pedido
   */
  static async obtenerModificacionesPorPedido(pedidoId: string): Promise<ModificacionPedido[]> {
    try {
      const q = query(
        collection(db, 'modificacionesPedidos'),
        where('pedidoId', '==', pedidoId),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const modificaciones: ModificacionPedido[] = [];
      
      querySnapshot.forEach((doc) => {
        modificaciones.push({
          id: doc.id,
          ...doc.data()
        } as ModificacionPedido);
      });
      
      return modificaciones;
    } catch (error) {
      console.error('Error al obtener modificaciones:', error);
      throw error;
    }
  }

  /**
   * Calcular el resumen de modificaciones para un pedido
   */
  static async calcularResumenModificaciones(pedidoId: string): Promise<ResumenModificaciones> {
    try {
      const modificaciones = await this.obtenerModificacionesPorPedido(pedidoId);
      
      const resumen: ResumenModificaciones = {
        totalHorasExtras: 0,
        totalCobrosAdicionales: 0,
        totalDescuentos: 0,
        totalReembolsos: 0,
        montoTotalModificaciones: 0,
        modificaciones: modificaciones
      };

      modificaciones.forEach(mod => {
        if (mod.estado === 'aplicada') {
          switch (mod.tipo) {
            case 'horas_extras':
              resumen.totalHorasExtras += mod.monto;
              break;
            case 'cobro_adicional':
              resumen.totalCobrosAdicionales += mod.monto;
              break;
            case 'descuento':
              resumen.totalDescuentos += Math.abs(mod.monto);
              break;
            case 'reembolso':
              resumen.totalReembolsos += Math.abs(mod.monto);
              break;
            case 'cambio_plan':
              resumen.totalCobrosAdicionales += mod.monto;
              break;
          }
          resumen.montoTotalModificaciones += mod.monto;
        }
      });

      return resumen;
    } catch (error) {
      console.error('Error al calcular resumen de modificaciones:', error);
      throw error;
    }
  }

  /**
   * Actualizar el resumen de modificaciones en el pedido
   */
  static async actualizarResumenModificaciones(pedidoId: string): Promise<void> {
    try {
      const resumen = await this.calcularResumenModificaciones(pedidoId);
      
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, {
        resumenModificaciones: resumen,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error al actualizar resumen de modificaciones:', error);
      throw error;
    }
  }

  /**
   * Calcular el saldo pendiente de un pedido considerando modificaciones
   */
  static calcularSaldoPendiente(pedido: Pedido): number {
    const subtotal = pedido.subtotal || 0;
    const modificaciones = pedido.resumenModificaciones?.montoTotalModificaciones || 0;
    const pagosRealizados = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
    
    return (subtotal + modificaciones) - pagosRealizados;
  }

  /**
   * Validar si un pago puede ser procesado (no supera el saldo)
   */
  static validarPago(montoPago: number, pedido: Pedido): { valido: boolean; mensaje?: string } {
    const saldoPendiente = this.calcularSaldoPendiente(pedido);
    
    if (montoPago <= 0) {
      return { valido: false, mensaje: 'El monto del pago debe ser mayor a 0' };
    }
    
    if (montoPago > saldoPendiente) {
      return { 
        valido: false, 
        mensaje: `El pago no puede superar el saldo pendiente de ${saldoPendiente.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}` 
      };
    }
    
    return { valido: true };
  }

  /**
   * Cancelar una modificación
   */
  static async cancelarModificacion(modificacionId: string, pedidoId: string): Promise<void> {
    try {
      const modificacionRef = doc(db, 'modificacionesPedidos', modificacionId);
      await updateDoc(modificacionRef, {
        estado: 'cancelada',
        updatedAt: new Date()
      });
      
      // Actualizar el resumen de modificaciones del pedido
      await this.actualizarResumenModificaciones(pedidoId);
    } catch (error) {
      console.error('Error al cancelar modificación:', error);
      throw error;
    }
  }
}

export const modificacionesService = ModificacionesService;

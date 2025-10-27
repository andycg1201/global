import { pedidoService, lavadoraService } from './firebaseService';
import { Pedido, Lavadora, Configuracion } from '../types';

export interface ValidacionQRData {
  lavadoraEscaneada: string;
  cambioRealizado: boolean;
  fotoInstalacion?: string;
  observacionesValidacion?: string;
  cobrosAdicionales: any[];
  horasAdicionales: number;
  observacionesPago?: string;
  recogidaPrioritaria?: boolean;
  horaRecogida?: string;
  observacionRecogida?: string;
}

export interface ValidacionQRResult {
  success: boolean;
  message?: string;
  pedidoActualizado?: Pedido;
}

export class ValidacionQRService {
  /**
   * Procesa la validación QR y facturación de un pedido
   * Esta es la lógica principal que usan tanto Dashboard como Pedidos
   */
  static async procesarValidacionQR(
    pedido: Pedido,
    validacionData: ValidacionQRData,
    lavadoras: Lavadora[],
    configuracion: Configuracion | null,
    callbacks?: {
      onSuccess?: (pedido: Pedido) => void;
      onError?: (error: string) => void;
    }
  ): Promise<ValidacionQRResult> {
    console.log('ValidacionQRService - procesarValidacionQR llamado con:', validacionData);
    console.log('ValidacionQRService - pedido:', pedido);
    
    if (!pedido) {
      console.log('ValidacionQRService - No hay pedido para validar');
      return { success: false, message: 'No hay pedido para validar' };
    }
    
    try {
      console.log('ValidacionQRService - Iniciando proceso de validación QR y facturación...');
      
      // Buscar la lavadora escaneada
      const lavadoraEscaneada = lavadoras.find(l => l.codigoQR === validacionData.lavadoraEscaneada);
      if (!lavadoraEscaneada) {
        const errorMsg = 'No se encontró la lavadora escaneada';
        callbacks?.onError?.(errorMsg);
        return { success: false, message: errorMsg };
      }

      // Verificar si la lavadora escaneada está disponible
      if (lavadoraEscaneada.estado !== 'disponible' && lavadoraEscaneada.estado !== 'alquilada') {
        const errorMsg = 'La lavadora escaneada no está disponible para alquiler';
        callbacks?.onError?.(errorMsg);
        return { success: false, message: errorMsg };
      }

      // Calcular totales de facturación
      const subtotal = pedido.plan.price;
      const totalCobrosAdicionales = validacionData.cobrosAdicionales.reduce((sum: number, cobro: any) => sum + cobro.monto, 0);
      const totalHorasAdicionales = validacionData.horasAdicionales * (configuracion?.horaAdicional || 2000);
      const nuevoTotal = subtotal + totalCobrosAdicionales + totalHorasAdicionales;

      // Actualizar el pedido con la información de validación QR y facturación
      const updateData: any = {
        validacionQR_lavadoraEscaneada: validacionData.lavadoraEscaneada,
        validacionQR_lavadoraOriginal: pedido.lavadoraAsignada?.codigoQR || '',
        validacionQR_cambioRealizado: validacionData.cambioRealizado,
        validacionQR_fechaValidacion: new Date(),
        validacionQR_fotoInstalacion: validacionData.fotoInstalacion,
        validacionQR_observacionesValidacion: validacionData.observacionesValidacion,
        // Datos de facturación
        cobrosAdicionales: validacionData.cobrosAdicionales,
        horasAdicionales: validacionData.horasAdicionales,
        observacionesPago: validacionData.observacionesPago,
        // Datos de recogida prioritaria
        recogidaPrioritaria: validacionData.recogidaPrioritaria || false,
        horaRecogida: validacionData.horaRecogida || '',
        observacionRecogida: validacionData.observacionRecogida || '',
        total: nuevoTotal,
        subtotal: subtotal,
        totalCobrosAdicionales: totalCobrosAdicionales,
        totalHorasAdicionales: totalHorasAdicionales,
        saldoPendiente: nuevoTotal - (pedido.pagosRealizados?.reduce((sum, p) => sum + p.monto, 0) || 0),
        updatedAt: new Date(),
        status: 'entregado', // Cambiar estado a entregado
        fechaEntrega: new Date() // Agregar fecha de entrega
      };

      // Actualizar estado de pago
      if (pedido.estadoPago === 'pagado_anticipado') {
        updateData.estadoPago = 'pagado_entrega';
      }

      // SIEMPRE marcar la lavadora escaneada como alquilada
      await lavadoraService.updateLavadora(lavadoraEscaneada.id, {
        estado: 'alquilada'
      });

      // Si había una lavadora previamente asignada, liberarla
      if (pedido.lavadoraAsignada && pedido.lavadoraAsignada.lavadoraId !== lavadoraEscaneada.id) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
        console.log('ValidacionQRService - Lavadora anterior liberada:', pedido.lavadoraAsignada.codigoQR);
      }

      // Actualizar la asignación en el pedido con la lavadora escaneada
      updateData.lavadoraAsignada_lavadoraId = lavadoraEscaneada.id;
      updateData.lavadoraAsignada_codigoQR = lavadoraEscaneada.codigoQR;
      updateData.lavadoraAsignada_marca = lavadoraEscaneada.marca;
      updateData.lavadoraAsignada_modelo = lavadoraEscaneada.modelo;
      updateData.lavadoraAsignada_fotoInstalacion = validacionData.fotoInstalacion;
      updateData.lavadoraAsignada_observacionesInstalacion = validacionData.observacionesValidacion;

      console.log('ValidacionQRService - Lavadora marcada como alquilada:', validacionData.lavadoraEscaneada);

      console.log('ValidacionQRService - Datos a actualizar:', updateData);

      // Actualizar el pedido usando el servicio
      await pedidoService.updatePedido(pedido.id, updateData);
      
      console.log('ValidacionQRService - Pedido actualizado y facturado exitosamente');
      
      // Crear el pedido actualizado para retornar
      const pedidoActualizado = {
        ...pedido,
        ...updateData,
        lavadoraAsignada: {
          lavadoraId: lavadoraEscaneada.id,
          codigoQR: lavadoraEscaneada.codigoQR,
          marca: lavadoraEscaneada.marca,
          modelo: lavadoraEscaneada.modelo,
          fotoInstalacion: validacionData.fotoInstalacion,
          observacionesInstalacion: validacionData.observacionesValidacion
        }
      };

      // Llamar callback de éxito si existe
      callbacks?.onSuccess?.(pedidoActualizado as Pedido);

      return { 
        success: true, 
        message: 'Pedido actualizado y facturado exitosamente',
        pedidoActualizado: pedidoActualizado as Pedido
      };
      
    } catch (error) {
      console.error('ValidacionQRService - Error al procesar validación QR:', error);
      const errorMsg = 'Error al procesar la validación QR: ' + (error instanceof Error ? error.message : 'Error desconocido');
      callbacks?.onError?.(errorMsg);
      return { success: false, message: errorMsg };
    }
  }
}

export const validacionQRService = ValidacionQRService;

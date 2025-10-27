import { pedidoService, lavadoraService } from './firebaseService';
import { Pedido } from '../types';

export interface RecogidaOperativaData {
  observacionesRecogida?: string;
  fotoRecogida?: string;
}

export interface RecogidaOperativaResult {
  success: boolean;
  message?: string;
  pedidoActualizado?: Pedido;
}

export class RecogidaOperativaService {
  /**
   * Procesa SOLO el proceso operativo de recogida (sin liquidación)
   * Separado del proceso financiero para mayor claridad
   */
  static async procesarRecogidaOperativa(
    pedido: Pedido,
    recogidaData: RecogidaOperativaData,
    callbacks?: {
      onSuccess?: (pedido: Pedido) => void;
      onError?: (error: string) => void;
    }
  ): Promise<RecogidaOperativaResult> {
    console.log('RecogidaOperativaService - procesarRecogidaOperativa llamado con:', recogidaData);
    console.log('RecogidaOperativaService - pedido:', pedido);
    
    if (!pedido) {
      console.log('RecogidaOperativaService - No hay pedido para recoger');
      return { success: false, message: 'No hay pedido para recoger' };
    }
    
    if (pedido.status !== 'entregado') {
      const errorMsg = 'El pedido debe estar en estado entregado para poder recogerlo';
      callbacks?.onError?.(errorMsg);
      return { success: false, message: errorMsg };
    }
    
    try {
      console.log('RecogidaOperativaService - Iniciando proceso operativo de recogida...');
      
      // Actualizar el pedido SOLO con información operativa
      const updateData: any = {
        // Cambio de estado operativo
        status: 'recogido',
        fechaRecogida: new Date(),
        updatedAt: new Date(),
        
        // Observaciones de recogida
        observacionesRecogida: recogidaData.observacionesRecogida,
        fotoRecogida: recogidaData.fotoRecogida
      };

      // Liberar la lavadora asignada
      if (pedido.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
        console.log('RecogidaOperativaService - Lavadora liberada:', pedido.lavadoraAsignada.codigoQR);
      }

      console.log('RecogidaOperativaService - Datos operativos a actualizar:', updateData);

      // Actualizar el pedido usando el servicio
      await pedidoService.updatePedido(pedido.id, updateData);
      
      console.log('RecogidaOperativaService - Recogida operativa completada exitosamente');
      
      // Crear el pedido actualizado para retornar
      const pedidoActualizado = {
        ...pedido,
        ...updateData
      };

      // Llamar callback de éxito si existe
      callbacks?.onSuccess?.(pedidoActualizado as Pedido);

      return { 
        success: true, 
        message: 'Recogida operativa completada exitosamente',
        pedidoActualizado: pedidoActualizado as Pedido
      };
      
    } catch (error) {
      console.error('RecogidaOperativaService - Error al procesar recogida operativa:', error);
      const errorMsg = 'Error al procesar la recogida operativa: ' + (error instanceof Error ? error.message : 'Error desconocido');
      callbacks?.onError?.(errorMsg);
      return { success: false, message: errorMsg };
    }
  }
}

export const recogidaOperativaService = RecogidaOperativaService;

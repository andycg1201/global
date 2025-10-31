import { pedidoService } from './firebaseService';
import { Pedido } from '../types';

export interface RecogidaOperativaData {
  observaciones: string;
  horaRecogida: string;
  fechaRecogida: Date;
}

export interface RecogidaOperativaResult {
  success: boolean;
  message: string;
  pedidoActualizado?: Pedido;
}

class RecogidaOperativaService {
  /**
   * Procesa la recogida operativa de un servicio
   * Solo cambia el estado del pedido y registra observaciones operativas
   * NO maneja aspectos financieros (eso se hace en ModalPagos)
   */
  async procesarRecogidaOperativa(
    pedidoId: string, 
    data: RecogidaOperativaData
  ): Promise<RecogidaOperativaResult> {
    try {
      console.log('🔄 Procesando recogida operativa:', {
        pedidoId,
        data
      });

      // Obtener nombre del usuario actual
      const getCurrentUserName = (): string => {
        try {
          const userStr = localStorage.getItem('currentUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            return user.name || 'Usuario desconocido';
          }
        } catch (error) {
          console.error('Error al obtener nombre del usuario:', error);
        }
        return 'Usuario desconocido';
      };

      // Actualizar el pedido con la información de recogida
      const pedidoActualizado = await pedidoService.updatePedido(pedidoId, {
        status: 'recogido',
        fechaRecogida: data.fechaRecogida,
        horaRecogida: data.horaRecogida,
        observacionRecogida: data.observaciones,
        recogidoPor: getCurrentUserName(), // ✅ Nombre del usuario que realizó la recogida
        updatedAt: new Date()
      });

      console.log('✅ Recogida operativa procesada exitosamente:', pedidoActualizado);

      return {
        success: true,
        message: 'Recogida registrada exitosamente',
        pedidoActualizado: pedidoActualizado as unknown as Pedido
      };

    } catch (error) {
      console.error('❌ Error al procesar recogida operativa:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido al procesar la recogida'
      };
    }
  }

  /**
   * Valida que el pedido esté en estado válido para recogida
   */
  validarPedidoParaRecogida(pedido: Pedido): { valido: boolean; mensaje: string } {
    if (!pedido) {
      return { valido: false, mensaje: 'Pedido no encontrado' };
    }

    if (pedido.status !== 'entregado') {
      return { valido: false, mensaje: 'El pedido debe estar en estado "entregado" para poder recogerlo' };
    }

    if (!pedido.fechaEntrega) {
      return { valido: false, mensaje: 'El pedido debe tener fecha de entrega para poder recogerlo' };
    }

    return { valido: true, mensaje: 'Pedido válido para recogida' };
  }
}

export const recogidaOperativaService = new RecogidaOperativaService();
import { pedidoService, lavadoraService } from './firebaseService';
import { Pedido, Lavadora } from '../types';
import { calculatePickupDate } from '../utils/dateUtils';

export interface EntregaOperativaData {
  lavadoraEscaneada: string;
  fotoInstalacion?: string;
  observacionesInstalacion?: string;
  recogidaPrioritaria?: boolean;
  horaRecogida?: string;
  observacionRecogida?: string;
}

export interface EntregaOperativaResult {
  success: boolean;
  message?: string;
  pedidoActualizado?: Pedido;
}

export class EntregaOperativaService {
  /**
   * Procesa SOLO el proceso operativo de entrega (sin facturación)
   * Separado del proceso financiero para mayor claridad
   */
  static async procesarEntregaOperativa(
    pedido: Pedido,
    entregaData: EntregaOperativaData,
    lavadoras: Lavadora[],
    callbacks?: {
      onSuccess?: (pedido: Pedido) => void;
      onError?: (error: string) => void;
    }
  ): Promise<EntregaOperativaResult> {
    console.log('EntregaOperativaService - procesarEntregaOperativa llamado con:', entregaData);
    console.log('EntregaOperativaService - pedido:', pedido);
    
    if (!pedido) {
      console.log('EntregaOperativaService - No hay pedido para entregar');
      return { success: false, message: 'No hay pedido para entregar' };
    }
    
    try {
      console.log('EntregaOperativaService - Iniciando proceso operativo de entrega...');
      
      // Buscar la lavadora escaneada
      const lavadoraEscaneada = lavadoras.find(l => l.codigoQR === entregaData.lavadoraEscaneada);
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

      // Calcular fecha de recogida según el plan
      const fechaEntrega = new Date();
      const fechaRecogidaCalculada = calculatePickupDate(fechaEntrega, pedido.plan, pedido.horasAdicionales || 0);
      
      console.log('EntregaOperativaService - Calculando fecha de recogida:', {
        fechaEntrega: fechaEntrega.toISOString(),
        plan: pedido.plan.name,
        horasAdicionales: pedido.horasAdicionales || 0,
        fechaRecogidaCalculada: fechaRecogidaCalculada.toISOString()
      });

      // Actualizar el pedido SOLO con información operativa
      const updateData: any = {
        // Información de validación QR (operativa)
        validacionQR_lavadoraEscaneada: entregaData.lavadoraEscaneada,
        validacionQR_lavadoraOriginal: pedido.lavadoraAsignada?.codigoQR || '',
        validacionQR_cambioRealizado: false,
        validacionQR_fechaValidacion: new Date(),
        validacionQR_fotoInstalacion: entregaData.fotoInstalacion || '',
        validacionQR_observacionesValidacion: entregaData.observacionesInstalacion || '',
        
        // Datos de recogida prioritaria (operativa)
        recogidaPrioritaria: entregaData.recogidaPrioritaria || false,
        horaRecogida: entregaData.horaRecogida || '',
        observacionRecogida: entregaData.observacionRecogida || '',
        
        // Cambio de estado operativo
        status: 'entregado',
        fechaEntrega: fechaEntrega,
        fechaRecogidaCalculada: fechaRecogidaCalculada, // ✅ AGREGADO: Calcular fecha de recogida
        updatedAt: new Date()
      };

      // SIEMPRE marcar la lavadora escaneada como alquilada
      await lavadoraService.updateLavadora(lavadoraEscaneada.id, {
        estado: 'alquilada'
      });

      // Si había una lavadora previamente asignada, liberarla
      if (pedido.lavadoraAsignada && pedido.lavadoraAsignada.lavadoraId !== lavadoraEscaneada.id) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
        console.log('EntregaOperativaService - Lavadora anterior liberada:', pedido.lavadoraAsignada.codigoQR);
      }

      // Actualizar la asignación en el pedido con la lavadora escaneada
      updateData.lavadoraAsignada_lavadoraId = lavadoraEscaneada.id;
      updateData.lavadoraAsignada_codigoQR = lavadoraEscaneada.codigoQR;
      updateData.lavadoraAsignada_marca = lavadoraEscaneada.marca;
      updateData.lavadoraAsignada_modelo = lavadoraEscaneada.modelo;
      updateData.lavadoraAsignada_fotoInstalacion = entregaData.fotoInstalacion || '';
      updateData.lavadoraAsignada_observacionesInstalacion = entregaData.observacionesInstalacion || '';

      console.log('EntregaOperativaService - Lavadora marcada como alquilada:', entregaData.lavadoraEscaneada);

      console.log('EntregaOperativaService - Datos operativos a actualizar:', updateData);

      // Actualizar el pedido usando el servicio
      await pedidoService.updatePedido(pedido.id, updateData);
      
      console.log('EntregaOperativaService - Entrega operativa completada exitosamente');
      
      // Crear el pedido actualizado para retornar
      const pedidoActualizado = {
        ...pedido,
        ...updateData,
        lavadoraAsignada: {
          lavadoraId: lavadoraEscaneada.id,
          codigoQR: lavadoraEscaneada.codigoQR,
          marca: lavadoraEscaneada.marca,
          modelo: lavadoraEscaneada.modelo,
          fotoInstalacion: entregaData.fotoInstalacion || '',
          observacionesInstalacion: entregaData.observacionesInstalacion || ''
        }
      };

      // Llamar callback de éxito si existe
      callbacks?.onSuccess?.(pedidoActualizado as Pedido);

      return { 
        success: true, 
        message: 'Entrega operativa completada exitosamente',
        pedidoActualizado: pedidoActualizado as Pedido
      };
      
    } catch (error) {
      console.error('EntregaOperativaService - Error al procesar entrega operativa:', error);
      const errorMsg = 'Error al procesar la entrega operativa: ' + (error instanceof Error ? error.message : 'Error desconocido');
      callbacks?.onError?.(errorMsg);
      return { success: false, message: errorMsg };
    }
  }
}

export const entregaOperativaService = EntregaOperativaService;

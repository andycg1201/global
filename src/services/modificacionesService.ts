import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ModificacionServicio } from '../types';

export class ModificacionesService {
  /**
   * Guardar o actualizar modificaciones de un servicio
   */
  static async guardarModificacion(data: Omit<ModificacionServicio, 'id'>): Promise<string> {
    try {
      console.log('ModificacionesService - Guardando modificación con datos:', data);
      
      // Convertir fechas a Timestamp para Firebase
      const modificacionData = {
        ...data,
        fecha: Timestamp.fromDate(data.fecha),
        createdAt: Timestamp.fromDate(data.createdAt),
        updatedAt: Timestamp.fromDate(data.updatedAt)
      };

      console.log('ModificacionesService - Datos preparados para Firebase:', modificacionData);

      // Verificar si ya existe una modificación para este pedido
      const modificacionExistente = await this.obtenerModificacionPorPedido(data.pedidoId);
      
      if (modificacionExistente) {
        // Actualizar modificación existente
        const docRef = doc(db, 'modificacionesServicios', modificacionExistente.id);
        await updateDoc(docRef, {
          ...modificacionData,
          updatedAt: Timestamp.fromDate(new Date())
        });
        console.log('ModificacionesService - Modificación actualizada exitosamente');
        return modificacionExistente.id;
      } else {
        // Crear nueva modificación
        const docRef = await addDoc(collection(db, 'modificacionesServicios'), modificacionData);
        console.log('ModificacionesService - Modificación creada con ID:', docRef.id);
        return docRef.id;
      }
    } catch (error) {
      console.error('ModificacionesService - Error al guardar modificación:', error);
      throw error;
    }
  }

  /**
   * Obtener modificaciones de un pedido específico
   */
  static async obtenerModificacionPorPedido(pedidoId: string): Promise<ModificacionServicio | null> {
    try {
      const q = query(
        collection(db, 'modificacionesServicios'),
        where('pedidoId', '==', pedidoId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        // Convertir timestamps de Firebase a Date
        fecha: data.fecha?.toDate ? data.fecha.toDate() : data.fecha,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
      } as ModificacionServicio;
    } catch (error) {
      console.error('Error al obtener modificaciones:', error);
      throw error;
    }
  }

  /**
   * Eliminar modificaciones de un pedido
   */
  static async eliminarModificacion(pedidoId: string): Promise<void> {
    try {
      const modificacion = await this.obtenerModificacionPorPedido(pedidoId);
      if (modificacion) {
        const docRef = doc(db, 'modificacionesServicios', modificacion.id);
        await updateDoc(docRef, {
          // Marcar como eliminado en lugar de borrar físicamente
          eliminado: true,
          fechaEliminacion: Timestamp.fromDate(new Date())
        });
        console.log('ModificacionesService - Modificación eliminada exitosamente');
      }
    } catch (error) {
      console.error('Error al eliminar modificaciones:', error);
      throw error;
    }
  }
}

export const modificacionesService = new ModificacionesService();
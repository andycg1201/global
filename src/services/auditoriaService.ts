import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  orderBy, 
  where, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Auditoria, TipoAccionAuditoria } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface RegistrarAccionParams {
  tipoAccion: TipoAccionAuditoria;
  entidadId: string;
  entidadTipo: string;
  detalles: string;
  valoresAnteriores?: Record<string, any>;
  valoresNuevos?: Record<string, any>;
}

class AuditoriaService {
  private collectionName = 'auditoria';

  // Registrar una acción en auditoría (alias para logAuditoria)
  async logAuditoria(
    tipoAccion: TipoAccionAuditoria,
    entidadTipo: string,
    entidadId: string,
    detalles: string,
    valoresAnteriores?: Record<string, any>,
    valoresNuevos?: Record<string, any>
  ): Promise<string> {
    return this.registrarAccion({
      tipoAccion,
      entidadTipo,
      entidadId,
      detalles,
      valoresAnteriores,
      valoresNuevos
    });
  }

  // Registrar una acción en auditoría
  async registrarAccion(params: RegistrarAccionParams): Promise<string> {
    try {
      // Obtener información del usuario actual desde localStorage o contexto
      // Por ahora usaremos una función helper que se puede pasar desde el contexto
      const userInfo = this.getCurrentUserInfo();
      
      if (!userInfo) {
        console.warn('No se pudo obtener información del usuario para auditoría');
        return '';
      }

      const auditoriaData: Omit<Auditoria, 'id'> = {
        usuarioId: userInfo.id,
        usuarioNombre: userInfo.name,
        usuarioEmail: userInfo.email,
        tipoAccion: params.tipoAccion,
        entidadId: params.entidadId,
        entidadTipo: params.entidadTipo,
        detalles: params.detalles,
        valoresAnteriores: params.valoresAnteriores,
        valoresNuevos: params.valoresNuevos,
        fecha: new Date(),
        ip: await this.getClientIP(),
        userAgent: navigator.userAgent
      };

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...auditoriaData,
        fecha: Timestamp.fromDate(auditoriaData.fecha)
      });

      return docRef.id;
    } catch (error) {
      console.error('Error al registrar acción en auditoría:', error);
      // No lanzar error para no interrumpir el flujo principal
      return '';
    }
  }

  // Obtener todas las acciones de auditoría
  async getAllAuditoria(
    filtros?: {
      usuarioId?: string;
      tipoAccion?: TipoAccionAuditoria;
      entidadTipo?: string;
      fechaInicio?: Date;
      fechaFin?: Date;
      limite?: number;
    }
  ): Promise<Auditoria[]> {
    try {
      let q = query(collection(db, this.collectionName));

      if (filtros?.usuarioId) {
        q = query(q, where('usuarioId', '==', filtros.usuarioId));
      }

      if (filtros?.tipoAccion) {
        q = query(q, where('tipoAccion', '==', filtros.tipoAccion));
      }

      if (filtros?.entidadTipo) {
        q = query(q, where('entidadTipo', '==', filtros.entidadTipo));
      }

      if (filtros?.fechaInicio) {
        q = query(q, where('fecha', '>=', Timestamp.fromDate(filtros.fechaInicio)));
      }

      if (filtros?.fechaFin) {
        const fechaFinConHora = new Date(filtros.fechaFin);
        fechaFinConHora.setHours(23, 59, 59, 999);
        q = query(q, where('fecha', '<=', Timestamp.fromDate(fechaFinConHora)));
      }

      q = query(q, orderBy('fecha', 'desc'));

      if (filtros?.limite) {
        q = query(q, limit(filtros.limite));
      }

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date()
        } as Auditoria;
      });
    } catch (error) {
      console.error('Error al obtener auditoría:', error);
      throw error;
    }
  }

  // Obtener auditoría por entidad
  async getAuditoriaPorEntidad(
    entidadId: string,
    entidadTipo?: string
  ): Promise<Auditoria[]> {
    try {
      let q = query(
        collection(db, this.collectionName),
        where('entidadId', '==', entidadId),
        orderBy('fecha', 'desc')
      );

      if (entidadTipo) {
        q = query(
          collection(db, this.collectionName),
          where('entidadId', '==', entidadId),
          where('entidadTipo', '==', entidadTipo),
          orderBy('fecha', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date()
        } as Auditoria;
      });
    } catch (error) {
      console.error('Error al obtener auditoría por entidad:', error);
      throw error;
    }
  }

  // Helper para obtener información del usuario actual
  private getCurrentUserInfo(): { id: string; name: string; email: string } | null {
    try {
      // Intentar obtener del localStorage (se guardará desde AuthContext)
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          id: user.id,
          name: user.name,
          email: user.email
        };
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      return null;
    }
  }

  // Helper para obtener IP del cliente (básico)
  private async getClientIP(): Promise<string | undefined> {
    try {
      // En un entorno de producción, esto se obtendría del servidor
      // Por ahora retornamos undefined
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Obtener todos los registros de auditoría
  async obtenerRegistrosAuditoria(): Promise<Auditoria[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('fecha', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const registros = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha.toDate()
      })) as Auditoria[];
      
      return registros;
    } catch (error) {
      console.error('Error al obtener registros de auditoría:', error);
      throw error;
    }
  }

  // Método para inicializar el contexto de usuario (se llamará desde AuthContext)
  public setCurrentUser(user: { id: string; name: string; email: string } | null) {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }
}

export const auditoriaService = new AuditoriaService();


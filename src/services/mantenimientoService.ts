import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  deleteField
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Mantenimiento, Lavadora } from '../types';
import { auditoriaService } from './auditoriaService';

const MANTENIMIENTOS_COLLECTION = 'mantenimientos';
const LAVADORAS_COLLECTION = 'lavadoras';

// Tipos de fallas predefinidas
export const TIPOS_FALLA = [
  'Motor',
  'Bomba de agua',
  'Electrónica/Control',
  'Tambor',
  'Filtros',
  'Conexiones eléctricas',
  'Conexiones de agua',
  'Sellos/Gomas',
  'Otro'
];

// Crear nuevo mantenimiento
export const crearMantenimiento = async (
  lavadoraId: string,
  tipoFalla: string,
  descripcion: string,
  costoReparacion: number,
  servicioTecnico: string,
  fechaEstimadaFin: Date,
  createdBy: string,
  fotos?: string[],
  observaciones?: string,
  medioPago?: 'efectivo' | 'nequi' | 'daviplata'
): Promise<string> => {
  try {
    // Validar que createdBy no sea undefined
    if (!createdBy) {
      throw new Error('Usuario no autenticado. No se puede crear el mantenimiento.');
    }

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

    const mantenimientoData = {
      lavadoraId,
      tipoFalla,
      descripcion,
      costoReparacion,
      servicioTecnico,
      fechaInicio: serverTimestamp(),
      fechaEstimadaFin: Timestamp.fromDate(fechaEstimadaFin),
      fotos: fotos || [],
      observaciones: observaciones || '',
      medioPago: medioPago || 'efectivo',
      createdBy,
      registradoPor: getCurrentUserName(), // ✅ Nombre del usuario que registró el mantenimiento
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, MANTENIMIENTOS_COLLECTION), mantenimientoData);
    // Actualizar estado de la lavadora
    const mantenimientoInfo = {
      mantenimientoId: docRef.id,
      fechaInicio: new Date(),
      fechaEstimadaFin,
      tipoFalla,
      servicioTecnico
    };
    
    await actualizarEstadoLavadora(lavadoraId, 'mantenimiento', mantenimientoInfo);

    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'crear_mantenimiento',
      'mantenimiento',
      docRef.id,
      `Mantenimiento creado - Tipo: ${tipoFalla}, Costo: $${costoReparacion.toLocaleString()}, Técnico: ${servicioTecnico}`,
      undefined,
      {
        lavadoraId,
        tipoFalla,
        descripcion,
        costoReparacion,
        servicioTecnico,
        medioPago: medioPago || 'efectivo'
      }
    );

    return docRef.id;
  } catch (error) {
    console.error('Error creando mantenimiento:', error);
    throw error;
  }
};

// Finalizar mantenimiento (marcar como disponible)
export const finalizarMantenimiento = async (
  mantenimientoId: string,
  lavadoraId: string,
  observaciones?: string
): Promise<void> => {
  try {
    // Obtener datos del mantenimiento antes de finalizarlo
    const mantenimientoDoc = await getDoc(doc(db, MANTENIMIENTOS_COLLECTION, mantenimientoId));
    const mantenimientoData = mantenimientoDoc.exists() ? mantenimientoDoc.data() : null;

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

    // Actualizar el mantenimiento
    const mantenimientoRef = doc(db, MANTENIMIENTOS_COLLECTION, mantenimientoId);
    await updateDoc(mantenimientoRef, {
      fechaFin: serverTimestamp(),
      observaciones: observaciones || '',
      finalizadoPor: getCurrentUserName(), // ✅ Nombre del usuario que finalizó el mantenimiento
      updatedAt: serverTimestamp()
    });

    // Actualizar estado de la lavadora
    await actualizarEstadoLavadora(lavadoraId, 'disponible');

    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'finalizar_mantenimiento',
      'mantenimiento',
      mantenimientoId,
      `Mantenimiento finalizado - Tipo: ${mantenimientoData?.tipoFalla || 'N/A'}, Costo: $${mantenimientoData?.costoReparacion?.toLocaleString() || 0}`,
      {
        tipoFalla: mantenimientoData?.tipoFalla,
        descripcion: mantenimientoData?.descripcion,
        costoReparacion: mantenimientoData?.costoReparacion,
        servicioTecnico: mantenimientoData?.servicioTecnico,
        fechaFin: null
      },
      {
        tipoFalla: mantenimientoData?.tipoFalla,
        descripcion: mantenimientoData?.descripcion,
        costoReparacion: mantenimientoData?.costoReparacion,
        servicioTecnico: mantenimientoData?.servicioTecnico,
        fechaFin: new Date(),
        observaciones: observaciones || ''
      }
    );
  } catch (error) {
    console.error('Error finalizando mantenimiento:', error);
    throw error;
  }
};

// Actualizar estado de lavadora
const actualizarEstadoLavadora = async (
  lavadoraId: string, 
  estado: 'disponible' | 'alquilada' | 'mantenimiento' | 'retirada',
  mantenimientoActual?: any
): Promise<void> => {
  try {
    const lavadoraRef = doc(db, LAVADORAS_COLLECTION, lavadoraId);
    const updateData: any = {
      estado,
      updatedAt: serverTimestamp()
    };

    if (estado === 'mantenimiento' && mantenimientoActual) {
      updateData.mantenimientoActual = mantenimientoActual;
    } else if (estado === 'disponible') {
      updateData.mantenimientoActual = deleteField();
    }

    await updateDoc(lavadoraRef, updateData);
  } catch (error) {
    console.error('Error actualizando estado de lavadora:', error);
    throw error;
  }
};

// Obtener un mantenimiento específico por ID
export const obtenerMantenimientoPorId = async (mantenimientoId: string): Promise<Mantenimiento | null> => {
  try {
    const docRef = doc(db, MANTENIMIENTOS_COLLECTION, mantenimientoId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    
    return {
      id: docSnap.id,
      lavadoraId: data.lavadoraId,
      tipoFalla: data.tipoFalla,
      descripcion: data.descripcion,
      costoReparacion: data.costoReparacion,
      servicioTecnico: data.servicioTecnico,
      fechaInicio: data.fechaInicio?.toDate() || new Date(),
      fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
      fechaFin: data.fechaFin?.toDate(),
      fotos: data.fotos || [],
      observaciones: data.observaciones || '',
      medioPago: data.medioPago || 'efectivo',
      createdBy: data.createdBy,
      registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el mantenimiento
      finalizadoPor: data.finalizadoPor || undefined, // ✅ Nombre del usuario que finalizó el mantenimiento
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  } catch (error) {
    console.error('Error obteniendo mantenimiento por ID:', error);
    return null;
  }
};

// Obtener historial de mantenimientos de una lavadora
export const obtenerHistorialMantenimiento = async (lavadoraId: string): Promise<Mantenimiento[]> => {
  try {
    const q = query(
      collection(db, MANTENIMIENTOS_COLLECTION),
      where('lavadoraId', '==', lavadoraId)
    );

    const querySnapshot = await getDocs(q);
    const mantenimientos: Mantenimiento[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      mantenimientos.push({
        id: doc.id,
        lavadoraId: data.lavadoraId,
        tipoFalla: data.tipoFalla,
        descripcion: data.descripcion,
        costoReparacion: data.costoReparacion,
        servicioTecnico: data.servicioTecnico,
        fechaInicio: data.fechaInicio?.toDate() || new Date(),
        fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
        fechaFin: data.fechaFin?.toDate(),
        fotos: data.fotos || [],
        observaciones: data.observaciones || '',
        medioPago: data.medioPago || 'efectivo',
        createdBy: data.createdBy,
        registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el mantenimiento
        finalizadoPor: data.finalizadoPor || undefined, // ✅ Nombre del usuario que finalizó el mantenimiento
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    // Ordenar por fecha de creación (más reciente primero)
    mantenimientos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return mantenimientos;
  } catch (error) {
    console.error('Error obteniendo historial de mantenimiento:', error);
    // Si hay error (colección no existe, etc.), retornar array vacío
    return [];
  }
};

// Obtener todos los mantenimientos (para Dashboard)
export const obtenerTodosLosMantenimientos = async (): Promise<Mantenimiento[]> => {
  try {
    const q = query(
      collection(db, MANTENIMIENTOS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const mantenimientos: Mantenimiento[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      mantenimientos.push({
        id: doc.id,
        lavadoraId: data.lavadoraId,
        tipoFalla: data.tipoFalla,
        descripcion: data.descripcion,
        costoReparacion: data.costoReparacion,
        servicioTecnico: data.servicioTecnico,
        fechaInicio: data.fechaInicio?.toDate() || new Date(),
        fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
        fechaFin: data.fechaFin?.toDate(),
        fotos: data.fotos || [],
        observaciones: data.observaciones || '',
        medioPago: data.medioPago || 'efectivo',
        createdBy: data.createdBy,
        registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el mantenimiento
        finalizadoPor: data.finalizadoPor || undefined, // ✅ Nombre del usuario que finalizó el mantenimiento
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    console.log('🔧 MantenimientoService - Todos los mantenimientos obtenidos:', mantenimientos.length);
    console.log('🔧 MantenimientoService - Datos:', mantenimientos.map(m => ({
      id: m.id,
      costoReparacion: m.costoReparacion,
      medioPago: m.medioPago,
      createdAt: m.createdAt
    })));
    
    return mantenimientos;
  } catch (error) {
    console.error('Error obteniendo todos los mantenimientos:', error);
    return [];
  }
};

// Obtener todos los mantenimientos activos
export const obtenerMantenimientosActivos = async (): Promise<Mantenimiento[]> => {
  try {
    // Simplificar consulta para evitar índice compuesto
    const q = query(
      collection(db, MANTENIMIENTOS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const mantenimientos: Mantenimiento[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filtrar solo los activos (fechaFin es null) en memoria
      if (!data.fechaFin) {
        mantenimientos.push({
          id: doc.id,
          lavadoraId: data.lavadoraId,
          tipoFalla: data.tipoFalla,
          descripcion: data.descripcion,
          costoReparacion: data.costoReparacion,
          servicioTecnico: data.servicioTecnico,
          fechaInicio: data.fechaInicio?.toDate() || new Date(),
          fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
          fechaFin: data.fechaFin?.toDate(),
          fotos: data.fotos || [],
          observaciones: data.observaciones || '',
          medioPago: data.medioPago || 'efectivo',
          createdBy: data.createdBy,
          registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el mantenimiento
          finalizadoPor: data.finalizadoPor || undefined, // ✅ Nombre del usuario que finalizó el mantenimiento
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      }
    });

    return mantenimientos;
  } catch (error) {
    console.error('Error obteniendo mantenimientos activos:', error);
    // Si hay error (colección no existe, etc.), retornar array vacío
    return [];
  }
};

// Obtener estadísticas de mantenimiento
export const obtenerEstadisticasMantenimiento = async (): Promise<{
  totalMantenimientos: number;
  mantenimientosActivos: number;
  costoTotal: number;
  lavadorasMasProblematicas: Array<{
    lavadoraId: string;
    codigoQR: string;
    cantidadMantenimientos: number;
  }>;
}> => {
  try {
    const [mantenimientosActivos, todosLosMantenimientos] = await Promise.all([
      obtenerMantenimientosActivos(),
      getDocs(collection(db, MANTENIMIENTOS_COLLECTION))
    ]);

    const mantenimientos: Mantenimiento[] = [];
    todosLosMantenimientos.forEach((doc) => {
      const data = doc.data();
      mantenimientos.push({
        id: doc.id,
        lavadoraId: data.lavadoraId,
        tipoFalla: data.tipoFalla,
        descripcion: data.descripcion,
        costoReparacion: data.costoReparacion,
        servicioTecnico: data.servicioTecnico,
        fechaInicio: data.fechaInicio?.toDate() || new Date(),
        fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
        fechaFin: data.fechaFin?.toDate(),
        fotos: data.fotos || [],
        observaciones: data.observaciones || '',
        medioPago: data.medioPago || 'efectivo',
        createdBy: data.createdBy,
        registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el mantenimiento
        finalizadoPor: data.finalizadoPor || undefined, // ✅ Nombre del usuario que finalizó el mantenimiento
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    // Calcular estadísticas
    const costoTotal = mantenimientos.reduce((sum, m) => sum + m.costoReparacion, 0);
    
    // Contar mantenimientos por lavadora
    const mantenimientosPorLavadora = mantenimientos.reduce((acc, m) => {
      acc[m.lavadoraId] = (acc[m.lavadoraId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Obtener las 5 lavadoras más problemáticas
    const lavadorasMasProblematicas = Object.entries(mantenimientosPorLavadora)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lavadoraId, cantidadMantenimientos]) => ({
        lavadoraId,
        codigoQR: `G-${lavadoraId.slice(-2)}`, // Asumiendo formato G-XX
        cantidadMantenimientos
      }));

    return {
      totalMantenimientos: mantenimientos.length,
      mantenimientosActivos: mantenimientosActivos.length,
      costoTotal,
      lavadorasMasProblematicas
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas de mantenimiento:', error);
    throw error;
  }
};

// Eliminar mantenimiento
export const eliminarMantenimiento = async (mantenimientoId: string): Promise<void> => {
  try {
    // Obtener datos del mantenimiento antes de eliminarlo
    const mantenimientoDoc = await getDoc(doc(db, MANTENIMIENTOS_COLLECTION, mantenimientoId));
    const mantenimientoData = mantenimientoDoc.exists() ? mantenimientoDoc.data() : null;

    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, MANTENIMIENTOS_COLLECTION, mantenimientoId));

    // Registrar auditoría
    if (mantenimientoData) {
      await auditoriaService.logAuditoria(
        'eliminar_mantenimiento',
        'mantenimiento',
        mantenimientoId,
        `Mantenimiento eliminado - Tipo: ${mantenimientoData.tipoFalla || 'N/A'}, Costo: $${mantenimientoData.costoReparacion?.toLocaleString() || 0}`,
        {
          lavadoraId: mantenimientoData.lavadoraId,
          tipoFalla: mantenimientoData.tipoFalla,
          descripcion: mantenimientoData.descripcion,
          costoReparacion: mantenimientoData.costoReparacion,
          servicioTecnico: mantenimientoData.servicioTecnico
        },
        undefined
      );
    }
  } catch (error) {
    console.error('Error eliminando mantenimiento:', error);
    throw error;
  }
};

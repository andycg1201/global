import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CapitalInicial, MovimientoCapital } from '../types';
import { auditoriaService } from './auditoriaService';

const CAPITAL_INICIAL_COLLECTION = 'capitalInicial';
const MOVIMIENTOS_CAPITAL_COLLECTION = 'movimientosCapital';

export const capitalService = {
  // Capital Inicial
  async getCapitalInicial(): Promise<CapitalInicial | null> {
    try {
      const q = query(
        collection(db, CAPITAL_INICIAL_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        efectivo: data.efectivo,
        nequi: data.nequi,
        daviplata: data.daviplata,
        fecha: data.fecha.toDate(),
        createdBy: data.createdBy,
        createdAt: data.createdAt.toDate()
      };
    } catch (error) {
      console.error('Error al obtener capital inicial:', error);
      throw error;
    }
  },

  async createCapitalInicial(capital: Omit<CapitalInicial, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Verificar si ya existe capital inicial
      const existing = await this.getCapitalInicial();
      if (existing) {
        throw new Error('Ya existe un capital inicial registrado. Solo se puede crear una vez.');
      }

      const docRef = await addDoc(collection(db, CAPITAL_INICIAL_COLLECTION), {
        ...capital,
        fecha: Timestamp.fromDate(capital.fecha),
        createdAt: Timestamp.now()
      });

      // Registrar auditoría
      await auditoriaService.logAuditoria(
        'crear_capital_inicial',
        'capital',
        docRef.id,
        `Capital inicial creado - Efectivo: $${capital.efectivo.toLocaleString()}, Nequi: $${capital.nequi.toLocaleString()}, Daviplata: $${capital.daviplata.toLocaleString()}`,
        undefined,
        {
          efectivo: capital.efectivo,
          nequi: capital.nequi,
          daviplata: capital.daviplata
        }
      );

      return docRef.id;
    } catch (error) {
      console.error('Error al crear capital inicial:', error);
      throw error;
    }
  },

  // Movimientos de Capital
  async getMovimientosCapital(): Promise<MovimientoCapital[]> {
    try {
      const q = query(
        collection(db, MOVIMIENTOS_CAPITAL_COLLECTION),
        orderBy('fecha', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          tipo: data.tipo,
          concepto: data.concepto,
          efectivo: data.efectivo,
          nequi: data.nequi,
          daviplata: data.daviplata,
          observaciones: data.observaciones,
          fecha: data.fecha.toDate(),
          createdBy: data.createdBy,
          createdAt: data.createdAt.toDate()
        };
      });
    } catch (error) {
      console.error('Error al obtener movimientos de capital:', error);
      throw error;
    }
  },

  async createMovimientoCapital(movimiento: Omit<MovimientoCapital, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, MOVIMIENTOS_CAPITAL_COLLECTION), {
        ...movimiento,
        fecha: Timestamp.fromDate(movimiento.fecha),
        createdAt: Timestamp.now()
      });

      // Registrar auditoría
      await auditoriaService.logAuditoria(
        'crear_movimiento_capital',
        'capital',
        docRef.id,
        `${movimiento.tipo === 'inyeccion' ? 'Inyección' : 'Retiro'} de capital - Efectivo: $${movimiento.efectivo.toLocaleString()}, Nequi: $${movimiento.nequi.toLocaleString()}, Daviplata: $${movimiento.daviplata.toLocaleString()}`,
        undefined,
        {
          tipo: movimiento.tipo,
          concepto: movimiento.concepto,
          efectivo: movimiento.efectivo,
          nequi: movimiento.nequi,
          daviplata: movimiento.daviplata,
          observaciones: movimiento.observaciones
        }
      );

      return docRef.id;
    } catch (error) {
      console.error('Error al crear movimiento de capital:', error);
      throw error;
    }
  },

  async deleteMovimientoCapital(id: string): Promise<void> {
    try {
      // Obtener datos del movimiento antes de eliminarlo
      const movimientoDoc = await getDoc(doc(db, MOVIMIENTOS_CAPITAL_COLLECTION, id));
      const movimientoData = movimientoDoc.data();
      
      await deleteDoc(doc(db, MOVIMIENTOS_CAPITAL_COLLECTION, id));

      // Registrar auditoría
      await auditoriaService.logAuditoria(
        'eliminar_movimiento_capital',
        'capital',
        id,
        `Movimiento de capital eliminado - ${movimientoData?.tipo === 'inyeccion' ? 'Inyección' : 'Retiro'} de $${(movimientoData?.efectivo || 0) + (movimientoData?.nequi || 0) + (movimientoData?.daviplata || 0)}`,
        {
          tipo: movimientoData?.tipo,
          concepto: movimientoData?.concepto,
          efectivo: movimientoData?.efectivo,
          nequi: movimientoData?.nequi,
          daviplata: movimientoData?.daviplata
        },
        undefined
      );
    } catch (error) {
      console.error('Error al eliminar movimiento de capital:', error);
      throw error;
    }
  },

  // Calcular saldos totales
  async getSaldosTotales(): Promise<{
    efectivo: number;
    nequi: number;
    daviplata: number;
    total: number;
  }> {
    try {
      const [capitalInicial, movimientos] = await Promise.all([
        this.getCapitalInicial(),
        this.getMovimientosCapital()
      ]);

      let efectivo = 0;
      let nequi = 0;
      let daviplata = 0;

      // Agregar capital inicial
      if (capitalInicial) {
        efectivo += capitalInicial.efectivo;
        nequi += capitalInicial.nequi;
        daviplata += capitalInicial.daviplata;
      }

      // Procesar movimientos
      movimientos.forEach(mov => {
        if (mov.tipo === 'inyeccion') {
          efectivo += mov.efectivo;
          nequi += mov.nequi;
          daviplata += mov.daviplata;
        } else if (mov.tipo === 'retiro') {
          efectivo -= mov.efectivo;
          nequi -= mov.nequi;
          daviplata -= mov.daviplata;
        }
      });

      return {
        efectivo,
        nequi,
        daviplata,
        total: efectivo + nequi + daviplata
      };
    } catch (error) {
      console.error('Error al calcular saldos totales:', error);
      throw error;
    }
  }
};




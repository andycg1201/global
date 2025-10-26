import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  deleteField
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { 
  Plan, 
  Cliente, 
  Pedido, 
  Lavadora,
  Gasto, 
  ConceptoGasto, 
  ReporteDiario,
  Configuracion
} from '../types';

// ===== SERVICIOS DE PLANES =====
export const planService = {
  // Obtener todos los planes activos
  async getActivePlans(): Promise<Plan[]> {
    const q = query(
      collection(db, 'planes'),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    const planes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as Plan[];
    
    // Eliminar duplicados por nombre (mantener el más reciente)
    const planesUnicos = planes.reduce((acc, plan) => {
      const existing = acc.find(p => p.name === plan.name);
      if (!existing || plan.createdAt > existing.createdAt) {
        // Si no existe o este es más reciente, reemplazar
        return acc.filter(p => p.name !== plan.name).concat(plan);
      }
      return acc;
    }, [] as Plan[]);
    
    // Ordenar en memoria para evitar necesidad de índice compuesto
    return planesUnicos.sort((a, b) => a.name.localeCompare(b.name));
  },

  // Obtener plan por ID
  async getPlanById(id: string): Promise<Plan | null> {
    const docRef = doc(db, 'planes', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date()
      } as Plan;
    }
    return null;
  },

  // Crear nuevo plan
  async createPlan(plan: Omit<Plan, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'planes'), {
      ...plan,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Actualizar plan
  async updatePlan(id: string, updates: Partial<Plan>): Promise<void> {
    const docRef = doc(db, 'planes', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }
};

// ===== SERVICIOS DE CLIENTES =====
export const clienteService = {
  // Buscar clientes por teléfono o nombre
  async searchClientes(searchTerm: string): Promise<Cliente[]> {
    const q = query(
      collection(db, 'clientes'),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    const clientes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as Cliente[];

    // Filtrar por término de búsqueda
    const clientesFiltrados = clientes.filter(cliente => 
      cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.phone.includes(searchTerm)
    );
    
    // Ordenar en memoria para evitar necesidad de índice compuesto
    return clientesFiltrados.sort((a, b) => a.name.localeCompare(b.name));
  },

  // Obtener cliente por teléfono
  async getClienteByPhone(phone: string): Promise<Cliente | null> {
    const q = query(
      collection(db, 'clientes'),
      where('phone', '==', phone),
      where('isActive', '==', true),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as Cliente;
    }
    return null;
  },

  // Obtener todos los clientes activos
  async getAllClientes(): Promise<Cliente[]> {
    const q = query(
      collection(db, 'clientes'),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as Cliente[];
  },

  // Crear nuevo cliente
  async createCliente(cliente: Omit<Cliente, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...cliente,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Actualizar cliente
  async updateCliente(id: string, updates: Partial<Cliente>): Promise<void> {
    const docRef = doc(db, 'clientes', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  // Eliminar cliente (soft delete)
  async deleteCliente(id: string): Promise<void> {
    const docRef = doc(db, 'clientes', id);
    await updateDoc(docRef, {
      isActive: false,
      deletedAt: Timestamp.now()
    });
  }
};

// ===== SERVICIOS DE PEDIDOS =====
export const pedidoService = {
  // Crear nuevo pedido
  async createPedido(pedido: Omit<Pedido, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'pedidos'), {
      ...pedido,
      fechaAsignacion: Timestamp.fromDate(pedido.fechaAsignacion),
      fechaEntrega: pedido.fechaEntrega ? Timestamp.fromDate(pedido.fechaEntrega) : null,
      fechaRecogida: pedido.fechaRecogida ? Timestamp.fromDate(pedido.fechaRecogida) : null,
      ...(pedido.fechaRecogidaCalculada && { fechaRecogidaCalculada: Timestamp.fromDate(pedido.fechaRecogidaCalculada) }),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Actualizar pedido
  async updatePedido(id: string, updates: Partial<Pedido>): Promise<void> {
    console.log('🔥 updatePedido llamado con:', { id, updates });
    const docRef = doc(db, 'pedidos', id);
    
    // Extraer campos de fecha para manejar por separado
    const { fechaEntrega, fechaRecogida, fechaRecogidaCalculada, ...otrosUpdates } = updates;
    
    const updateData: any = {
      ...otrosUpdates,
      updatedAt: Timestamp.now()
    };

    // Convertir fechas a Timestamp si existen, o eliminarlas si son undefined
    if (fechaEntrega !== undefined) {
      if (fechaEntrega) {
        updateData.fechaEntrega = Timestamp.fromDate(fechaEntrega);
        console.log('📅 fechaEntrega establecida:', updateData.fechaEntrega);
      } else {
        updateData.fechaEntrega = deleteField();
        console.log('🗑️ fechaEntrega eliminada con deleteField');
      }
    }
    if (fechaRecogida !== undefined) {
      if (fechaRecogida) {
        updateData.fechaRecogida = Timestamp.fromDate(fechaRecogida);
        console.log('📅 fechaRecogida establecida:', updateData.fechaRecogida);
      } else {
        updateData.fechaRecogida = deleteField();
        console.log('🗑️ fechaRecogida eliminada con deleteField');
      }
    }
    if (fechaRecogidaCalculada !== undefined) {
      if (fechaRecogidaCalculada) {
        updateData.fechaRecogidaCalculada = Timestamp.fromDate(fechaRecogidaCalculada);
        console.log('📅 fechaRecogidaCalculada establecida:', updateData.fechaRecogidaCalculada);
      } else {
        updateData.fechaRecogidaCalculada = deleteField();
        console.log('🗑️ fechaRecogidaCalculada eliminada con deleteField');
      }
    }

    console.log('🚀 Enviando a Firebase:', updateData);
    await updateDoc(docRef, updateData);
    console.log('✅ Actualización exitosa');
  },

  // Actualizar solo el estado del pedido
  async updatePedidoStatus(id: string, status: 'pendiente' | 'entregado' | 'recogido' | 'cancelado'): Promise<void> {
    const docRef = doc(db, 'pedidos', id);
    
    // Obtener el pedido actual para validaciones
    const pedidoDoc = await getDoc(docRef);
    if (!pedidoDoc.exists()) {
      throw new Error('Pedido no encontrado');
    }
    
    const pedidoData = pedidoDoc.data();
    
    // Validaciones estrictas de transición de estados
    if (status === 'entregado' && pedidoData.status !== 'pendiente') {
      throw new Error('No se puede marcar como entregado si no está pendiente');
    }
    
    if (status === 'recogido') {
      if (pedidoData.status !== 'entregado') {
        throw new Error('No se puede marcar como recogido si no ha sido entregado primero');
      }
      if (!pedidoData.fechaEntrega) {
        throw new Error('No se puede marcar como recogido sin fecha de entrega');
      }
    }
    
    const updateData: any = {
      status,
      updatedAt: Timestamp.now()
    };

    // Si se marca como entregado, establecer fecha de entrega y calcular fecha de recogida
    if (status === 'entregado') {
      updateData.fechaEntrega = Timestamp.now();
      const plan = pedidoData.plan;
      if (plan && plan.duration) {
        // Importar calculatePickupDate para calcular correctamente
        const { calculatePickupDate } = await import('../utils/dateUtils');
        const fechaRecogidaCalculada = calculatePickupDate(
          new Date(), 
          plan, 
          pedidoData.horasAdicionales || 0
        );
        updateData.fechaRecogidaCalculada = Timestamp.fromDate(fechaRecogidaCalculada);
      }
    }

    // Si se marca como recogido, establecer fecha de recogida
    if (status === 'recogido') {
      updateData.fechaRecogida = Timestamp.now();
    }

    await updateDoc(docRef, updateData);
  },

  // Eliminar pedido
  async deletePedido(id: string): Promise<void> {
    const docRef = doc(db, 'pedidos', id);
    await deleteDoc(docRef);
  },

  // Obtener pedidos del día
  async getPedidosDelDia(fecha: Date): Promise<Pedido[]> {
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'pedidos'),
      where('fechaAsignacion', '>=', Timestamp.fromDate(startOfDay)),
      where('fechaAsignacion', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('fechaAsignacion', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
        fechaEntrega: data.fechaEntrega?.toDate() || undefined,
        fechaRecogida: data.fechaRecogida?.toDate() || undefined,
        fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Pedido;
    });
  },

  // Obtener todos los pedidos
  async getAllPedidos(): Promise<Pedido[]> {
    const q = query(
      collection(db, 'pedidos'),
      orderBy('fechaAsignacion', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
        fechaEntrega: data.fechaEntrega?.toDate() || undefined,
        fechaRecogida: data.fechaRecogida?.toDate() || undefined,
        fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Pedido;
    });
  },

  // Obtener pedidos pendientes de recogida
  async getPedidosPendientesRecogida(): Promise<Pedido[]> {
    const now = new Date();
    // Primero obtener todos los pedidos con status 'pendiente' o 'entregado'
    const q = query(
      collection(db, 'pedidos'),
      where('status', 'in', ['pendiente', 'entregado'])
    );

    const snapshot = await getDocs(q);
    const pedidos = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
        fechaEntrega: data.fechaEntrega?.toDate() || undefined,
        fechaRecogida: data.fechaRecogida?.toDate() || undefined,
        fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Pedido;
    });

    // Filtrar y ordenar en memoria para evitar necesidad de índice compuesto
    return pedidos
      .filter(pedido => pedido.fechaRecogidaCalculada && pedido.fechaRecogidaCalculada <= now)
      .sort((a, b) => (a.fechaRecogidaCalculada?.getTime() || 0) - (b.fechaRecogidaCalculada?.getTime() || 0));
  },

  // Escuchar cambios en pedidos en tiempo real
  onPedidosChange(callback: (pedidos: Pedido[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'pedidos'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const pedidos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
          fechaEntrega: data.fechaEntrega?.toDate() || undefined,
          fechaRecogida: data.fechaRecogida?.toDate() || undefined,
          fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Pedido;
      });
      callback(pedidos);
    });
  }
};

// ===== SERVICIOS DE GASTOS =====
export const gastoService = {
  // Obtener conceptos de gastos activos
  async getConceptosActivos(): Promise<ConceptoGasto[]> {
    // Primero obtener todos los conceptos activos sin orderBy
    const q = query(
      collection(db, 'conceptosGastos'),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    const conceptos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as ConceptoGasto[];
    
    // Filtrar conceptos con nombre válido y ordenar
    return conceptos
      .filter(concepto => concepto.name && concepto.name.trim())
      .sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
  },

  // Crear nuevo concepto de gasto
  async createConcepto(concepto: Omit<ConceptoGasto, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'conceptosGastos'), {
      ...concepto,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Actualizar concepto de gasto
  async updateConcepto(id: string, updates: Partial<ConceptoGasto>): Promise<void> {
    const docRef = doc(db, 'conceptosGastos', id);
    await updateDoc(docRef, updates);
  },

  // Eliminar concepto de gasto (soft delete)
  async deleteConcepto(id: string): Promise<void> {
    const docRef = doc(db, 'conceptosGastos', id);
    await updateDoc(docRef, { isActive: false     });
  },

  // Obtener gastos de un rango de fechas
  async getGastosDelRango(fechaInicio: Date, fechaFin: Date): Promise<Gasto[]> {
    const startOfRange = new Date(fechaInicio);
    startOfRange.setHours(0, 0, 0, 0);
    
    const endOfRange = new Date(fechaFin);
    endOfRange.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'gastos'),
      where('date', '>=', Timestamp.fromDate(startOfRange)),
      where('date', '<=', Timestamp.fromDate(endOfRange)),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as Gasto;
    });
  },

  // Crear nuevo gasto
  async createGasto(gasto: Omit<Gasto, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'gastos'), {
      ...gasto,
      date: Timestamp.fromDate(gasto.date),
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Obtener gastos del día
  async getGastosDelDia(fecha: Date): Promise<Gasto[]> {
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'gastos'),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as Gasto;
    });
  },

  // Eliminar gasto
  async deleteGasto(id: string): Promise<void> {
    await deleteDoc(doc(db, 'gastos', id));
  }
};

// ===== SERVICIOS DE REPORTES =====
export const reporteService = {
  // Generar reporte diario
  async getReporteDiario(fecha: Date): Promise<ReporteDiario> {
    const [pedidos, gastos] = await Promise.all([
      pedidoService.getPedidosDelDia(fecha),
      gastoService.getGastosDelDia(fecha)
    ]);

    const ingresos = pedidos.reduce((sum, pedido) => sum + pedido.total, 0);
    const gastosTotal = gastos.reduce((sum, gasto) => sum + gasto.amount, 0);
    const pedidosCompletados = pedidos.filter(p => p.status === 'recogido').length;

    return {
      fecha,
      ingresos,
      gastos: gastosTotal,
      neto: ingresos - gastosTotal,
      pedidos: pedidos.length,
      pedidosCompletados
    };
  }
};

// ===== SERVICIOS DE CONFIGURACIÓN =====
export const configService = {
  // Obtener configuración
  async getConfiguracion(): Promise<Configuracion | null> {
    const docRef = doc(db, 'configuracion', 'general');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date()
      } as Configuracion;
    }
    return null;
  },

  // Actualizar configuración
  async updateConfiguracion(updates: Partial<Configuracion>): Promise<void> {
    const docRef = doc(db, 'configuracion', 'general');
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }
};

// ===== SERVICIO DE RESET =====
export const resetService = {
  // Eliminar todos los datos de la aplicación (excepto planes)
  async resetAllData(): Promise<void> {
    try {
      // Eliminar todos los pedidos
      const pedidosSnapshot = await getDocs(collection(db, 'pedidos'));
      const pedidosPromises = pedidosSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(pedidosPromises);

      // NO eliminar clientes - se conservan

      // Eliminar todos los gastos
      const gastosSnapshot = await getDocs(collection(db, 'gastos'));
      const gastosPromises = gastosSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(gastosPromises);

      // Eliminar todos los conceptos de gastos
      const conceptosSnapshot = await getDocs(collection(db, 'conceptosGastos'));
      const conceptosPromises = conceptosSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(conceptosPromises);

      // Eliminar capital inicial
      const capitalInicialSnapshot = await getDocs(collection(db, 'capitalInicial'));
      const capitalInicialPromises = capitalInicialSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(capitalInicialPromises);

      // Eliminar movimientos de capital (inyecciones y retiros)
      const movimientosCapitalSnapshot = await getDocs(collection(db, 'movimientosCapital'));
      const movimientosCapitalPromises = movimientosCapitalSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(movimientosCapitalPromises);

      // Eliminar todos los reportes diarios
      const reportesSnapshot = await getDocs(collection(db, 'reportesDiarios'));
      const reportesPromises = reportesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(reportesPromises);

      // Eliminar configuración
      const configSnapshot = await getDocs(collection(db, 'configuracion'));
      const configPromises = configSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(configPromises);

      // Eliminar todos los mantenimientos
      const mantenimientosSnapshot = await getDocs(collection(db, 'mantenimientos'));
      const mantenimientosPromises = mantenimientosSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(mantenimientosPromises);

      // Limpiar referencias de mantenimiento en las lavadoras
      const lavadorasSnapshot = await getDocs(collection(db, 'lavadoras'));
      const lavadorasPromises = lavadorasSnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          estado: 'disponible',
          mantenimientoActual: deleteField()
        })
      );
      await Promise.all(lavadorasPromises);

      // NOTA: Los planes y lavadoras NO se eliminan para preservar la configuración

      console.log('Todos los datos han sido eliminados exitosamente (planes, lavadoras y clientes preservados)');
    } catch (error) {
      console.error('Error al eliminar datos:', error);
      throw error;
    }
  },

  // Reinicializar datos básicos
  async initializeBasicData(): Promise<void> {
    try {
      // Verificar si ya existen planes
      const planesSnapshot = await getDocs(collection(db, 'planes'));
      
      // Solo crear planes básicos si no existen
      if (planesSnapshot.empty) {
        const planesBasicos = [
          { name: 'Plan 1 - 2 PM a 7 AM', price: 15000, duration: 17, isActive: true },
          { name: 'Plan 2 - 2 PM a 7 AM +1', price: 20000, duration: 41, isActive: true },
          { name: 'Plan 3 - 2 PM a 7 AM +2', price: 25000, duration: 65, isActive: true },
          { name: 'Plan 4 - 2 PM a 7 AM +3', price: 30000, duration: 89, isActive: true },
          { name: 'Plan 5 - 2 PM a 7 AM +4', price: 35000, duration: 113, isActive: true }
        ];

        for (const plan of planesBasicos) {
          await addDoc(collection(db, 'planes'), {
            ...plan,
            createdAt: Timestamp.now()
          });
        }
        console.log('Planes básicos creados');
      } else {
        console.log('Planes existentes preservados');
      }

      // Crear conceptos de gastos básicos
      const conceptosBasicos = [
        { title: 'Alimentación', description: 'Gastos de alimentación del personal', isActive: true },
        { title: 'Transporte', description: 'Gastos de transporte y combustible', isActive: true },
        { title: 'Mantenimiento', description: 'Gastos de mantenimiento de equipos', isActive: true },
        { title: 'Servicios Públicos', description: 'Agua, luz, gas, internet', isActive: true },
        { title: 'Otros', description: 'Otros gastos operativos', isActive: true }
      ];

      for (const concepto of conceptosBasicos) {
        await addDoc(collection(db, 'conceptosGastos'), {
          ...concepto,
          createdAt: Timestamp.now()
        });
      }

      // Crear configuración básica
      await addDoc(collection(db, 'configuracion'), {
        horaAdicional: 2000,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('Datos básicos inicializados exitosamente');
    } catch (error) {
      console.error('Error al inicializar datos básicos:', error);
      throw error;
    }
  }
};

// ===== SERVICIOS DE LAVADORAS =====
export const lavadoraService = {
  // Generar el siguiente código QR disponible
  async getNextCodigoQR(): Promise<string> {
    const lavadoras = await this.getAllLavadoras();
    const codigosExistentes = lavadoras.map(l => l.codigoQR);
    
    // Buscar el siguiente número disponible
    let numero = 1;
    while (codigosExistentes.includes(`G-${numero.toString().padStart(2, '0')}`)) {
      numero++;
    }
    
    return `G-${numero.toString().padStart(2, '0')}`;
  },

  // Crear nueva lavadora con código automático
  async createLavadora(lavadora: Omit<Lavadora, 'id' | 'codigoQR' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const codigoQR = await this.getNextCodigoQR();
    const docRef = await addDoc(collection(db, 'lavadoras'), {
      ...lavadora,
      codigoQR,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Crear lavadora con código específico (para inicialización)
  async createLavadoraWithCode(lavadora: Omit<Lavadora, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'lavadoras'), {
      ...lavadora,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Obtener todas las lavadoras
  async getAllLavadoras(): Promise<Lavadora[]> {
    const querySnapshot = await getDocs(collection(db, 'lavadoras'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        codigoQR: data.codigoQR,
        marca: data.marca,
        modelo: data.modelo,
        numeroSerie: data.numeroSerie,
        estado: data.estado,
        ubicacion: data.ubicacion,
        clienteId: data.clienteId,
        pedidoId: data.pedidoId,
        fechaInstalacion: data.fechaInstalacion?.toDate(),
        fotoInstalacion: data.fotoInstalacion,
        observacionesInstalacion: data.observacionesInstalacion,
        mantenimientoActual: data.mantenimientoActual ? {
          mantenimientoId: data.mantenimientoActual.mantenimientoId,
          fechaInicio: data.mantenimientoActual.fechaInicio?.toDate() || new Date(),
          fechaEstimadaFin: data.mantenimientoActual.fechaEstimadaFin?.toDate() || new Date(),
          tipoFalla: data.mantenimientoActual.tipoFalla,
          servicioTecnico: data.mantenimientoActual.servicioTecnico
        } : undefined,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Lavadora;
    });
  },

  // Obtener lavadora por ID
  async getLavadoraById(id: string): Promise<Lavadora | null> {
    const docRef = doc(db, 'lavadoras', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        codigoQR: data.codigoQR,
        marca: data.marca,
        modelo: data.modelo,
        numeroSerie: data.numeroSerie,
        estado: data.estado,
        ubicacion: data.ubicacion,
        clienteId: data.clienteId,
        pedidoId: data.pedidoId,
        fechaInstalacion: data.fechaInstalacion?.toDate(),
        fotoInstalacion: data.fotoInstalacion,
        observacionesInstalacion: data.observacionesInstalacion,
        mantenimientoActual: data.mantenimientoActual ? {
          mantenimientoId: data.mantenimientoActual.mantenimientoId,
          fechaInicio: data.mantenimientoActual.fechaInicio?.toDate() || new Date(),
          fechaEstimadaFin: data.mantenimientoActual.fechaEstimadaFin?.toDate() || new Date(),
          tipoFalla: data.mantenimientoActual.tipoFalla,
          servicioTecnico: data.mantenimientoActual.servicioTecnico
        } : undefined,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Lavadora;
    }
    return null;
  },

  // Obtener lavadora por código QR
  async getLavadoraByQR(codigoQR: string): Promise<Lavadora | null> {
    const q = query(
      collection(db, 'lavadoras'),
      where('codigoQR', '==', codigoQR)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        codigoQR: data.codigoQR,
        marca: data.marca,
        modelo: data.modelo,
        numeroSerie: data.numeroSerie,
        estado: data.estado,
        ubicacion: data.ubicacion,
        clienteId: data.clienteId,
        pedidoId: data.pedidoId,
        fechaInstalacion: data.fechaInstalacion?.toDate(),
        fotoInstalacion: data.fotoInstalacion,
        observacionesInstalacion: data.observacionesInstalacion,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Lavadora;
    }
    return null;
  },

  // Actualizar lavadora
  async updateLavadora(id: string, updates: Partial<Lavadora>): Promise<void> {
    console.log('🔄 updateLavadora llamado con:', { id, updates });
    
    const docRef = doc(db, 'lavadoras', id);
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    // Convertir fechas a Timestamp
    if (updates.fechaInstalacion) {
      updateData.fechaInstalacion = Timestamp.fromDate(updates.fechaInstalacion);
    }

    console.log('📝 Datos a actualizar:', updateData);
    
    try {
      await updateDoc(docRef, updateData);
      console.log('✅ Lavadora actualizada exitosamente:', id);
    } catch (error) {
      console.error('❌ Error al actualizar lavadora:', error);
      throw error;
    }
  },

  // Obtener lavadoras disponibles
  async getLavadorasDisponibles(): Promise<Lavadora[]> {
    const q = query(
      collection(db, 'lavadoras'),
      where('estado', '==', 'disponible')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        codigoQR: data.codigoQR,
        marca: data.marca,
        modelo: data.modelo,
        numeroSerie: data.numeroSerie,
        estado: data.estado,
        ubicacion: data.ubicacion,
        clienteId: data.clienteId,
        pedidoId: data.pedidoId,
        fechaInstalacion: data.fechaInstalacion?.toDate(),
        fotoInstalacion: data.fotoInstalacion,
        observacionesInstalacion: data.observacionesInstalacion,
        mantenimientoActual: data.mantenimientoActual ? {
          mantenimientoId: data.mantenimientoActual.mantenimientoId,
          fechaInicio: data.mantenimientoActual.fechaInicio?.toDate() || new Date(),
          fechaEstimadaFin: data.mantenimientoActual.fechaEstimadaFin?.toDate() || new Date(),
          tipoFalla: data.mantenimientoActual.tipoFalla,
          servicioTecnico: data.mantenimientoActual.servicioTecnico
        } : undefined,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Lavadora;
    });
  },

  // Eliminar lavadora
  async deleteLavadora(id: string): Promise<void> {
    const docRef = doc(db, 'lavadoras', id);
    await deleteDoc(docRef);
  },

  // Crear las 15 lavadoras iniciales
  async createInitialLavadoras(userId: string): Promise<void> {
    const lavadorasExistentes = await this.getAllLavadoras();
    
    // Solo crear si no hay lavadoras existentes
    if (lavadorasExistentes.length > 0) {
      console.log('Ya existen lavadoras en el sistema');
      return;
    }

    console.log('Creando 15 lavadoras iniciales...');
    
    for (let i = 1; i <= 15; i++) {
      const codigoQR = `G-${i.toString().padStart(2, '0')}`;
      await this.createLavadoraWithCode({
        codigoQR,
        marca: 'LG',
        modelo: '18kg',
        numeroSerie: `LG18-${i.toString().padStart(2, '0')}`,
        estado: 'disponible',
        ubicacion: 'bodega',
        createdBy: userId
      });
    }
    
    console.log('15 lavadoras iniciales creadas exitosamente');
  }
};

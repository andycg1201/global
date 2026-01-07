import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
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
import { auditoriaService } from './auditoriaService';

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
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || null
    })) as (Plan & { updatedAt: Date | null })[];
    
    // Detectar duplicados para debugging (temporal)
    const nombresPlanes = planes.map(p => p.name);
    const duplicados = nombresPlanes.filter((name, index) => nombresPlanes.indexOf(name) !== index);
    if (duplicados.length > 0) {
      console.warn('⚠️ Planes duplicados detectados:', [...new Set(duplicados)]);
      console.warn('Total planes encontrados:', planes.length);
    }
    
    // Eliminar duplicados por nombre (priorizar el más recientemente actualizado)
    const planesUnicos = planes.reduce((acc, plan) => {
      const existing = acc.find(p => p.name === plan.name);
      if (!existing) {
        // Si no existe, agregarlo
        return acc.concat(plan);
      }
      
      // Comparar: primero por updatedAt, luego por createdAt
      const planUpdatedAt = plan.updatedAt || null;
      const existingUpdatedAt = existing.updatedAt || null;
      
      // Si ambos tienen updatedAt, usar el más reciente
      if (planUpdatedAt && existingUpdatedAt) {
        if (planUpdatedAt > existingUpdatedAt) {
          return acc.filter(p => p.name !== plan.name).concat(plan);
        }
        return acc; // Mantener el existente
      }
      
      // Si solo uno tiene updatedAt, priorizar ese
      if (planUpdatedAt && !existingUpdatedAt) {
        return acc.filter(p => p.name !== plan.name).concat(plan);
      }
      if (!planUpdatedAt && existingUpdatedAt) {
        return acc; // Mantener el existente que tiene updatedAt
      }
      
      // Si ninguno tiene updatedAt, usar createdAt (comportamiento original)
      if (plan.createdAt > existing.createdAt) {
        return acc.filter(p => p.name !== plan.name).concat(plan);
      }
      return acc; // Mantener el existente
    }, [] as (Plan & { updatedAt: Date | null })[]);
    
    // Remover updatedAt del resultado final (no es parte de la interfaz Plan)
    const planesFinales = planesUnicos.map(({ updatedAt, ...plan }) => plan) as Plan[];
    
    // Ordenar en memoria para evitar necesidad de índice compuesto
    return planesFinales.sort((a, b) => a.name.localeCompare(b.name));
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
  },

  // Limpiar planes duplicados (mantener solo el más recientemente actualizado)
  async limpiarPlanesDuplicados(): Promise<{ planesDesactivados: number; planesMantenidos: number }> {
    try {
      // Obtener todos los planes activos
      const q = query(
        collection(db, 'planes'),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      
      const planes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || null
      })) as (Plan & { updatedAt: Date | null })[];
      
      // Agrupar por nombre
      const planesPorNombre = new Map<string, (Plan & { updatedAt: Date | null })[]>();
      planes.forEach(plan => {
        const nombre = plan.name;
        if (!planesPorNombre.has(nombre)) {
          planesPorNombre.set(nombre, []);
        }
        planesPorNombre.get(nombre)!.push(plan);
      });
      
      let planesDesactivados = 0;
      let planesMantenidos = 0;
      
      // Para cada grupo de planes con el mismo nombre
      for (const [nombre, planesGrupo] of planesPorNombre.entries()) {
        if (planesGrupo.length <= 1) {
          // No hay duplicados para este nombre
          planesMantenidos += planesGrupo.length;
          continue;
        }
        
        // Encontrar el plan más reciente (priorizar updatedAt)
        const planMantener = planesGrupo.reduce((mejor, actual) => {
          const mejorUpdatedAt = mejor.updatedAt || null;
          const actualUpdatedAt = actual.updatedAt || null;
          
          // Si ambos tienen updatedAt, usar el más reciente
          if (mejorUpdatedAt && actualUpdatedAt) {
            return actualUpdatedAt > mejorUpdatedAt ? actual : mejor;
          }
          
          // Si solo uno tiene updatedAt, priorizar ese
          if (actualUpdatedAt && !mejorUpdatedAt) {
            return actual;
          }
          if (!actualUpdatedAt && mejorUpdatedAt) {
            return mejor;
          }
          
          // Si ninguno tiene updatedAt, usar createdAt
          return actual.createdAt > mejor.createdAt ? actual : mejor;
        });
        
        // Marcar los demás como inactivos
        for (const plan of planesGrupo) {
          if (plan.id !== planMantener.id) {
            await updateDoc(doc(db, 'planes', plan.id), {
              isActive: false
            });
            planesDesactivados++;
          } else {
            planesMantenidos++;
          }
        }
      }
      
      return { planesDesactivados, planesMantenidos };
    } catch (error) {
      console.error('Error al limpiar planes duplicados:', error);
      throw error;
    }
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
    
    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'crear_cliente',
      'cliente',
      docRef.id,
      `Cliente ${cliente.name} creado - Teléfono: ${cliente.phone}`,
      undefined,
      {
        name: cliente.name,
        phone: cliente.phone,
        address: cliente.address
      }
    );
    
    return docRef.id;
  },

  // Actualizar cliente
  async updateCliente(id: string, updates: Partial<Cliente>): Promise<void> {
    const docRef = doc(db, 'clientes', id);
    
    // Obtener datos anteriores para auditoría
    const clienteDoc = await getDoc(docRef);
    const valoresAnteriores = clienteDoc.data();
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'editar_cliente',
      'cliente',
      id,
      `Cliente ${valoresAnteriores?.name || 'Actualizado'} modificado`,
      valoresAnteriores,
      updates
    );
  },

  // Eliminar cliente (soft delete)
  async deleteCliente(id: string): Promise<void> {
    const docRef = doc(db, 'clientes', id);
    
    // Obtener datos del cliente para auditoría
    const clienteDoc = await getDoc(docRef);
    const clienteData = clienteDoc.data();
    
    await updateDoc(docRef, {
      isActive: false,
      deletedAt: Timestamp.now()
    });
    
    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'eliminar_cliente',
      'cliente',
      id,
      `Cliente ${clienteData?.name || 'Desconocido'} eliminado`,
      clienteData,
      { isActive: false, deletedAt: new Date() }
    );
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
    
    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'crear_servicio',
      'pedido',
      docRef.id,
      `Servicio creado para cliente ${pedido.cliente.name} con plan ${pedido.plan.name}`,
      undefined,
      {
        cliente: pedido.cliente.name,
        plan: pedido.plan.name,
        total: pedido.total,
        status: pedido.status
      }
    );
    
    return docRef.id;
  },

  // Actualizar pedido
  async updatePedido(id: string, updates: Partial<Pedido>): Promise<void> {
    const docRef = doc(db, 'pedidos', id);
    
    // Obtener datos anteriores para auditoría
    const docSnapshot = await getDoc(docRef);
    const datosAnteriores = docSnapshot.exists() ? docSnapshot.data() : null;
    
    // Extraer campos de fecha para manejar por separado
    const { fechaEntrega, fechaRecogida, fechaRecogidaCalculada, pagosRealizados, ...otrosUpdates } = updates;
    
    const updateData: any = {
      ...otrosUpdates,
      updatedAt: Timestamp.now()
    };

    // Convertir fechas a Timestamp si existen, o eliminarlas si son undefined
    if (fechaEntrega !== undefined) {
      if (fechaEntrega) {
        updateData.fechaEntrega = Timestamp.fromDate(fechaEntrega);
      } else {
        updateData.fechaEntrega = deleteField();
      }
    }
    if (fechaRecogida !== undefined) {
      if (fechaRecogida) {
        updateData.fechaRecogida = Timestamp.fromDate(fechaRecogida);
      } else {
        updateData.fechaRecogida = deleteField();
      }
    }
    if (fechaRecogidaCalculada !== undefined) {
      if (fechaRecogidaCalculada) {
        updateData.fechaRecogidaCalculada = Timestamp.fromDate(fechaRecogidaCalculada);
      } else {
        updateData.fechaRecogidaCalculada = deleteField();
      }
    }

    // Convertir fechas de pagosRealizados a Timestamp
    if (pagosRealizados !== undefined && Array.isArray(pagosRealizados)) {
      updateData.pagosRealizados = pagosRealizados.map((pago: any) => ({
        ...pago,
        fecha: pago.fecha instanceof Date 
          ? Timestamp.fromDate(pago.fecha)
          : pago.fecha?.toDate 
            ? pago.fecha 
            : pago.fecha 
              ? Timestamp.fromDate(new Date(pago.fecha))
              : Timestamp.now()
      }));
    }

    await updateDoc(docRef, updateData);
    
    // Detectar si hay un nuevo pago para registrar auditoría específica
    if (updates.pagosRealizados && Array.isArray(updates.pagosRealizados)) {
      const pagosAnteriores = datosAnteriores?.pagosRealizados || [];
      const nuevosPagos = updates.pagosRealizados;
      
      // Si hay un nuevo pago
      if (nuevosPagos.length > pagosAnteriores.length) {
        const ultimoPago = nuevosPagos[nuevosPagos.length - 1];
        await auditoriaService.logAuditoria(
          'registrar_pago',
          'pedido',
          id,
          `Pago registrado: $${ultimoPago.monto?.toLocaleString() || 0} por ${ultimoPago.medioPago} ${ultimoPago.isPartial ? '(Parcial)' : '(Total)'}`,
          undefined,
          {
            monto: ultimoPago.monto,
            medioPago: ultimoPago.medioPago,
            isPartial: ultimoPago.isPartial
          }
        );
      }
    } else {
      // Registrar auditoría genérica para otras modificaciones
      await auditoriaService.logAuditoria(
        'modificar_servicio',
        'pedido',
        id,
        `Servicio modificado - cambios: ${Object.keys(updates).join(', ')}`,
        datosAnteriores ? {
          status: datosAnteriores.status,
          total: datosAnteriores.total,
          fechaEntrega: datosAnteriores.fechaEntrega?.toDate?.() || datosAnteriores.fechaEntrega,
          fechaRecogida: datosAnteriores.fechaRecogida?.toDate?.() || datosAnteriores.fechaRecogida
        } : undefined,
        {
          status: updates.status,
          total: updates.total,
          fechaEntrega: updates.fechaEntrega,
          fechaRecogida: updates.fechaRecogida
        }
      );
    }
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
    
    // Función auxiliar para obtener el nombre del usuario actual
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
    
    const updateData: any = {
      status,
      updatedAt: Timestamp.now()
    };

    // Si se marca como entregado, establecer fecha de entrega y calcular fecha de recogida
    if (status === 'entregado') {
      updateData.fechaEntrega = Timestamp.now();
      updateData.entregadoPor = getCurrentUserName(); // ✅ Nombre del usuario que realizó la entrega
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

    // Si se marca como recogido, establecer fecha de recogida y usuario
    if (status === 'recogido') {
      updateData.fechaRecogida = Timestamp.now();
      updateData.recogidoPor = getCurrentUserName(); // ✅ Nombre del usuario que realizó la recogida
    }

    await updateDoc(docRef, updateData);
    
    // Registrar auditoría
    const accionAuditoria = status === 'entregado' ? 'entregar_servicio' : 
                           status === 'recogido' ? 'recoger_servicio' : 
                           'modificar_servicio';
    
    await auditoriaService.logAuditoria(
      accionAuditoria,
      'pedido',
      id,
      `Estado del servicio cambiado a: ${status}`,
      { status: pedidoData.status },
      { status: status }
    );
  },

  // Eliminar pedido
  async deletePedido(id: string): Promise<void> {
    const docRef = doc(db, 'pedidos', id);
    
    // Obtener datos del pedido antes de eliminar para auditoría
    const docSnapshot = await getDoc(docRef);
    const pedidoData = docSnapshot.exists() ? docSnapshot.data() : null;
    
    await deleteDoc(docRef);
    
    // Registrar auditoría
    if (pedidoData) {
      await auditoriaService.logAuditoria(
        'eliminar_servicio',
        'pedido',
        id,
        `Servicio eliminado - Cliente: ${pedidoData.cliente?.name || 'N/A'}`,
        {
          cliente: pedidoData.cliente?.name,
          plan: pedidoData.plan?.name,
          total: pedidoData.total,
          status: pedidoData.status
        },
        undefined
      );
    }
  },

  // Marcar pedido como eliminado (para auditoría)
  async marcarComoEliminado(id: string, eliminadoPor: string, motivo?: string): Promise<void> {
    const docRef = doc(db, 'pedidos', id);
    
    // Obtener datos del pedido antes de marcar como eliminado
    const docSnapshot = await getDoc(docRef);
    const pedidoData = docSnapshot.exists() ? docSnapshot.data() : null;
    
    await updateDoc(docRef, {
      eliminado: true,
      fechaEliminacion: Timestamp.fromDate(new Date()),
      eliminadoPor: eliminadoPor,
      motivoEliminacion: motivo || '',
      updatedAt: Timestamp.fromDate(new Date())
    });
    
    // Registrar auditoría
    if (pedidoData) {
      await auditoriaService.logAuditoria(
        'eliminar_servicio',
        'pedido',
        id,
        `Servicio eliminado - Cliente: ${pedidoData.cliente?.name || 'N/A'}${motivo ? ` - Motivo: ${motivo}` : ''}`,
        {
          cliente: pedidoData.cliente?.name,
          plan: pedidoData.plan?.name,
          total: pedidoData.total,
          status: pedidoData.status
        },
        undefined
      );
    }
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
      
      // Convertir fechas de pagosRealizados de Timestamp a Date
      const pagosRealizadosConvertidos = (data.pagosRealizados || []).map((pago: any) => ({
        ...pago,
        fecha: pago.fecha?.toDate ? pago.fecha.toDate() : pago.fecha instanceof Date ? pago.fecha : pago.fecha ? new Date(pago.fecha) : new Date()
      }));

      return {
        id: doc.id,
        ...data,
        pagosRealizados: pagosRealizadosConvertidos,
        fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
        fechaEntrega: data.fechaEntrega?.toDate() || undefined,
        fechaRecogida: data.fechaRecogida?.toDate() || undefined,
        fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
        entregadoPor: data.entregadoPor || undefined, // ✅ Nombre del usuario que realizó la entrega
        recogidoPor: data.recogidoPor || undefined, // ✅ Nombre del usuario que realizó la recogida
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as Pedido;
    });
  },

  // Obtener todos los pedidos (excluyendo eliminados)
  async getAllPedidos(): Promise<Pedido[]> {
    const q = query(
      collection(db, 'pedidos'),
      orderBy('fechaAsignacion', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .filter(doc => {
        const data = doc.data();
        return !data.eliminado; // Excluir pedidos eliminados
      })
      .map(doc => {
        const data = doc.data();
        
        // Construir objeto lavadoraAsignada si existe
        let lavadoraAsignada = undefined;
        if (data.lavadoraAsignada_lavadoraId) {
          lavadoraAsignada = {
            lavadoraId: data.lavadoraAsignada_lavadoraId,
            codigoQR: data.lavadoraAsignada_codigoQR || '',
            marca: data.lavadoraAsignada_marca || '',
            modelo: data.lavadoraAsignada_modelo || '',
            fotoInstalacion: data.lavadoraAsignada_fotoInstalacion || '',
            observacionesInstalacion: data.lavadoraAsignada_observacionesInstalacion || ''
          };
        }
        
        // Convertir fechas de pagosRealizados de Timestamp a Date
        const pagosRealizadosConvertidos = (data.pagosRealizados || []).map((pago: any) => ({
          ...pago,
          fecha: pago.fecha?.toDate ? pago.fecha.toDate() : pago.fecha instanceof Date ? pago.fecha : pago.fecha ? new Date(pago.fecha) : new Date()
        }));

        return {
          id: doc.id,
          ...data,
          pagosRealizados: pagosRealizadosConvertidos,
          lavadoraAsignada,
          fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
          fechaEntrega: data.fechaEntrega?.toDate() || undefined,
          fechaRecogida: data.fechaRecogida?.toDate() || undefined,
          fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
          fechaEliminacion: data.fechaEliminacion?.toDate() || undefined,
          entregadoPor: data.entregadoPor || undefined, // ✅ Nombre del usuario que realizó la entrega
          recogidoPor: data.recogidoPor || undefined, // ✅ Nombre del usuario que realizó la recogida
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Pedido;
      });
  },

  // Obtener todos los pedidos (incluyendo eliminados para auditoría)
  async getAllPedidosConEliminados(): Promise<Pedido[]> {
    const q = query(
      collection(db, 'pedidos'),
      orderBy('fechaAsignacion', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Construir objeto lavadoraAsignada si existe
      let lavadoraAsignada = undefined;
      if (data.lavadoraAsignada_lavadoraId) {
        lavadoraAsignada = {
          lavadoraId: data.lavadoraAsignada_lavadoraId,
          codigoQR: data.lavadoraAsignada_codigoQR || '',
          marca: data.lavadoraAsignada_marca || '',
          modelo: data.lavadoraAsignada_modelo || '',
          fotoInstalacion: data.lavadoraAsignada_fotoInstalacion || '',
          observacionesInstalacion: data.lavadoraAsignada_observacionesInstalacion || ''
        };
      }
      
      // Convertir fechas de pagosRealizados de Timestamp a Date
      const pagosRealizadosConvertidos = (data.pagosRealizados || []).map((pago: any) => ({
        ...pago,
        fecha: pago.fecha?.toDate ? pago.fecha.toDate() : pago.fecha instanceof Date ? pago.fecha : pago.fecha ? new Date(pago.fecha) : new Date()
      }));

      return {
        id: doc.id,
        ...data,
        pagosRealizados: pagosRealizadosConvertidos,
        lavadoraAsignada,
        fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
        fechaEntrega: data.fechaEntrega?.toDate() || undefined,
        fechaRecogida: data.fechaRecogida?.toDate() || undefined,
        fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
        fechaEliminacion: data.fechaEliminacion?.toDate() || undefined,
        entregadoPor: data.entregadoPor || undefined, // ✅ Nombre del usuario que realizó la entrega
        recogidoPor: data.recogidoPor || undefined, // ✅ Nombre del usuario que realizó la recogida
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
      
      // Construir objeto lavadoraAsignada si existe
      let lavadoraAsignada = undefined;
      if (data.lavadoraAsignada_lavadoraId) {
        lavadoraAsignada = {
          lavadoraId: data.lavadoraAsignada_lavadoraId,
          codigoQR: data.lavadoraAsignada_codigoQR || '',
          marca: data.lavadoraAsignada_marca || '',
          modelo: data.lavadoraAsignada_modelo || '',
          fotoInstalacion: data.lavadoraAsignada_fotoInstalacion || '',
          observacionesInstalacion: data.lavadoraAsignada_observacionesInstalacion || ''
        };
      }
      
      // Convertir fechas de pagosRealizados de Timestamp a Date
      const pagosRealizadosConvertidos = (data.pagosRealizados || []).map((pago: any) => ({
        ...pago,
        fecha: pago.fecha?.toDate ? pago.fecha.toDate() : pago.fecha instanceof Date ? pago.fecha : pago.fecha ? new Date(pago.fecha) : new Date()
      }));

      return {
        id: doc.id,
        ...data,
        pagosRealizados: pagosRealizadosConvertidos,
        lavadoraAsignada,
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
        
        // Convertir fechas de pagosRealizados de Timestamp a Date
        const pagosRealizadosConvertidos = (data.pagosRealizados || []).map((pago: any) => ({
          ...pago,
          fecha: pago.fecha?.toDate ? pago.fecha.toDate() : pago.fecha instanceof Date ? pago.fecha : pago.fecha ? new Date(pago.fecha) : new Date()
        }));

        return {
          id: doc.id,
          ...data,
          pagosRealizados: pagosRealizadosConvertidos,
          fechaAsignacion: data.fechaAsignacion?.toDate() || new Date(),
          fechaEntrega: data.fechaEntrega?.toDate() || undefined,
          fechaRecogida: data.fechaRecogida?.toDate() || undefined,
          fechaRecogidaCalculada: data.fechaRecogidaCalculada?.toDate() || new Date(),
          entregadoPor: data.entregadoPor || undefined, // ✅ Nombre del usuario que realizó la entrega
          recogidoPor: data.recogidoPor || undefined, // ✅ Nombre del usuario que realizó la recogida
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
        registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el gasto
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
    
    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'crear_gasto',
      'gasto',
      docRef.id,
      `Gasto de $${gasto.amount.toLocaleString()} por concepto: ${gasto.concepto.name}`,
      undefined,
      {
        concepto: gasto.concepto.name,
        amount: gasto.amount,
        medioPago: gasto.medioPago,
        description: gasto.description
      }
    );
    
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
        registradoPor: data.registradoPor || undefined, // ✅ Nombre del usuario que registró el gasto
        createdAt: data.createdAt?.toDate() || new Date()
      } as Gasto;
    });
  },

  // Eliminar gasto
  async deleteGasto(id: string): Promise<void> {
    // Obtener datos del gasto para auditoría antes de eliminarlo
    const gastoDoc = await getDoc(doc(db, 'gastos', id));
    const gastoData = gastoDoc.data();
    
    await deleteDoc(doc(db, 'gastos', id));
    
    // Registrar auditoría
    await auditoriaService.logAuditoria(
      'eliminar_gasto',
      'gasto',
      id,
      `Gasto eliminado: ${gastoData?.concepto?.name || 'Concepto desconocido'} - $${gastoData?.amount?.toLocaleString() || 0}`,
      gastoData,
      undefined
    );
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
  // Obtener configuración (busca cualquier documento en la colección, debería haber solo uno)
  async getConfiguracion(): Promise<Configuracion | null> {
    try {
      // Primero intentar con ID "general"
      const docRefGeneral = doc(db, 'configuracion', 'general');
      const docSnapGeneral = await getDoc(docRefGeneral);
      if (docSnapGeneral.exists()) {
        return {
          id: docSnapGeneral.id,
          ...docSnapGeneral.data(),
          updatedAt: docSnapGeneral.data().updatedAt?.toDate() || new Date()
        } as Configuracion;
      }
      
      // Si no existe "general", buscar cualquier documento en la colección
      const configSnapshot = await getDocs(collection(db, 'configuracion'));
      if (!configSnapshot.empty) {
        const firstDoc = configSnapshot.docs[0];
        return {
          id: firstDoc.id,
          ...firstDoc.data(),
          updatedAt: firstDoc.data().updatedAt?.toDate() || new Date()
        } as Configuracion;
      }
      
      return null;
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      return null;
    }
  },

  // Actualizar configuración (crea o actualiza el documento)
  async updateConfiguracion(updates: Partial<Configuracion>): Promise<void> {
    try {
      // Primero intentar obtener el documento existente
      const config = await this.getConfiguracion();
      
      let docRef: ReturnType<typeof doc>;
      
      if (config && config.id) {
        // Usar el ID del documento existente
        docRef = doc(db, 'configuracion', config.id);
      } else {
        // Si no existe, crear uno nuevo con ID "general"
        docRef = doc(db, 'configuracion', 'general');
      }
      
      // Usar setDoc con merge para crear o actualizar
      await setDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      throw error;
    }
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
      return;
    }
    
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

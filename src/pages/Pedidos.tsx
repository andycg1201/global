import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardDocumentListIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  CalendarIcon,
  XMarkIcon,
  CameraIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  HomeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { pedidoService, configService, lavadoraService } from '../services/firebaseService';
import { usuarioService } from '../services/usuarioService';
import { entregaOperativaService } from '../services/entregaOperativaService';
import { recogidaOperativaService } from '../services/recogidaOperativaService';
import { modificacionesService } from '../services/modificacionesService';
import { useAuth } from '../contexts/AuthContext';
import { Pedido } from '../types';
import { formatDate, formatCurrency, calculatePickupDate, getCurrentDateColombia } from '../utils/dateUtils';
import { generarTimelineServicio, formatearFechaTimeline } from '../utils/timelineUtils';
import NuevoPedido from './NuevoPedido';
import ModalCancelacion from '../components/ModalCancelacion';
import ModalLiquidacion from '../components/ModalLiquidacion';
import ModalLiquidacionUniversal from '../components/ModalLiquidacionUniversal';
import ModalEntregaOperativa from '../components/ModalEntregaOperativa';
import ModalRecogidaOperativa from '../components/ModalRecogidaOperativa';
import ModalFotoInstalacion from '../components/ModalFotoInstalacion';
import ModalWhatsApp from '../components/ModalWhatsApp';
import ModalModificacionesServicio from '../components/ModalModificacionesServicio';
import ModalPagos from '../components/ModalPagos';
import ResumenFinalServicio from '../components/ResumenFinalServicio';
import CalendarioHorarios from '../components/CalendarioHorarios';
import EstadoLavadorasModal from '../components/EstadoLavadorasModal';

interface FiltrosPedidos {
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  tipoFiltro: 'hoy' | 'ayer' | 'semana' | 'personalizado';
}

const Pedidos: React.FC = () => {
  const { firebaseUser, user, tienePermiso } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarNuevoPedido, setMostrarNuevoPedido] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [nombreCreadorPedido, setNombreCreadorPedido] = useState<string | null>(null);
  const [nombresUsuarios, setNombresUsuarios] = useState<Map<string, string>>(new Map());
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [pedidoACancelar, setPedidoACancelar] = useState<Pedido | null>(null);
  
  // Estados para modales de liquidación
  const [mostrarModalLiquidacion, setMostrarModalLiquidacion] = useState(false);
  const [mostrarModalLiquidacionUniversal, setMostrarModalLiquidacionUniversal] = useState(false);
  const [pedidoAFacturar, setPedidoAFacturar] = useState<Pedido | null>(null);
  const [pedidoALiquidar, setPedidoALiquidar] = useState<Pedido | null>(null);
  const [configuracion, setConfiguracion] = useState<any>(null);
  
  // Estados para validación QR
  const [mostrarModalEntregaOperativa, setMostrarModalEntregaOperativa] = useState(false);
  const [pedidoAValidar, setPedidoAValidar] = useState<Pedido | null>(null);
  const [lavadoras, setLavadoras] = useState<any[]>([]);
  
  // Estados para recogida operativa
  const [mostrarModalRecogidaOperativa, setMostrarModalRecogidaOperativa] = useState(false);
  const [pedidoParaRecogida, setPedidoParaRecogida] = useState<Pedido | null>(null);
  
  // Estados para calendario de horarios
  const [mostrarCalendarioHorarios, setMostrarCalendarioHorarios] = useState(false);
  
  // Estados para modal de estado de lavadoras
  const [mostrarEstadoLavadoras, setMostrarEstadoLavadoras] = useState(false);
  
  // Estados para modal de foto de instalación
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [pedidoParaFoto, setPedidoParaFoto] = useState<Pedido | null>(null);
  
  // Estados para WhatsApp
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [pedidoParaWhatsApp, setPedidoParaWhatsApp] = useState<Pedido | null>(null);
  const [fotoEvidenciaWhatsApp, setFotoEvidenciaWhatsApp] = useState<string | null>(null);
  
  // Estados para modales de modificaciones dinámicas
  const [mostrarModalModificaciones, setMostrarModalModificaciones] = useState(false);
  const [mostrarResumenFinal, setMostrarResumenFinal] = useState(false);
  const [pedidoParaModificar, setPedidoParaModificar] = useState<Pedido | null>(null);
  
  // Estados para pagos
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [pedidoParaPago, setPedidoParaPago] = useState<Pedido | null>(null);
  
  // Estados para planes
  const [planes, setPlanes] = useState<any[]>([]);
  
  
  const [filtros, setFiltros] = useState<FiltrosPedidos>({
    fechaInicio: (() => {
      const hoy = getCurrentDateColombia();
      return hoy;
    })(),
    fechaFin: (() => {
      const hoy = getCurrentDateColombia();
      return hoy;
    })(),
    estado: 'todos',
    tipoFiltro: 'hoy'
  });

  useEffect(() => {
    cargarPedidos();
    cargarConfiguracion();
    cargarLavadoras();
    cargarPlanes();
  }, [filtros]);

  // Obtener nombre del creador del pedido cuando se selecciona
  useEffect(() => {
    const obtenerNombreCreador = async () => {
      if (pedidoSeleccionado && pedidoSeleccionado.createdBy) {
        // Si el usuario actual es el creador, usar su nombre directamente
        if (user && firebaseUser?.uid === pedidoSeleccionado.createdBy) {
          setNombreCreadorPedido(user.name);
        } else {
          // Buscar el usuario desde su ID
          try {
            const usuarioCreador = await usuarioService.getUsuarioById(pedidoSeleccionado.createdBy);
            if (usuarioCreador) {
              setNombreCreadorPedido(usuarioCreador.name);
            } else {
              setNombreCreadorPedido(null);
            }
          } catch (error) {
            console.error('Error al obtener nombre del creador:', error);
            setNombreCreadorPedido(null);
          }
        }
      } else {
        setNombreCreadorPedido(null);
      }
    };

    obtenerNombreCreador();
  }, [pedidoSeleccionado, user, firebaseUser]);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      // Obtener todos los pedidos de una vez (más eficiente que múltiples consultas)
      const todosLosPedidos = await pedidoService.getAllPedidos();
      console.log('🔍 Total pedidos cargados desde Firebase:', todosLosPedidos.length);
      
      // Cargar modificaciones para cada pedido
      const pedidosConModificaciones = await Promise.all(
        todosLosPedidos.map(async (pedido) => {
          try {
            const modificaciones = await modificacionesService.obtenerModificacionesPorPedido(pedido.id);
            return {
              ...pedido,
              modificacionesServicio: modificaciones
            };
          } catch (error) {
            console.error(`Error cargando modificaciones para pedido ${pedido.id}:`, error);
            return pedido;
          }
        })
      );
      
      // Filtrar por rango de fechas localmente
      const fechaInicio = new Date(filtros.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(filtros.fechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      
      console.log('📅 Rango de fechas:', fechaInicio.toISOString(), 'a', fechaFin.toISOString());
      
      const pedidosFiltradosPorFecha = pedidosConModificaciones.filter(pedido => {
        const fechaPedido = new Date(pedido.fechaAsignacion);
        const dentroDelRango = fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
        
        // Log para pedidos con lavadora asignada
        if (pedido.lavadoraAsignada) {
          console.log(`🔍 Pedido ${pedido.id} con lavadora ${pedido.lavadoraAsignada.codigoQR}:`, {
            fechaAsignacion: pedido.fechaAsignacion,
            fechaPedido: fechaPedido.toISOString(),
            dentroDelRango,
            estado: pedido.status,
            modificaciones: pedido.modificacionesServicio?.length || 0
          });
        }
        
        return dentroDelRango;
      });
      
      console.log('📊 Pedidos después del filtro de fecha:', pedidosFiltradosPorFecha.length);
      setPedidos(pedidosFiltradosPorFecha);

      // Cargar nombres de usuarios únicos de los pedidos
      const uidsUnicos = new Set<string>();
      pedidosFiltradosPorFecha.forEach(pedido => {
        if (pedido.createdBy) {
          uidsUnicos.add(pedido.createdBy);
        }
      });

      // Si el usuario actual está en la lista, usar su nombre directamente
      const nombresMap = new Map<string, string>();
      if (user && firebaseUser?.uid) {
        nombresMap.set(firebaseUser.uid, user.name);
      }

      // Cargar nombres de los demás usuarios
      const promesasUsuarios = Array.from(uidsUnicos)
        .filter(uid => uid !== firebaseUser?.uid)
        .map(async (uid) => {
          try {
            const usuario = await usuarioService.getUsuarioById(uid);
            if (usuario) {
              nombresMap.set(uid, usuario.name);
            }
          } catch (error) {
            console.error(`Error cargando usuario ${uid}:`, error);
          }
        });

      await Promise.all(promesasUsuarios);
      setNombresUsuarios(nombresMap);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarConfiguracion = async () => {
    try {
      console.log('Cargando configuración...');
      const config = await configService.getConfiguracion();
      console.log('Configuración cargada:', config);
      setConfiguracion(config);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  const cargarLavadoras = async () => {
    try {
      const lavadorasData = await lavadoraService.getAllLavadoras();
      setLavadoras(lavadorasData);
      
      // Sincronizar lavadoras huérfanas (marcadas como alquiladas pero sin pedido asociado)
      await sincronizarLavadorasHuerfanas(lavadorasData);
    } catch (error) {
      console.error('Error al cargar lavadoras:', error);
    }
  };

  const cargarPlanes = async () => {
    try {
      const { planService } = await import('../services/firebaseService');
      const planesData = await planService.getActivePlans();
      setPlanes(planesData);
    } catch (error) {
      console.error('Error al cargar planes:', error);
    }
  };

  // Función para cargar TODOS los pedidos (sin filtro de fecha) para el modal de estado
  const cargarTodosLosPedidos = async () => {
    try {
      const todosLosPedidos = await pedidoService.getAllPedidos();
      return todosLosPedidos;
    } catch (error) {
      console.error('Error al cargar todos los pedidos:', error);
      return [];
    }
  };

  // Función para liberar lavadoras de servicios completados
  const liberarLavadorasCompletadas = async () => {
    try {
      console.log('🔄 Liberando TODAS las lavadoras alquiladas...');
      
      // Obtener todas las lavadoras marcadas como "alquilada"
      const lavadorasAlquiladas = lavadoras.filter(l => l.estado === 'alquilada');
      console.log(`📊 Lavadoras alquiladas encontradas: ${lavadorasAlquiladas.length}`);
      
      let liberadas = 0;
      for (const lavadora of lavadorasAlquiladas) {
        console.log(`🔍 Liberando lavadora ${lavadora.codigoQR} (${lavadora.id})`);
        await lavadoraService.updateLavadora(lavadora.id, {
          estado: 'disponible'
        });
        liberadas++;
      }
      
      console.log(`✅ ${liberadas} lavadoras liberadas`);
      cargarLavadoras(); // Recargar lavadoras
      alert(`${liberadas} lavadoras liberadas`);
    } catch (error) {
      console.error('❌ Error liberando lavadoras:', error);
      alert('Error al liberar lavadoras');
    }
  };

  const sincronizarLavadorasHuerfanas = async (lavadorasData: any[]) => {
    try {
      console.log('🔄 Sincronizando lavadoras huérfanas...');
      
      // Cargar TODOS los pedidos para la verificación
      const todosLosPedidos = await pedidoService.getAllPedidos();
      console.log('🔍 Total pedidos para sincronización:', todosLosPedidos.length);
      
      for (const lavadora of lavadorasData) {
        if (lavadora.estado === 'alquilada') {
          // Buscar si realmente hay un pedido asociado en TODOS los pedidos
          const pedidoAsociado = todosLosPedidos.find(p => {
            return p.lavadoraAsignada?.lavadoraId === lavadora.id || 
                   p.lavadoraAsignada?.codigoQR === lavadora.codigoQR ||
                   (p as any).lavadoraAsignada_lavadoraId === lavadora.id ||
                   (p as any).lavadoraAsignada_codigoQR === lavadora.codigoQR;
          });
          
          if (!pedidoAsociado) {
            console.log(`🔧 Liberando lavadora huérfana: ${lavadora.codigoQR}`);
            console.log(`🔍 Lavadora ${lavadora.codigoQR} no tiene pedido asociado - liberando`);
            
            // Crear objeto de actualización solo con los campos que queremos cambiar
            const updates: any = {
              estado: 'disponible'
            };
            
            // Solo agregar campos si existen en la lavadora
            if (lavadora.pedidoId !== undefined) {
              updates.pedidoId = null;
            }
            if (lavadora.fechaInstalacion !== undefined) {
              updates.fechaInstalacion = null;
            }
            if (lavadora.fotoInstalacion !== undefined) {
              updates.fotoInstalacion = null;
            }
            if (lavadora.observacionesInstalacion !== undefined) {
              updates.observacionesInstalacion = null;
            }
            
            await lavadoraService.updateLavadora(lavadora.id, updates);
          } else {
            console.log(`✅ Lavadora ${lavadora.codigoQR} tiene pedido asociado: ${pedidoAsociado.id} - manteniendo alquilada`);
          }
        }
      }
      
      console.log('✅ Sincronización de lavadoras huérfanas completada');
    } catch (error) {
      console.error('❌ Error al sincronizar lavadoras huérfanas:', error);
    }
  };

  // Usar useMemo para optimizar el filtrado
  const pedidosFiltrados = useMemo(() => {
    const filtrados = pedidos.filter(pedido => {
      const cumpleFiltro = filtros.estado === 'todos' || pedido.status === filtros.estado;
      const cumpleBusqueda = busqueda === '' || 
        pedido.cliente.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        pedido.cliente.phone.includes(busqueda);
      
      return cumpleFiltro && cumpleBusqueda;
    });
    
    // Ordenar por fechaAsignacion (más recientes primero)
    return filtrados.sort((a, b) => {
      return b.fechaAsignacion.getTime() - a.fechaAsignacion.getTime();
    });
  }, [pedidos, filtros, busqueda]);

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer' | 'semana') => {
    const hoy = getCurrentDateColombia();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const semanaAtras = new Date(hoy);
    semanaAtras.setDate(semanaAtras.getDate() - 7);

    switch (tipo) {
      case 'hoy':
        setFiltros(prev => ({ ...prev, fechaInicio: hoy, fechaFin: hoy, tipoFiltro: 'hoy' }));
        break;
      case 'ayer':
        setFiltros(prev => ({ ...prev, fechaInicio: ayer, fechaFin: ayer, tipoFiltro: 'ayer' }));
        break;
      case 'semana':
        setFiltros(prev => ({ ...prev, fechaInicio: semanaAtras, fechaFin: hoy, tipoFiltro: 'semana' }));
        break;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pendiente: 'badge-primary',
      entregado: 'badge-warning',
      recogido: 'badge-success',
      cancelado: 'badge-danger'
    };
    
    const labels = {
      pendiente: 'Pendiente',
      entregado: 'Entregado',
      recogido: 'Recogido',
      cancelado: 'Cancelado'
    };

    return (
      <span className={`badge ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getEstadoPagoBadge = (estadoPago: string) => {
    const badges = {
      pendiente: 'badge-secondary',
      pagado_anticipado: 'badge-success',
      pagado_entrega: 'badge-info',
      pagado_recogida: 'badge-primary',
      debe: 'badge-danger'
    };
    
    const labels = {
      pendiente: 'Pendiente',
      pagado_anticipado: 'Pagado Anticipado',
      pagado_entrega: 'Pagado en Entrega',
      pagado_recogida: 'Pagado en Recogida',
      debe: 'Debe'
    };

    return (
      <span className={`badge ${badges[estadoPago as keyof typeof badges]}`}>
        {labels[estadoPago as keyof typeof labels]}
      </span>
    );
  };

  const actualizarEstadoPedido = async (pedidoId: string, nuevoEstado: string) => {
    try {
      await pedidoService.updatePedido(pedidoId, { 
        status: nuevoEstado as any,
        updatedAt: new Date()
      });
      
      // Si se marca como entregado, abrir modal de WhatsApp
      if (nuevoEstado === 'entregado') {
        const pedido = pedidos.find(p => p.id === pedidoId);
        if (pedido) {
          setPedidoParaWhatsApp(pedido);
          setMostrarModalWhatsApp(true);
        }
      }
      
      cargarPedidos();
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
      alert('Error al actualizar el pedido');
    }
  };

  // Función para manejar la confirmación de cancelación
  const handleConfirmarCancelacion = async (motivo: string) => {
    if (!pedidoACancelar) return;

    try {
      const fechaActual = new Date();
      const updateData: Partial<Pedido> = {
        status: 'cancelado',
        motivoCancelacion: motivo || undefined,
        updatedAt: fechaActual
      };

      await pedidoService.updatePedido(pedidoACancelar.id, updateData);
      
      // Si el pedido cancelado tiene lavadora asignada, liberar la lavadora
      if (pedidoACancelar.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedidoACancelar.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
      }
      
      // Recargar pedidos
      await cargarPedidos();
      
      alert('Pedido cancelado exitosamente');
    } catch (error) {
      console.error('Error al cancelar pedido:', error);
      alert('Error al cancelar el pedido');
    } finally {
      setMostrarModalCancelacion(false);
      setPedidoACancelar(null);
    }
  };

  // Función para detectar inconsistencias en pedidos
  const detectarInconsistencias = (pedido: Pedido): string[] => {
    const inconsistencias: string[] = [];
    
    // Verificar estado vs fechas
    if (pedido.status === 'entregado' && !pedido.fechaEntrega) {
      inconsistencias.push('Estado "entregado" sin fecha de entrega');
    }
    
    if (pedido.status === 'recogido' && !pedido.fechaEntrega) {
      inconsistencias.push('Estado "recogido" sin fecha de entrega');
    }
    
    if (pedido.status === 'recogido' && !pedido.fechaRecogida) {
      inconsistencias.push('Estado "recogido" sin fecha de recogida');
    }
    
    // Verificar orden lógico de fechas
    if (pedido.fechaEntrega && pedido.fechaRecogida) {
      if (pedido.fechaRecogida < pedido.fechaEntrega) {
        inconsistencias.push('Fecha de recogida anterior a fecha de entrega');
      }
    }
    
    return inconsistencias;
  };

  // Función de validación de transiciones de estado
  const validarTransicionEstado = (pedido: Pedido, nuevoEstado: string): { valido: boolean; mensaje?: string } => {
    // Primero verificar inconsistencias existentes
    const inconsistencias = detectarInconsistencias(pedido);
    if (inconsistencias.length > 0) {
      return { 
        valido: false, 
        mensaje: `Pedido tiene inconsistencias: ${inconsistencias.join(', ')}. Contacte al administrador.` 
      };
    }
    
    // Validar que no se pueda saltar pasos
    if (nuevoEstado === 'entregado' && pedido.status !== 'pendiente') {
      return { valido: false, mensaje: 'No se puede marcar como entregado si no está pendiente' };
    }
    
    if (nuevoEstado === 'recogido') {
      // Validar que esté entregado antes de recoger
      if (pedido.status !== 'entregado') {
        return { valido: false, mensaje: 'No se puede marcar como recogido si no ha sido entregado primero' };
      }
      
      // Validar que tenga fecha de entrega
      if (!pedido.fechaEntrega) {
        return { valido: false, mensaje: 'No se puede marcar como recogido sin fecha de entrega' };
      }
    }
    
    return { valido: true };
  };


  const cambiarEstadoPedido = async (pedido: Pedido, nuevoEstado: 'pendiente' | 'entregado' | 'recogido' | 'cancelado') => {
    const nombresEstados = {
      pendiente: 'Pendiente',
      entregado: 'Entregado',
      recogido: 'Recogido',
      cancelado: 'Cancelado'
    };

    // Validar transición de estado
    const validacion = validarTransicionEstado(pedido, nuevoEstado);
    if (!validacion.valido) {
      alert(`❌ Error: ${validacion.mensaje}`);
      return;
    }

    // Si es cancelación, mostrar modal para motivo
    if (nuevoEstado === 'cancelado') {
      setPedidoACancelar(pedido);
      setMostrarModalCancelacion(true);
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres cambiar este pedido a estado "${nombresEstados[nuevoEstado]}"?`)) {
      return;
    }

    try {
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

      const fechaActual = new Date();
      let updateData: Partial<Pedido> = {
        status: nuevoEstado,
        updatedAt: fechaActual
      };

      // Actualizar fechas según el estado
      if (nuevoEstado === 'pendiente') {
        // Para pendiente, eliminamos las fechas usando undefined (se convertirá a deleteField en firebaseService)
        updateData.fechaEntrega = undefined;
        updateData.fechaRecogida = undefined;
        updateData.fechaRecogidaCalculada = undefined;
        updateData.entregadoPor = undefined;
        updateData.recogidoPor = undefined;
      } else if (nuevoEstado === 'entregado') {
        updateData.fechaEntrega = fechaActual;
        updateData.fechaRecogida = undefined;
        updateData.entregadoPor = getCurrentUserName(); // ✅ Nombre del usuario que realizó la entrega
        // Calcular fecha de recogida según el plan
        updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan, pedido.horasAdicionales);
        // Recalcular total con horas adicionales y descuentos
        updateData.total = pedido.plan.price + (pedido.horasAdicionales * 2000) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
      } else if (nuevoEstado === 'recogido') {
        // Solo establecer fecha de recogida (la entrega ya debe existir por validación)
        updateData.fechaRecogida = fechaActual;
        updateData.recogidoPor = getCurrentUserName(); // ✅ Nombre del usuario que realizó la recogida
      } else if (nuevoEstado === 'cancelado') {
        // Para cancelado, mantenemos las fechas existentes
      }

      await pedidoService.updatePedido(pedido.id, updateData);
      
      // Log de auditoría
      console.log(`📝 AUDITORÍA: Pedido ${pedido.id} cambió de "${pedido.status}" a "${nuevoEstado}"`, {
        pedidoId: pedido.id,
        cliente: pedido.cliente.name,
        estadoAnterior: pedido.status,
        estadoNuevo: nuevoEstado,
        fechaCambio: fechaActual.toISOString(),
        tieneFechaEntrega: !!pedido.fechaEntrega,
        tieneFechaRecogida: !!pedido.fechaRecogida
      });
      
      // Si se marca como recogido y tiene lavadora asignada, liberar la lavadora
      if (nuevoEstado === 'recogido' && pedido.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
        console.log(`🔄 AUDITORÍA: Lavadora ${pedido.lavadoraAsignada.codigoQR} liberada tras recogida`);
      }
      
      cargarPedidos();
      alert(`✅ Pedido actualizado a estado "${nombresEstados[nuevoEstado]}"`);
    } catch (error) {
      console.error('Error al cambiar estado del pedido:', error);
      alert('Error al actualizar el pedido');
    }
  };

  const avanzarEstadoPedido = async (pedido: Pedido) => {
    let nuevoEstado: 'entregado' | 'recogido';
    let mensaje: string;

    if (pedido.status === 'pendiente') {
      nuevoEstado = 'entregado';
      mensaje = '¿Marcar como entregado?';
    } else if (pedido.status === 'entregado') {
      nuevoEstado = 'recogido';
      mensaje = '¿Marcar como recogido?';
    } else {
      return; // No hacer nada si ya está recogido
    }

    if (!confirm(mensaje)) {
      return;
    }

    try {
      const fechaActual = new Date();
      let updateData: Partial<Pedido> = {
        status: nuevoEstado,
        updatedAt: fechaActual
      };

      if (nuevoEstado === 'entregado') {
        updateData.fechaEntrega = fechaActual;
        updateData.fechaRecogida = undefined;
        updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan, pedido.horasAdicionales);
        // Obtener configuración para precio de hora adicional
        const config = await configService.getConfiguracion();
        const precioHoraAdicional = config?.horaAdicional || 2000;
        updateData.total = pedido.plan.price + (pedido.horasAdicionales * precioHoraAdicional) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
      } else if (nuevoEstado === 'recogido') {
        // Validar que tenga fecha de entrega antes de marcar como recogido
        if (!pedido.fechaEntrega) {
          alert('❌ Error: No se puede marcar como recogido sin fecha de entrega. Debe entregar primero.');
          return;
        }
        updateData.fechaRecogida = fechaActual;
      }

      await pedidoService.updatePedido(pedido.id, updateData);
      
      // Si se marca como recogido y tiene lavadora asignada, liberar la lavadora
      if (nuevoEstado === 'recogido' && pedido.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
      }
      
      cargarPedidos();
    } catch (error) {
      console.error('Error al avanzar estado del pedido:', error);
      alert('Error al actualizar el pedido');
    }
  };

  const getLiquidacionButton = (pedido: Pedido) => {
    // Calcular saldo pendiente restando los pagos ya realizados
    const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
    const saldoPendiente = Math.max(0, (pedido.total || 0) - totalPagado);
    
    const getBadgeColor = (saldo: number) => {
      if (saldo <= 0) return 'bg-green-100 text-green-800 border-green-200';
      if (saldo > 50000) return 'bg-red-100 text-red-800 border-red-200';
      if (saldo > 20000) return 'bg-orange-100 text-orange-800 border-orange-200';
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    };

    const isPagado = saldoPendiente <= 0;

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isPagado) {
            setPedidoALiquidar(pedido);
            setMostrarModalLiquidacionUniversal(true);
          }
        }}
        className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
          isPagado ? 'cursor-default' : 'hover:shadow-md'
        } ${isPagado ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'}`}
        title={isPagado ? 'Servicio completamente pagado' : `Click para liquidar: ${formatCurrency(saldoPendiente)}`}
      >
        {isPagado ? '✅' : `💰 ${formatCurrency(saldoPendiente)}`}
      </button>
    );
  };

  const getProgresoButton = (pedido: Pedido) => {
    const saldoPendiente = pedido.saldoPendiente || 0;
    const isPagado = saldoPendiente <= 0;
    
    if (pedido.status === 'pendiente') {
      return (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            console.log('Botón Entregar clickeado para pedido:', pedido.id);
            
            // Recargar lavadoras antes de abrir el modal para tener datos actualizados
            await cargarLavadoras();
            
            setPedidoAValidar(pedido);
            setMostrarModalEntregaOperativa(true);
          }}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm transition-all duration-200 inline-flex items-center"
          title="Validar QR y entregar"
        >
          Entregar
        </button>
      );
    } else if (pedido.status === 'entregado') {
      return (
        <div className="flex flex-col gap-1.5 items-start">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPedidoParaRecogida(pedido);
              setMostrarModalRecogidaOperativa(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg shadow-sm transition-all duration-200"
            title="Liquidar y recoger"
          >
            Recoger
          </button>
          
          {/* Botones de modificaciones */}
          <div className="flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPedidoParaModificar(pedido);
                setMostrarModalModificaciones(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-sm transition-all duration-200"
              title="Modificar servicio (horas extras, cobros, descuentos, cambio de plan)"
            >
              Modificar
            </button>
            
            {/* Botón de pagos */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRegistrarPago(pedido);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg shadow-sm transition-all duration-200"
              title="Registrar pago"
            >
              Pagos
            </button>
          </div>
        </div>
      );
    } else if (pedido.status === 'recogido') {
      // Calcular saldo pendiente para servicios completados
      const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
      const saldoPendiente = Math.max(0, (pedido.total || 0) - totalPagado);
      
      return (
        <div className="flex flex-col gap-1.5 items-start">
          <span className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg shadow-sm">
            Completado
          </span>
          {saldoPendiente > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRegistrarPago(pedido);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg shadow-sm transition-all duration-200"
              title="Registrar pago"
            >
              Pagos
            </button>
          )}
        </div>
      );
    }
    return null;
  };

  const verDetallesPedido = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setMostrarModalDetalles(true);
  };


  const calcularDuracionReal = (pedido: Pedido): string => {
    if (pedido.fechaEntrega && pedido.fechaRecogida) {
      const diffMs = pedido.fechaRecogida.getTime() - pedido.fechaEntrega.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      
      if (diffHours < 24) {
        return `${diffHours} horas`;
      } else {
        const days = Math.floor(diffHours / 24);
        const remainingHours = diffHours % 24;
        if (remainingHours === 0) {
          return `${days} día${days > 1 ? 's' : ''}`;
        }
        return `${days} día${days > 1 ? 's' : ''} y ${remainingHours} horas`;
      }
    }
    return '-';
  };

  const eliminarPedido = async (pedido: Pedido) => {
    try {
      console.log('🗑️ Iniciando eliminación de pedido:', pedido.id);
      
      // Validar si el pedido tiene pagos realizados
      const tienePagos = pedido.pagosRealizados && pedido.pagosRealizados.length > 0;
      const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
      
      if (tienePagos && totalPagado > 0) {
        alert(`⚠️ No se puede eliminar este pedido porque ya tiene pagos realizados por $${totalPagado.toLocaleString()}. Debe eliminar primero los pagos en la sección "Pagos" para poder eliminar el pedido.`);
        return;
      }
      
      console.log('📋 Lavadora asignada:', pedido.lavadoraAsignada);
      
      // Liberar la lavadora asignada si existe
      if (pedido.lavadoraAsignada && pedido.lavadoraAsignada.lavadoraId) {
        console.log('🔄 Liberando lavadora:', pedido.lavadoraAsignada.lavadoraId);
        
        try {
          await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
            estado: 'disponible'
          });
          console.log('✅ Lavadora liberada exitosamente');
        } catch (lavadoraError) {
          console.error('❌ Error al liberar lavadora:', lavadoraError);
          // Continuar con la eliminación del pedido aunque falle la liberación de la lavadora
          alert('Advertencia: El pedido se eliminó pero hubo un problema al liberar la lavadora. Verifica manualmente el estado de la lavadora.');
        }
      } else {
        console.log('⚠️ No hay lavadora asignada para liberar o falta lavadoraId');
      }
      
      console.log('🗑️ Marcando pedido como eliminado en la base de datos...');
      await pedidoService.marcarComoEliminado(pedido.id, firebaseUser?.uid || 'sistema');
      console.log('✅ Pedido marcado como eliminado exitosamente');
      
      cargarPedidos();
      cargarLavadoras(); // Recargar lavadoras para actualizar el estado
      setMostrarModalDetalles(false);
      alert('Pedido eliminado exitosamente');
    } catch (error) {
      console.error('❌ Error al eliminar pedido:', error);
      alert('Error al eliminar el pedido: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const verFotoInstalacion = (pedido: Pedido) => {
    // Verificar si hay foto antes de abrir el modal
    // Buscar en ambos formatos: validacionQR.fotoInstalacion y validacionQR_fotoInstalacion
    const tieneFoto = pedido.validacionQR?.fotoInstalacion || 
                     (pedido as any).validacionQR_fotoInstalacion ||
                     pedido.lavadoraAsignada?.fotoInstalacion;
    
    if (!tieneFoto) {
      alert('Este pedido no tiene foto de evidencia de instalación');
      return;
    }
    
    setPedidoParaFoto(pedido);
    setMostrarModalFoto(true);
  };


  const handleLiquidacion = async (liquidacion: any) => {
    console.log('handleLiquidacion llamado con:', liquidacion);
    console.log('pedidoAFacturar:', pedidoAFacturar);
    
    if (!pedidoAFacturar) {
      console.log('No hay pedido para liquidar');
      return;
    }
    
    try {
      console.log('Iniciando proceso de liquidación...');
      
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
      
      const updateData: Partial<Pedido> = {
        descuentos: liquidacion.descuentos,
        reembolsos: liquidacion.reembolsos,
        horasAdicionales: liquidacion.horasAdicionales,
        observacionesPago: liquidacion.observacionesPago,
        updatedAt: new Date(),
        status: 'recogido', // Cambiar estado a recogido
        fechaRecogida: new Date(), // Agregar fecha de recogida
        recogidoPor: getCurrentUserName() // ✅ Nombre del usuario que realizó la recogida
      };

      // Si no ha pagado, agregar método de pago
      // Actualizar estado de pago
      if (pedidoAFacturar.estadoPago === 'pagado_entrega') {
        updateData.estadoPago = 'pagado_recogida';
      }

      // Recalcular totales
      const subtotal = pedidoAFacturar.plan.price;
      const totalCobrosAdicionales = pedidoAFacturar.cobrosAdicionales.reduce((sum, cobro) => sum + cobro.monto, 0);
      const totalHorasAdicionales = liquidacion.horasAdicionales * (configuracion?.horaAdicional || 2000);
      const totalDescuentos = liquidacion.descuentos.reduce((sum: number, descuento: any) => sum + descuento.amount, 0);
      const totalReembolsos = liquidacion.reembolsos.reduce((sum: number, reembolso: any) => sum + reembolso.monto, 0);
      
      updateData.subtotal = subtotal;
      updateData.totalCobrosAdicionales = totalCobrosAdicionales;
      updateData.totalDescuentos = totalDescuentos;
      updateData.totalReembolsos = totalReembolsos;
      updateData.total = subtotal + totalCobrosAdicionales + totalHorasAdicionales - totalDescuentos - totalReembolsos;

      console.log('Datos a actualizar:', updateData);

      await pedidoService.updatePedido(pedidoAFacturar.id, updateData);
      console.log('Pedido actualizado exitosamente');
      
      // Si tiene lavadora asignada, liberar la lavadora
      if (pedidoAFacturar.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedidoAFacturar.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
        console.log('Lavadora liberada');
      }
      
      cargarPedidos();
      setMostrarModalLiquidacion(false);
      setPedidoAFacturar(null);
      alert('Liquidación procesada exitosamente');
      
      // Disparar evento para recargar dashboard
      window.dispatchEvent(new CustomEvent('pagoRealizado'));
    } catch (error) {
      console.error('Error al procesar liquidación:', error);
      alert('Error al procesar la liquidación: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleLiquidacionUniversal = async (paymentData: {
    amount: number;
    medioPago: 'efectivo' | 'nequi' | 'daviplata';
    reference?: string;
    isPartial: boolean;
  }) => {
    if (!pedidoALiquidar) return;

    try {
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

      const nuevoPago: any = {
        monto: paymentData.amount,
        medioPago: paymentData.medioPago,
        fecha: new Date(),
        isPartial: paymentData.isPartial,
        registradoPor: getCurrentUserName(), // ✅ Nombre del usuario que registró el pago
        ...(paymentData.reference && { referencia: paymentData.reference })
      };

      // Actualizar el pedido con el nuevo pago
      const pagosActuales = pedidoALiquidar.pagosRealizados || [];
      const nuevosPagos = [...pagosActuales, nuevoPago];
      const nuevoSaldoPendiente = Math.max(0, pedidoALiquidar.saldoPendiente - paymentData.amount);

      await pedidoService.updatePedido(pedidoALiquidar.id, {
        pagosRealizados: nuevosPagos,
        saldoPendiente: nuevoSaldoPendiente,
        estadoPago: nuevoSaldoPendiente === 0 ? 'pagado_recogida' : 'debe'
      });

      // Recargar pedidos
      await cargarPedidos();
      setMostrarModalLiquidacionUniversal(false);
      setPedidoALiquidar(null);
      
      // Disparar evento para recargar dashboard
      console.log('🔄 Disparando evento pagoRealizado...');
      window.dispatchEvent(new CustomEvent('pagoRealizado'));
      console.log('✅ Evento pagoRealizado disparado');
    } catch (error) {
      console.error('Error al procesar liquidación universal:', error);
      alert('Error al procesar la liquidación');
    }
  };

  // Función para procesar entrega operativa (solo QR + foto + cambio estado)
  const handleEntregaOperativa = async (entregaData: any) => {
    if (!pedidoAValidar) return;

    const result = await entregaOperativaService.procesarEntregaOperativa(
      pedidoAValidar,
      entregaData,
      lavadoras,
      {
        onSuccess: (pedidoActualizado) => {
          console.log('Pedidos - Entrega operativa exitosa');
          
          // Cerrar modal de entrega operativa
          setMostrarModalEntregaOperativa(false);
          
          // Abrir modal de WhatsApp directamente con la foto de evidencia
          setPedidoParaWhatsApp(pedidoActualizado);
          setFotoEvidenciaWhatsApp(entregaData.fotoInstalacion || null);
          setMostrarModalWhatsApp(true);
          
          // Limpiar estado
          setPedidoAValidar(null);
          
          // Recargar datos
          cargarPedidos();
          cargarLavadoras();
          window.dispatchEvent(new CustomEvent('pagoRealizado')); // Notificar al dashboard
        },
        onError: (error) => {
          alert(error);
        }
      }
    );

    if (!result.success) {
      alert(result.message);
    }
  };

  // Función para procesar recogida operativa (solo liberar lavadora + cambio estado)
  const handleRecogidaOperativa = async (recogidaData: any) => {
    if (!pedidoParaRecogida) return;

    try {
      const result = await recogidaOperativaService.procesarRecogidaOperativa(
        pedidoParaRecogida.id,
        recogidaData
      );
      
      console.log('Pedidos - Recogida operativa exitosa');
      
      // Si tiene lavadora asignada, liberar la lavadora
      if (pedidoParaRecogida.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedidoParaRecogida.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
        console.log('✅ Lavadora liberada');
      }
      
      // Cerrar modal de recogida operativa
      setMostrarModalRecogidaOperativa(false);
      
      // Limpiar estado
      setPedidoParaRecogida(null);
      
      // Recargar datos
      cargarPedidos();
      cargarLavadoras();
      window.dispatchEvent(new CustomEvent('pagoRealizado')); // Notificar al dashboard
      alert('Servicio marcado como recogido exitosamente');
    } catch (error: any) {
      alert(error.message || 'Error al procesar la recogida');
    }
  };

  // Funciones para manejar modificaciones dinámicas
  // Función para manejar modificaciones del servicio
  const handleModificacionesServicio = async () => {
    if (!pedidoParaModificar) return;
    
    try {
      await cargarPedidos();
      alert('Modificaciones aplicadas exitosamente');
    } catch (error) {
      console.error('Pedidos - Error al aplicar modificaciones:', error);
      alert('Error al aplicar modificaciones: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  // Funciones para manejar pagos
  const handleRegistrarPago = (pedido: Pedido) => {
    setPedidoParaPago(pedido);
    setMostrarModalPagos(true);
  };

  const handlePagoRealizado = async () => {
    try {
      await cargarPedidos();
    } catch (error) {
      console.error('Pedidos - Error al registrar pago:', error);
      alert('Error al registrar pago: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Mejorado */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <ClipboardDocumentListIcon className="h-8 w-8 text-white" />
                </div>
        <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Gestión de Servicios
                  </h1>
                  <p className="text-gray-600 text-lg mt-1">Administra y monitorea todos los servicios de lavadoras</p>
                </div>
              </div>
              
              {/* Estadísticas Rápidas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm">
                  <div className="text-2xl font-bold text-blue-700">{pedidosFiltrados.length}</div>
                  <div className="text-sm text-blue-600 font-medium">Total Pedidos</div>
                </div>
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200 shadow-sm">
                  <div className="text-2xl font-bold text-yellow-700">
                    {pedidosFiltrados.filter(p => p.status === 'pendiente').length}
                  </div>
                  <div className="text-sm text-yellow-600 font-medium">Pendientes</div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border border-green-200 shadow-sm">
                  <div className="text-2xl font-bold text-green-700">
                    {pedidosFiltrados.filter(p => p.status === 'entregado').length}
                  </div>
                  <div className="text-sm text-green-600 font-medium">Entregados</div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 shadow-sm">
                  <div className="text-2xl font-bold text-purple-700">
                    {pedidosFiltrados.filter(p => p.status === 'recogido').length}
                  </div>
                  <div className="text-sm text-purple-600 font-medium">Completados</div>
                </div>
              </div>
        </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => setMostrarNuevoPedido(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
        >
          <span>Nuevo Servicio</span>
        </button>
        
        <button
          onClick={() => setMostrarEstadoLavadoras(true)}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
          title="Ver estado de lavadoras"
        >
          <CalendarIcon className="h-5 w-5" />
          <span>Ver Estado Lavadoras</span>
        </button>
            </div>
          </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <FunnelIcon className="h-5 w-5 text-primary-600 mr-2" />
          Filtros
        </h3>
        
        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => aplicarFiltroRapido('hoy')}
            className={`btn ${filtros.tipoFiltro === 'hoy' ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarFiltroRapido('ayer')}
            className={`btn ${filtros.tipoFiltro === 'ayer' ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            Ayer
          </button>
          <button
            onClick={() => aplicarFiltroRapido('semana')}
            className={`btn ${filtros.tipoFiltro === 'semana' ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            Última Semana
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-center gap-4 mb-4">
          
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
              <input
              type="date"
              className="input"
              value={filtros.fechaInicio.toISOString().split('T')[0]}
              onChange={(e) => setFiltros(prev => ({ 
                ...prev, 
                fechaInicio: new Date(e.target.value),
                tipoFiltro: 'personalizado'
              }))}
              />
            </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              className="input"
              value={filtros.fechaFin.toISOString().split('T')[0]}
              onChange={(e) => setFiltros(prev => ({ 
                ...prev, 
                fechaFin: new Date(e.target.value),
                tipoFiltro: 'personalizado'
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              className="input"
              value={filtros.estado}
              onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="entregado">Entregados</option>
              <option value="recogido">Recogidos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Cliente
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                placeholder="Nombre o teléfono..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

        {/* Lista de pedidos en formato cards/tags */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Lista de Servicios
                  </h3>
                  <p className="text-sm text-gray-600">
                    {pedidosFiltrados.length} servicio{pedidosFiltrados.length !== 1 ? 's' : ''} encontrado{pedidosFiltrados.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        
        {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron servicios</h3>
              <p className="text-gray-500 mb-6">Intenta ajustar los filtros o crear un nuevo servicio</p>
              <button
                onClick={() => setMostrarNuevoPedido(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Crear Primer Servicio
              </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {pedidosFiltrados.map((pedido) => {
                const inconsistencias = detectarInconsistencias(pedido);
                const tieneFoto = pedido.validacionQR?.fotoInstalacion || 
                                 (pedido as any).validacionQR_fotoInstalacion ||
                                 pedido.lavadoraAsignada?.fotoInstalacion;
                const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
                const saldoPendiente = Math.max(0, (pedido.total || 0) - totalPagado);
                
                return (
                  <div 
                    key={pedido.id} 
                    className="p-4 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-all duration-200 cursor-pointer"
                    onClick={() => verDetallesPedido(pedido)}
                  >
                    {/* Header con cliente y badge de inconsistente */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-md flex-shrink-0">
                          <span className="text-sm font-bold text-white">
                            {pedido.cliente.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <h4 className="font-medium text-gray-900 truncate">
                              {pedido.cliente.name}
                            </h4>
                            {inconsistencias.length > 0 && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 flex-shrink-0"
                                title={`Inconsistencias: ${inconsistencias.join(', ')}`}
                              >
                                ⚠️ Inconsistente
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{pedido.cliente.phone}</p>
                        </div>
                      </div>
                    </div>

                    {/* Badges de estado */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pedido.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                        pedido.status === 'entregado' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        pedido.status === 'recogido' ? 'bg-green-100 text-green-800 border border-green-200' :
                        'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {pedido.status === 'pendiente' ? 'Pendiente' :
                         pedido.status === 'entregado' ? 'Entregado' :
                         pedido.status === 'recogido' ? 'Recogido' :
                         'Cancelado'}
                      </span>
                      {pedido.recogidaPrioritaria && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                          ⏰ Recogida Prioritaria
                        </span>
                      )}
                      {pedido.isPrioritario && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                          🔴 Prioritario
                        </span>
                      )}
                    </div>

                    {/* Plan y Total */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                        <div className="text-sm font-semibold text-green-800">
                          {pedido.plan.name}
                        </div>
                        <div className="text-xs text-green-600">
                          {formatCurrency(pedido.plan.price)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(pedido.total)}
                        </div>
                        {saldoPendiente > 0 && (
                          <div className="text-xs font-medium text-red-600">
                            Saldo: {formatCurrency(saldoPendiente)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fechas */}
                    <div className="space-y-1 mb-3 text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-3 w-3 text-gray-400" />
                        <span>
                          <strong>Pedido:</strong> {formatDate(pedido.fechaAsignacion, 'dd/MM/yyyy HH:mm')}
                          {pedido.createdBy && nombresUsuarios.has(pedido.createdBy) && (
                            <span className="text-gray-500"> - {nombresUsuarios.get(pedido.createdBy)}</span>
                          )}
                        </span>
                      </div>
                      {pedido.fechaEntrega ? (
                        <div className="flex items-center space-x-2">
                          <TruckIcon className="h-3 w-3 text-blue-500" />
                          <span>
                            <strong>Entrega:</strong> {formatDate(pedido.fechaEntrega, 'dd/MM/yyyy HH:mm')}
                            {pedido.entregadoPor && <span className="text-gray-500"> - {pedido.entregadoPor}</span>}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-gray-400 italic">
                          <TruckIcon className="h-3 w-3" />
                          <span>Entrega: Pendiente</span>
                        </div>
                      )}
                      {pedido.fechaRecogida ? (
                        <div className="flex items-center space-x-2">
                          <HomeIcon className="h-3 w-3 text-green-500" />
                          <span>
                            <strong>Recogida:</strong> {formatDate(pedido.fechaRecogida, 'dd/MM/yyyy HH:mm')}
                            {pedido.recogidoPor && <span className="text-gray-500"> - {pedido.recogidoPor}</span>}
                          </span>
                        </div>
                      ) : (
                        pedido.status === 'entregado' && (
                          <div className="flex items-center space-x-2 text-gray-400 italic">
                            <HomeIcon className="h-3 w-3" />
                            <span>Recogida: Pendiente</span>
                          </div>
                        )
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-start gap-1.5 mb-2">
                        {getProgresoButton(pedido)}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {tieneFoto && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                verFotoInstalacion(pedido);
                              }}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200"
                              title="Ver foto de instalación"
                            >
                              <CameraIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {tienePermiso('eliminarServicios') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
                                eliminarPedido(pedido);
                              }
                            }}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Eliminar"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </div>
        </div>

      {/* Resumen Detallado */}
        <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen del Día</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Estadísticas Generales */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Estadísticas Generales</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total pedidos:</span>
              <span className="font-medium">{pedidosFiltrados.length}</span>
            </div>
              <div className="flex justify-between">
                <span>Pendientes:</span>
                <span className="font-medium text-warning-600">
                  {pedidosFiltrados.filter(p => p.status === 'pendiente').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Entregados:</span>
                <span className="font-medium text-info-600">
                  {pedidosFiltrados.filter(p => p.status === 'entregado').length}
                </span>
            </div>
            <div className="flex justify-between">
              <span>Completados:</span>
              <span className="font-medium text-success-600">
                {pedidosFiltrados.filter(p => p.status === 'recogido').length}
              </span>
            </div>
            </div>
          </div>

          {/* Ingresos */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Ingresos</h4>
            <div className="space-y-2 text-sm">
            <div className="flex justify-between">
                <span>Total ingresos:</span>
              <span className="font-medium text-success-600">
                {formatCurrency(pedidosFiltrados.reduce((sum, p) => {
                  const totalPagado = p.pagosRealizados?.reduce((sumPago, pago) => sumPago + pago.monto, 0) || 0;
                  return sum + totalPagado;
                }, 0))}
              </span>
              </div>
              <div className="flex justify-between">
                <span>Promedio por pedido:</span>
                <span className="font-medium text-gray-600">
                  {pedidosFiltrados.length > 0 ? formatCurrency(pedidosFiltrados.reduce((sum, p) => {
                    const totalPagado = p.pagosRealizados?.reduce((sumPago, pago) => sumPago + pago.monto, 0) || 0;
                    return sum + totalPagado;
                  }, 0) / pedidosFiltrados.length) : '$0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total pendiente:</span>
                <span className="font-medium text-warning-600">
                  {formatCurrency(pedidosFiltrados.reduce((sum, p) => {
                    const totalPagado = p.pagosRealizados?.reduce((sumPago, pago) => sumPago + pago.monto, 0) || 0;
                    const saldoPendiente = p.total - totalPagado;
                    return sum + Math.max(0, saldoPendiente);
                  }, 0))}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Nuevo Pedido */}
      {mostrarNuevoPedido && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-2 sm:p-4">
          <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nuevo Servicio</h3>
              <button
                onClick={() => setMostrarNuevoPedido(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NuevoPedido onClose={() => {
              setMostrarNuevoPedido(false);
              cargarPedidos(); // Recargar pedidos después de crear uno nuevo
            }} />
          </div>
        </div>
      )}

      {/* Modal de Detalles del Pedido */}
      {mostrarModalDetalles && pedidoSeleccionado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Detalles del Servicio</h3>
              <button
                onClick={() => setMostrarModalDetalles(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Información del Cliente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Cliente</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Nombre:</span>
                    <span className="ml-2 font-medium">{pedidoSeleccionado.cliente.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Teléfono:</span>
                    <span className="ml-2 font-medium">{pedidoSeleccionado.cliente.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Dirección:</span>
                    <span className="ml-2 font-medium">{pedidoSeleccionado.cliente.address}</span>
                  </div>
                </div>
              </div>

              {/* Información del Plan Mejorada */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  📋 Plan y Estado del Servicio
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-gray-500 mb-1">Plan Contratado</div>
                    <div className="font-semibold text-gray-900 text-lg">{pedidoSeleccionado.plan.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Duración: {pedidoSeleccionado.status === 'recogido' && pedidoSeleccionado.fechaEntrega && pedidoSeleccionado.fechaRecogida
                        ? calcularDuracionReal(pedidoSeleccionado)
                        : `${pedidoSeleccionado.plan.duration}h`
                      }
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-gray-500 mb-1">Estado Actual</div>
                    <div className="mb-2">{getStatusBadge(pedidoSeleccionado.status)}</div>
                    <div className="text-xs text-gray-600">
                      Estado de Pago: {pedidoSeleccionado.pagosRealizados && pedidoSeleccionado.pagosRealizados.length > 0 ? (
                        pedidoSeleccionado.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0) >= pedidoSeleccionado.total ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✅ Pagado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⚠️ Parcial
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ❌ Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Información de Recogida Prioritaria */}
                  {pedidoSeleccionado.recogidaPrioritaria && (
                    <div className="md:col-span-2 mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-orange-600 font-medium">⏰ Recogida Prioritaria</span>
                      </div>
                      {pedidoSeleccionado.horaRecogida && (
                        <div className="text-sm text-orange-700">
                          <strong>Hora:</strong> {pedidoSeleccionado.horaRecogida}
                        </div>
                      )}
                      {pedidoSeleccionado.observacionRecogida && (
                        <div className="text-sm text-orange-700 mt-1">
                          <strong>Observación:</strong> {pedidoSeleccionado.observacionRecogida}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cronología del Pedido */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Cronología del Pedido</h4>
                <div className="space-y-3">
                  {(() => {
                    let pasoNum = 1;
                    const eventos: React.ReactNode[] = [];
                    
                    // Paso 1: Asignación
                    eventos.push(
                      <div key="asignacion" className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{pasoNum}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">Pedido Asignado</span>
                            <div className="text-right">
                              <span className="text-sm text-gray-500">{pedidoSeleccionado.fechaAsignacion ? formatDate(pedidoSeleccionado.fechaAsignacion, 'dd/MM/yyyy HH:mm') : 'Sin fecha'}</span>
                              {nombreCreadorPedido && (
                                <div className="text-xs text-gray-600 font-medium">{nombreCreadorPedido}</div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">Se creó el pedido y se asignó al cliente</p>
                        </div>
                      </div>
                    );
                    pasoNum++;

                    // Paso 2: Entrega
                    eventos.push(
                      <div key="entrega" className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          pedidoSeleccionado.status === 'pendiente' ? 'bg-gray-300' : 'bg-green-500'
                        }`}>
                          <span className={`text-xs font-bold ${
                            pedidoSeleccionado.status === 'pendiente' ? 'text-gray-600' : 'text-white'
                          }`}>{pasoNum}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">
                              {pedidoSeleccionado.status === 'pendiente' ? 'Entrega Pendiente' : 'Lavadora Entregada'}
                            </span>
                            <div className="text-right">
                              <span className="text-sm text-gray-500">
                                {pedidoSeleccionado.status === 'pendiente' 
                                  ? (pedidoSeleccionado.fechaEntrega ? formatDate(pedidoSeleccionado.fechaEntrega, 'dd/MM/yyyy HH:mm') : 'Pendiente')
                                  : (pedidoSeleccionado.fechaEntrega ? formatDate(pedidoSeleccionado.fechaEntrega, 'dd/MM/yyyy HH:mm') : '-')
                                }
                              </span>
                              {pedidoSeleccionado.entregadoPor && (
                                <div className="text-xs text-gray-600 font-medium">{pedidoSeleccionado.entregadoPor}</div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {pedidoSeleccionado.status === 'pendiente' 
                              ? 'Se entregará la lavadora al cliente'
                              : 'Lavadora entregada al cliente'
                            }
                          </p>
                        </div>
                      </div>
                    );
                    pasoNum++;

                    // Pasos de Modificaciones (solo si hay entregado y hay modificaciones)
                    if (pedidoSeleccionado.status !== 'pendiente' && pedidoSeleccionado.modificacionesServicio && pedidoSeleccionado.modificacionesServicio.length > 0) {
                      pedidoSeleccionado.modificacionesServicio.forEach((mod, index) => {
                        eventos.push(
                          <div key={`modificacion-${index}`} className="flex items-center space-x-3">
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{pasoNum}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-900">Modificación #{index + 1}</span>
                                <div className="text-right">
                                  <span className="text-sm text-gray-500">
                                    {mod.fecha ? formatDate(mod.fecha, 'dd/MM/yyyy HH:mm') : 'Sin fecha'}
                                  </span>
                                  {mod.aplicadoPor && (
                                    <div className="text-xs text-gray-600 font-medium">{mod.aplicadoPor}</div>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500">
                                {mod.totalModificaciones !== 0 
                                  ? `Ajuste: ${mod.totalModificaciones > 0 ? '+' : ''}${formatCurrency(mod.totalModificaciones)}`
                                  : 'Sin cambios financieros'
                                }
                              </p>
                            </div>
                          </div>
                        );
                        pasoNum++;
                      });
                    }

                    // Último paso: Recogida
                    eventos.push(
                      <div key="recogida" className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          pedidoSeleccionado.status === 'recogido' ? 'bg-purple-500' : 
                          pedidoSeleccionado.status === 'entregado' ? 'bg-yellow-500' : 'bg-gray-300'
                        }`}>
                          <span className={`text-xs font-bold ${
                            pedidoSeleccionado.status === 'recogido' || pedidoSeleccionado.status === 'entregado' ? 'text-white' : 'text-gray-600'
                          }`}>{pasoNum}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">
                              {pedidoSeleccionado.status === 'recogido' ? 'Lavadora Recogida' :
                               pedidoSeleccionado.status === 'entregado' ? 'Recogida Programada' : 'Recogida Pendiente'}
                            </span>
                            <div className="text-right">
                              <span className="text-sm text-gray-500">
                                {pedidoSeleccionado.status === 'recogido' 
                                  ? (pedidoSeleccionado.fechaRecogida ? formatDate(pedidoSeleccionado.fechaRecogida, 'dd/MM/yyyy HH:mm') : '-')
                                  : pedidoSeleccionado.status === 'entregado' && pedidoSeleccionado.fechaRecogidaCalculada
                                  ? (pedidoSeleccionado.fechaRecogidaCalculada ? formatDate(pedidoSeleccionado.fechaRecogidaCalculada, 'dd/MM/yyyy HH:mm') : 'No calculable')
                                  : 'Pendiente'
                                }
                              </span>
                              {pedidoSeleccionado.recogidoPor && (
                                <div className="text-xs text-gray-600 font-medium">{pedidoSeleccionado.recogidoPor}</div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {pedidoSeleccionado.status === 'recogido' 
                              ? 'Lavadora recogida del cliente'
                              : pedidoSeleccionado.status === 'entregado'
                              ? 'Lavadora será recogida según el plan'
                              : 'Se recogerá después de entregar'
                            }
                          </p>
                        </div>
                      </div>
                    );

                    return eventos;
                  })()}
                </div>
              </div>

              {/* Información de Lavadora Mejorada */}
              {pedidoSeleccionado.lavadoraAsignada && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center">
                    🧺 Lavadora Asignada
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-white p-3 rounded-lg border">
                      <div className="text-gray-500 mb-1">Código QR</div>
                      <div className="font-bold text-green-900 text-lg">{pedidoSeleccionado.lavadoraAsignada.codigoQR}</div>
                      <div className="text-xs text-gray-600 mt-1">Identificador único</div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border">
                      <div className="text-gray-500 mb-1">Especificaciones</div>
                      <div className="text-sm text-gray-900">
                        <div><strong>Marca:</strong> {pedidoSeleccionado.lavadoraAsignada.marca}</div>
                        <div><strong>Modelo:</strong> {pedidoSeleccionado.lavadoraAsignada.modelo}</div>
                      </div>
                      <div className="text-xs text-green-600 mt-1 font-medium">✅ Asignada al servicio</div>
                    </div>
                  </div>
                  
                  {/* Observaciones de instalación */}
                  {pedidoSeleccionado.lavadoraAsignada.observacionesInstalacion && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-blue-800 font-medium mb-1">📝 Observaciones de Instalación</div>
                      <div className="text-sm text-blue-700">{pedidoSeleccionado.lavadoraAsignada.observacionesInstalacion}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Información Financiera Completa */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  💰 Información Financiera
                </h4>
                
                {/* Resumen Detallado de Valores - Similar al Modal de Modificaciones */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                  <h5 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Resumen Financiero del Servicio
                  </h5>
                  
                  <div className="space-y-2">
                    {/* Precio Base del Plan */}
                    <div className="flex justify-between items-center py-2 border-b border-blue-100">
                      <span className="text-gray-700 font-medium">Precio del plan:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(pedidoSeleccionado.plan.price)}
                      </span>
                    </div>
                    
                    {/* Horas Extras Totales */}
                    {pedidoSeleccionado.modificacionesServicio && pedidoSeleccionado.modificacionesServicio.some(mod => mod.horasExtras && mod.horasExtras.length > 0) && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-700 font-medium">Horas extras:</span>
                        <span className="font-semibold text-orange-600">
                          {formatCurrency(
                            pedidoSeleccionado.modificacionesServicio.reduce((total, mod) => 
                              total + (mod.totalHorasExtras || 0), 0
                            )
                          )}
                        </span>
                      </div>
                    )}
                    
                    {/* Cobros Adicionales Totales */}
                    {pedidoSeleccionado.modificacionesServicio && pedidoSeleccionado.modificacionesServicio.some(mod => mod.totalCobrosAdicionales && mod.totalCobrosAdicionales > 0) && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-700 font-medium">Cobros adicionales:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(
                            pedidoSeleccionado.modificacionesServicio.reduce((total, mod) => 
                              total + (mod.totalCobrosAdicionales || 0), 0
                            )
                          )}
                        </span>
                      </div>
                    )}
                    
                    {/* Descuentos Totales */}
                    {pedidoSeleccionado.modificacionesServicio && pedidoSeleccionado.modificacionesServicio.some(mod => mod.totalDescuentos && mod.totalDescuentos > 0) && (
                      <div className="flex justify-between items-center py-2 border-b border-blue-100">
                        <span className="text-gray-700 font-medium">Descuentos:</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(
                            pedidoSeleccionado.modificacionesServicio.reduce((total, mod) => 
                              total + (mod.totalDescuentos || 0), 0
                            )
                          )}
                        </span>
                      </div>
                    )}
                    
                    {/* Total Final */}
                    <div className="flex justify-between items-center py-2 bg-blue-100 rounded-lg px-3 mt-3">
                      <span className="text-blue-900 font-bold text-lg">Total del servicio:</span>
                      <span className="text-blue-900 font-bold text-xl">
                        {formatCurrency(pedidoSeleccionado.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modificaciones del Servicio */}
                {pedidoSeleccionado.modificacionesServicio && pedidoSeleccionado.modificacionesServicio.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-blue-900 mb-2">📝 Modificaciones Aplicadas</h5>
                    <div className="space-y-2">
                      {pedidoSeleccionado.modificacionesServicio.map((mod, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border text-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-900">
                              Modificación #{index + 1}
                            </span>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">
                                {mod.fecha ? formatDate(mod.fecha, 'dd/MM HH:mm') : 'Sin fecha'}
                              </div>
                              {mod.aplicadoPor && (
                                <div className="text-xs text-gray-600 font-medium">
                                  {mod.aplicadoPor}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Horas Extras */}
                          {mod.horasExtras && mod.horasExtras.length > 0 && (
                            <div className="mb-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                              <div className="text-green-800 font-medium mb-1">⏰ Horas Extras:</div>
                              {mod.horasExtras.map((hora, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-green-700">{hora.concepto}</span>
                                  <span className="text-green-900 font-semibold">
                                    {hora.cantidad}h × {formatCurrency(hora.precioUnitario)} = {formatCurrency(hora.total)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between mt-1 pt-1 border-t border-green-200">
                                <span className="text-green-800 font-medium">Subtotal:</span>
                                <span className="text-green-900 font-semibold">
                                  +{formatCurrency(mod.totalHorasExtras || 0)}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Cobros Adicionales */}
                          {mod.cobrosAdicionales && mod.cobrosAdicionales.length > 0 && (
                            <div className="mb-2 p-2 bg-orange-50 rounded border-l-4 border-orange-400">
                              <div className="text-orange-800 font-medium mb-1">💰 Cobros Adicionales:</div>
                              {mod.cobrosAdicionales.map((cobro, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-orange-700">{cobro.concepto}</span>
                                  <span className="text-orange-900 font-semibold">+{formatCurrency(cobro.monto)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between mt-1 pt-1 border-t border-orange-200">
                                <span className="text-orange-800 font-medium">Subtotal:</span>
                                <span className="text-orange-900 font-semibold">
                                  +{formatCurrency(mod.totalCobrosAdicionales || 0)}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Descuentos */}
                          {mod.descuentos && mod.descuentos.length > 0 && (
                            <div className="mb-2 p-2 bg-red-50 rounded border-l-4 border-red-400">
                              <div className="text-red-800 font-medium mb-1">🎯 Descuentos:</div>
                              {mod.descuentos.map((desc, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-red-700">{desc.concepto}</span>
                                  <span className="text-red-900 font-semibold">-{formatCurrency(desc.monto)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between mt-1 pt-1 border-t border-red-200">
                                <span className="text-red-800 font-medium">Subtotal:</span>
                                <span className="text-red-900 font-semibold">
                                  -{formatCurrency(mod.totalDescuentos || 0)}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Observaciones de la modificación */}
                          {mod.observaciones && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <span className="text-gray-600 font-medium">Observación:</span>
                              <span className="text-gray-700 ml-1">{mod.observaciones}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumen de Pagos */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 shadow-sm mt-4">
                  <h5 className="font-semibold text-green-900 mb-3 flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Estado de Pagos
                  </h5>
                  
                  {pedidoSeleccionado.pagosRealizados && pedidoSeleccionado.pagosRealizados.length > 0 ? (
                    <div className="space-y-3">
                      {/* Lista de Pagos */}
                      {pedidoSeleccionado.pagosRealizados.map((pago, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border border-green-200 shadow-sm">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-sm font-bold">#{index + 1}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(pago.monto)} - {pago.medioPago}
                              </div>
                              <div className="text-xs text-gray-500">
                                {pago.fecha && !isNaN(new Date(pago.fecha).getTime()) 
                                  ? formatDate(pago.fecha, 'dd/MM HH:mm') 
                                  : 'Sin fecha'
                                }
                                {pago.registradoPor && (
                                  <span className="text-gray-600"> • {pago.registradoPor}</span>
                                )}
                                {pago.referencia && ` • Ref: ${pago.referencia}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-green-600">
                              {formatCurrency(pago.monto)}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Totales */}
                      <div className="space-y-2 pt-3 border-t border-green-200">
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm font-medium text-gray-700">Total Pagado:</span>
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(pedidoSeleccionado.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0))}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center py-2 bg-red-50 rounded-lg px-3">
                          <span className="text-sm font-medium text-red-700">Saldo Pendiente:</span>
                          <span className="text-lg font-bold text-red-600">
                            {formatCurrency(Math.max(0, pedidoSeleccionado.total - pedidoSeleccionado.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0)))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 bg-white rounded-lg border border-green-200">
                      <div className="text-3xl mb-3">💸</div>
                      <div className="font-medium text-gray-700 mb-1">Sin pagos realizados</div>
                      <div className="text-sm text-gray-500">Saldo pendiente: {formatCurrency(pedidoSeleccionado.total)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial de Modificaciones */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historial de Modificaciones
                </h4>
                
                <div className="space-y-3">
                  {(() => {
                    const timeline = generarTimelineServicio(pedidoSeleccionado, planes, nombreCreadorPedido);
                    return timeline.map((evento, index) => (
                      <div key={evento.id} className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          evento.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                          evento.color === 'green' ? 'bg-green-100 text-green-600' :
                          evento.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                          evento.color === 'red' ? 'bg-red-100 text-red-600' :
                          evento.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {evento.icono}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-gray-900">{evento.titulo}</h5>
                            <div className="text-right">
                              <span className="text-xs text-gray-500">{formatearFechaTimeline(evento.fecha)}</span>
                              {/* Mostrar usuario si está disponible en el evento */}
                              {evento.usuario && (
                                <div className="text-xs text-gray-600 font-medium">{evento.usuario}</div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">{evento.descripcion}</p>
                          
                          {/* Mostrar montos según el tipo de evento */}
                          {evento.monto !== undefined && (
                            <div className="mt-2 flex items-center space-x-2">
                              {evento.tipo === 'cambio_plan' && evento.montoAnterior && evento.montoNuevo ? (
                                <div className="text-xs">
                                  <span className="text-gray-500">Valor anterior: </span>
                                  <span className="font-medium text-gray-700">{formatCurrency(evento.montoAnterior)}</span>
                                  <span className="mx-1">→</span>
                                  <span className="text-gray-500">Nuevo: </span>
                                  <span className={`font-medium ${evento.monto > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(evento.montoNuevo)}
                                  </span>
                                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                    {evento.monto > 0 ? '+' : ''}{formatCurrency(evento.monto)}
                                  </span>
                                </div>
                              ) : (
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  evento.monto > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {evento.monto > 0 ? '+' : ''}{formatCurrency(evento.monto)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                  
                  {(() => {
                    const timeline = generarTimelineServicio(pedidoSeleccionado, planes);
                    if (timeline.length === 0) {
                      return (
                        <div className="text-center py-4 text-gray-500">
                          <div className="text-2xl mb-2">📋</div>
                          <div className="font-medium">Sin modificaciones registradas</div>
                          <div className="text-sm">El servicio se mantiene con su configuración original</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Observaciones */}
              {pedidoSeleccionado.observaciones && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Observaciones</h4>
                  <p className="text-sm text-gray-700">{pedidoSeleccionado.observaciones}</p>
                </div>
              )}

              {/* Botón de Cerrar */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={() => setMostrarModalDetalles(false)}
                  className="btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal de Cancelación */}
      {mostrarModalCancelacion && pedidoACancelar && (
        <ModalCancelacion
          isOpen={mostrarModalCancelacion}
          onClose={() => {
            setMostrarModalCancelacion(false);
            setPedidoACancelar(null);
          }}
          onConfirm={handleConfirmarCancelacion}
          pedidoInfo={{
            cliente: pedidoACancelar.cliente.name,
            plan: pedidoACancelar.plan.name
          }}
        />
      )}

      

      {/* Modal de Liquidación */}
      {mostrarModalLiquidacion && pedidoAFacturar && (
        <ModalLiquidacion
          isOpen={mostrarModalLiquidacion}
          onClose={() => {
            setMostrarModalLiquidacion(false);
            setPedidoAFacturar(null);
          }}
          onConfirm={handleLiquidacion}
          pedido={pedidoAFacturar}
          precioHoraAdicional={configuracion?.horaAdicional || 2000}
        />
      )}

      {/* Modal de Liquidación Universal */}
      {mostrarModalLiquidacionUniversal && pedidoALiquidar && (
        <ModalLiquidacionUniversal
          isOpen={mostrarModalLiquidacionUniversal}
          onClose={() => {
            setMostrarModalLiquidacionUniversal(false);
            setPedidoALiquidar(null);
          }}
          onConfirm={handleLiquidacionUniversal}
          pedido={pedidoALiquidar}
        />
      )}

      {/* Modal de Entrega Operativa */}
      {mostrarModalEntregaOperativa && pedidoAValidar && (
        <ModalEntregaOperativa
          isOpen={mostrarModalEntregaOperativa}
          onClose={() => {
            setMostrarModalEntregaOperativa(false);
            setPedidoAValidar(null);
          }}
          onConfirm={handleEntregaOperativa}
          pedido={pedidoAValidar}
          lavadoras={lavadoras}
        />
      )}

      {/* Modal de Recogida Operativa */}
      {mostrarModalRecogidaOperativa && pedidoParaRecogida && (
        <ModalRecogidaOperativa
          isOpen={mostrarModalRecogidaOperativa}
          onClose={() => {
            setMostrarModalRecogidaOperativa(false);
            setPedidoParaRecogida(null);
          }}
          onConfirm={handleRecogidaOperativa}
          pedido={pedidoParaRecogida}
        />
      )}

      {/* Modal de Foto de Instalación */}
      {mostrarModalFoto && pedidoParaFoto && (
        <ModalFotoInstalacion
          isOpen={mostrarModalFoto}
          onClose={() => {
            setMostrarModalFoto(false);
            setPedidoParaFoto(null);
          }}
          pedido={pedidoParaFoto}
        />
      )}

      {/* Modal de WhatsApp */}
      {mostrarModalWhatsApp && pedidoParaWhatsApp && (
        <ModalWhatsApp
          isOpen={mostrarModalWhatsApp}
          onClose={() => {
            setMostrarModalWhatsApp(false);
            setPedidoParaWhatsApp(null);
            setFotoEvidenciaWhatsApp(null);
          }}
          pedido={pedidoParaWhatsApp}
          fotoEvidencia={fotoEvidenciaWhatsApp || undefined}
        />
      )}

      {/* Modal de modificaciones unificado */}
      {mostrarModalModificaciones && pedidoParaModificar && (
        <ModalModificacionesServicio
          isOpen={mostrarModalModificaciones}
          onClose={() => {
            setMostrarModalModificaciones(false);
            setPedidoParaModificar(null);
          }}
          pedido={pedidoParaModificar}
          planes={planes}
          onModificacionAplicada={handleModificacionesServicio}
        />
      )}

      {/* Modal de Pagos */}
      {pedidoParaPago && (
        <ModalPagos
          isOpen={mostrarModalPagos}
          onClose={() => {
            setMostrarModalPagos(false);
            setPedidoParaPago(null);
          }}
          pedido={pedidoParaPago}
          onPagoRealizado={handlePagoRealizado}
        />
      )}

      {/* Resumen final del servicio */}
      {mostrarResumenFinal && pedidoParaModificar && (
        <ResumenFinalServicio
          pedido={pedidoParaModificar}
          onClose={() => {
            setMostrarResumenFinal(false);
            setPedidoParaModificar(null);
          }}
        />
      )}

      {/* Modal de Calendario de Horarios */}
      <CalendarioHorarios
        isOpen={mostrarCalendarioHorarios}
        onClose={() => setMostrarCalendarioHorarios(false)}
        pedidos={pedidos}
        lavadoras={lavadoras}
      />

      {/* Modal de Estado de Lavadoras */}
      {mostrarEstadoLavadoras && (
        <EstadoLavadorasModal 
          isOpen={mostrarEstadoLavadoras}
          onClose={() => setMostrarEstadoLavadoras(false)}
          lavadoras={lavadoras}
          onCargarTodosLosPedidos={cargarTodosLosPedidos}
        />
      )}
    </div>
  );
};

export default Pedidos;



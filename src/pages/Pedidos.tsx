import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardDocumentListIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  PlusIcon,
  CalendarIcon,
  XMarkIcon,
  CameraIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { pedidoService, configService, lavadoraService } from '../services/firebaseService';
import { entregaOperativaService } from '../services/entregaOperativaService';
import { recogidaOperativaService } from '../services/recogidaOperativaService';
import { modificacionesService } from '../services/modificacionesService';
import { useAuth } from '../contexts/AuthContext';
import { Pedido } from '../types';
import { formatDate, formatCurrency, calculatePickupDate, getCurrentDateColombia } from '../utils/dateUtils';
import NuevoPedido from './NuevoPedido';
import EditarPedido from '../components/EditarPedido';
import ModalCancelacion from '../components/ModalCancelacion';
import ModalLiquidacion from '../components/ModalLiquidacion';
import ModalLiquidacionUniversal from '../components/ModalLiquidacionUniversal';
import ModalEntregaOperativa from '../components/ModalEntregaOperativa';
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
  const { firebaseUser } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarNuevoPedido, setMostrarNuevoPedido] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [pedidoACancelar, setPedidoACancelar] = useState<Pedido | null>(null);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [pedidoAEditar, setPedidoAEditar] = useState<Pedido | null>(null);
  
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
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Lunes de esta semana
      return inicioSemana;
    })(),
    fechaFin: (() => {
      const hoy = getCurrentDateColombia();
      const finSemana = new Date(hoy);
      finSemana.setDate(hoy.getDate() + (6 - hoy.getDay())); // Domingo de esta semana
      return finSemana;
    })(),
    estado: 'todos',
    tipoFiltro: 'semana'
  });

  useEffect(() => {
    cargarPedidos();
    cargarConfiguracion();
    cargarLavadoras();
    cargarPlanes();
  }, [filtros]);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      // Obtener todos los pedidos de una vez (más eficiente que múltiples consultas)
      const todosLosPedidos = await pedidoService.getAllPedidos();
      console.log('🔍 Total pedidos cargados desde Firebase:', todosLosPedidos.length);
      
      // Filtrar por rango de fechas localmente
      const fechaInicio = new Date(filtros.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(filtros.fechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      
      console.log('📅 Rango de fechas:', fechaInicio.toISOString(), 'a', fechaFin.toISOString());
      
      const pedidosFiltradosPorFecha = todosLosPedidos.filter(pedido => {
        const fechaPedido = new Date(pedido.fechaAsignacion);
        const dentroDelRango = fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
        
        // Log para pedidos con lavadora asignada
        if (pedido.lavadoraAsignada) {
          console.log(`🔍 Pedido ${pedido.id} con lavadora ${pedido.lavadoraAsignada.codigoQR}:`, {
            fechaAsignacion: pedido.fechaAsignacion,
            fechaPedido: fechaPedido.toISOString(),
            dentroDelRango,
            estado: pedido.status
          });
        }
        
        return dentroDelRango;
      });
      
      console.log('📊 Pedidos después del filtro de fecha:', pedidosFiltradosPorFecha.length);
      setPedidos(pedidosFiltradosPorFecha);
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
    return pedidos.filter(pedido => {
      const cumpleFiltro = filtros.estado === 'todos' || pedido.status === filtros.estado;
      const cumpleBusqueda = busqueda === '' || 
        pedido.cliente.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        pedido.cliente.phone.includes(busqueda);
      
      return cumpleFiltro && cumpleBusqueda;
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
      } else if (nuevoEstado === 'entregado') {
        updateData.fechaEntrega = fechaActual;
        updateData.fechaRecogida = undefined;
        // Calcular fecha de recogida según el plan
        updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan, pedido.horasAdicionales);
        // Recalcular total con horas adicionales y descuentos
        updateData.total = pedido.plan.price + (pedido.horasAdicionales * 2000) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
      } else if (nuevoEstado === 'recogido') {
        // Solo establecer fecha de recogida (la entrega ya debe existir por validación)
        updateData.fechaRecogida = fechaActual;
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
        <div className="relative">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              console.log('Botón Entregar clickeado para pedido:', pedido.id);
              
              // Recargar lavadoras antes de abrir el modal para tener datos actualizados
              await cargarLavadoras();
              
              setPedidoAValidar(pedido);
              setMostrarModalEntregaOperativa(true);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors w-24"
            title="Validar QR y entregar"
          >
            Entregar
          </button>
          {/* Badge de liquidación en esquina */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isPagado) {
                setPedidoALiquidar(pedido);
                setMostrarModalLiquidacionUniversal(true);
              }
            }}
            className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all hover:scale-110 ${
              isPagado ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
            }`}
            title={isPagado ? 'Pagado' : `Liquidar: ${formatCurrency(saldoPendiente)}`}
          >
            {isPagado ? '✓' : '💰'}
          </button>
        </div>
      );
    } else if (pedido.status === 'entregado') {
      return (
        <div className="relative flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPedidoAFacturar(pedido);
              setMostrarModalLiquidacion(true);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors w-24"
            title="Liquidar y recoger"
          >
            Recoger
          </button>
          
          {/* Botones de modificaciones */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPedidoParaModificar(pedido);
                setMostrarModalModificaciones(true);
              }}
              className="px-2 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
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
              className="px-2 py-1 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded transition-colors"
              title="Registrar pago"
            >
              💰
            </button>
          </div>
        </div>
      );
    } else if (pedido.status === 'recogido') {
      return (
        <div className="relative">
          <span className="px-4 py-2 text-sm font-medium text-white bg-gray-500 rounded-md w-24 inline-block text-center">
            Completado
          </span>
          {/* Badge de liquidación en esquina */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isPagado) {
                setPedidoALiquidar(pedido);
                setMostrarModalLiquidacionUniversal(true);
              }
            }}
            className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all hover:scale-110 ${
              isPagado ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
            }`}
            title={isPagado ? 'Pagado' : `Liquidar: ${formatCurrency(saldoPendiente)}`}
          >
            {isPagado ? '✓' : '💰'}
          </button>
        </div>
      );
    }
    return null;
  };

  const verDetallesPedido = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setMostrarModalDetalles(true);
  };

  const editarPedido = (pedido: Pedido) => {
    setPedidoAEditar(pedido);
    setMostrarModalEditar(true);
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
      
      console.log('🗑️ Eliminando pedido de la base de datos...');
      await pedidoService.deletePedido(pedido.id);
      console.log('✅ Pedido eliminado exitosamente');
      
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
      
      const updateData: Partial<Pedido> = {
        descuentos: liquidacion.descuentos,
        reembolsos: liquidacion.reembolsos,
        horasAdicionales: liquidacion.horasAdicionales,
        observacionesPago: liquidacion.observacionesPago,
        updatedAt: new Date(),
        status: 'recogido', // Cambiar estado a recogido
        fechaRecogida: new Date() // Agregar fecha de recogida
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
      const nuevoPago: any = {
        monto: paymentData.amount,
        medioPago: paymentData.medioPago,
        fecha: new Date(),
        isPartial: paymentData.isPartial,
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
    if (!pedidoAValidar) return;

    const result = await recogidaOperativaService.procesarRecogidaOperativa(
      pedidoAValidar,
      recogidaData,
      {
        onSuccess: (pedidoActualizado) => {
          console.log('Pedidos - Recogida operativa exitosa');
          
          // Cerrar modal de entrega operativa
          setMostrarModalEntregaOperativa(false);
          
          // Mostrar resumen final del servicio
          setPedidoParaModificar(pedidoActualizado);
          setMostrarResumenFinal(true);
      
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
      alert('Pago registrado exitosamente');
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

        {/* Lista de pedidos mejorada */}
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Cliente
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Plan
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Pedido
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Entrega
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Recogida
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Evidencia
                  </th>
                </tr>
              </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {pedidosFiltrados.map((pedido, index) => (
                    <tr key={pedido.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group">
                      {/* Acciones */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-2">
                          {/* Botón progresivo de estado */}
                          {getProgresoButton(pedido)}
                          
                          {/* Separador visual */}
                          <div className="w-px h-6 bg-gray-300"></div>
                          
                            <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                                  e.stopPropagation();
                                  editarPedido(pedido);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="Editar"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                              if (confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
                                eliminarPedido(pedido);
                              }
                            }}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Eliminar"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                            </div>
                          </div>
                        </td>
                        {/* Cliente */}
                        <td className="px-3 py-4 whitespace-nowrap cursor-pointer" onClick={() => verDetallesPedido(pedido)}>
                          <div className="flex items-center space-x-2">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                                <span className="text-sm font-bold text-white">
                                  {pedido.cliente.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {pedido.cliente.name}
                                </div>
                                {detectarInconsistencias(pedido).length > 0 && (
                                  <div className="flex items-center" title={`Inconsistencias: ${detectarInconsistencias(pedido).join(', ')}`}>
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                      ⚠️ Inconsistente
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 truncate">
                                {pedido.cliente.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Plan */}
                        <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => verDetallesPedido(pedido)}>
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-green-800">
                                {pedido.plan.name}
                              </div>
                              {pedido.recogidaPrioritaria && (
                                <div className="flex items-center space-x-1">
                                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                                    ⏰ Recogida Prioritaria
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-green-600">
                              {formatCurrency(pedido.plan.price)}
                            </div>
                            {pedido.recogidaPrioritaria && pedido.horaRecogida && (
                              <div className="text-xs text-orange-600 font-medium mt-1">
                                Hora: {pedido.horaRecogida}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Total */}
                        <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => verDetallesPedido(pedido)}>
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(pedido.total)}
                          </div>
                        </td>
                        {/* Pedido */}
                        <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => verDetallesPedido(pedido)}>
                          <div className="text-sm text-gray-900">
                            {formatDate(pedido.createdAt, 'dd/MM/yyyy')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(pedido.createdAt, 'HH:mm')}
                          </div>
                        </td>
                        {/* Entrega */}
                        <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => verDetallesPedido(pedido)}>
                          <div className="text-sm text-gray-900">
                            {pedido.status === 'entregado' && pedido.fechaEntrega ? formatDate(pedido.fechaEntrega, 'dd/MM HH:mm') : (
                              <span className="text-gray-400 italic">Pendiente</span>
                            )}
                          </div>
                        </td>
                        {/* Recogida */}
                        <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => verDetallesPedido(pedido)}>
                          <div className="text-sm text-gray-900">
                            {pedido.status === 'recogido' && pedido.fechaRecogida ? (
                              formatDate(pedido.fechaRecogida, 'dd/MM HH:mm')
                            ) : (
                              <span className="text-gray-400 italic">Pendiente</span>
                            )}
                          </div>
                        </td>
                        {/* Evidencia */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          {(pedido.validacionQR?.fotoInstalacion || 
                            (pedido as any).validacionQR_fotoInstalacion ||
                            pedido.lavadoraAsignada?.fotoInstalacion) ? (
                            <button 
                              type="button"
                              onClick={() => verFotoInstalacion(pedido)}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200"
                              title="Ver foto de instalación"
                            >
                              <CameraIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <div className="p-2 text-gray-300">
                              <CameraIcon className="h-4 w-4" />
                            </div>
                          )}
                        </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

              {/* Información del Plan */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Plan</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Plan:</span>
                    <span className="ml-2 font-medium">{pedidoSeleccionado.plan.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Duración:</span>
                    <span className="ml-2 font-medium">
                      {pedidoSeleccionado.status === 'recogido' && pedidoSeleccionado.fechaEntrega && pedidoSeleccionado.fechaRecogida
                        ? calcularDuracionReal(pedidoSeleccionado)
                        : `${pedidoSeleccionado.plan.duration}h`
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Precio:</span>
                    <span className="ml-2 font-medium">{formatCurrency(pedidoSeleccionado.plan.price)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Estado:</span>
                    <span className="ml-2">{getStatusBadge(pedidoSeleccionado.status)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Estado de Pago:</span>
                    <span className="ml-2">
                      {pedidoSeleccionado.pagosRealizados && pedidoSeleccionado.pagosRealizados.length > 0 ? (
                        pedidoSeleccionado.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0) >= pedidoSeleccionado.total ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✅ Pagado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⚠️ Parcial
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ❌ Pendiente
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {/* Información de Recogida Prioritaria */}
                  {pedidoSeleccionado.recogidaPrioritaria && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
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
                  {/* Paso 1: Asignación */}
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">1</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">Pedido Asignado</span>
                        <span className="text-sm text-gray-500">{pedidoSeleccionado.fechaAsignacion ? formatDate(pedidoSeleccionado.fechaAsignacion, 'dd/MM/yyyy HH:mm') : 'Sin fecha'}</span>
                      </div>
                      <p className="text-xs text-gray-500">Se creó el pedido y se asignó al cliente</p>
                    </div>
                  </div>

                  {/* Paso 2: Entrega */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      pedidoSeleccionado.status === 'pendiente' ? 'bg-gray-300' : 'bg-green-500'
                    }`}>
                      <span className={`text-xs font-bold ${
                        pedidoSeleccionado.status === 'pendiente' ? 'text-gray-600' : 'text-white'
                      }`}>2</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {pedidoSeleccionado.status === 'pendiente' ? 'Entrega Pendiente' : 'Lavadora Entregada'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {pedidoSeleccionado.status === 'pendiente' 
                            ? (pedidoSeleccionado.fechaEntrega ? formatDate(pedidoSeleccionado.fechaEntrega, 'dd/MM/yyyy HH:mm') : 'Pendiente')
                            : (pedidoSeleccionado.fechaEntrega ? formatDate(pedidoSeleccionado.fechaEntrega, 'dd/MM/yyyy HH:mm') : '-')
                          }
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {pedidoSeleccionado.status === 'pendiente' 
                          ? 'Se entregará la lavadora al cliente'
                          : 'Lavadora entregada al cliente'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Paso 3: Recogida */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      pedidoSeleccionado.status === 'recogido' ? 'bg-purple-500' : 
                      pedidoSeleccionado.status === 'entregado' ? 'bg-yellow-500' : 'bg-gray-300'
                    }`}>
                      <span className={`text-xs font-bold ${
                        pedidoSeleccionado.status === 'recogido' || pedidoSeleccionado.status === 'entregado' ? 'text-white' : 'text-gray-600'
                      }`}>3</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {pedidoSeleccionado.status === 'recogido' ? 'Lavadora Recogida' :
                           pedidoSeleccionado.status === 'entregado' ? 'Recogida Programada' : 'Recogida Pendiente'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {pedidoSeleccionado.status === 'recogido' 
                            ? (pedidoSeleccionado.fechaRecogida ? formatDate(pedidoSeleccionado.fechaRecogida, 'dd/MM/yyyy HH:mm') : '-')
                            : pedidoSeleccionado.status === 'entregado' && pedidoSeleccionado.fechaRecogidaCalculada
                            ? (pedidoSeleccionado.fechaRecogidaCalculada ? formatDate(pedidoSeleccionado.fechaRecogidaCalculada, 'dd/MM/yyyy HH:mm') : 'No calculable')
                            : 'Pendiente'
                          }
                        </span>
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
                </div>
              </div>

              {/* Información de Lavadora */}
              {pedidoSeleccionado.lavadoraAsignada && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Lavadora Asignada</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Código QR:</span>
                      <span className="ml-2 font-medium">{pedidoSeleccionado.lavadoraAsignada.codigoQR}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Marca:</span>
                      <span className="ml-2 font-medium">{pedidoSeleccionado.lavadoraAsignada.marca}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Modelo:</span>
                      <span className="ml-2 font-medium">{pedidoSeleccionado.lavadoraAsignada.modelo}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Estado:</span>
                      <span className="ml-2 font-medium capitalize">Asignada</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pagos y Descuentos */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Pagos y Descuentos</h4>
                <div className="space-y-2 text-sm">
                  {/* Pagos Realizados */}
                  {pedidoSeleccionado.pagosRealizados && pedidoSeleccionado.pagosRealizados.length > 0 ? (
                    <div>
                      <span className="text-gray-500">Pagos Realizados:</span>
                      <ul className="ml-4 mt-1 space-y-1">
                        {pedidoSeleccionado.pagosRealizados.map((pago, index) => (
                          <li key={index} className="text-sm">
                            {formatCurrency(pago.monto)} - {pago.medioPago} ({pago.fecha && !isNaN(new Date(pago.fecha).getTime()) ? formatDate(pago.fecha, 'dd/MM HH:mm') : 'Sin fecha'})
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between mt-2 pt-2 border-t">
                        <span className="text-gray-500">Total Pagado:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(pedidoSeleccionado.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Saldo Pendiente:</span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(pedidoSeleccionado.total - pedidoSeleccionado.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0))}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No hay pagos realizados
                    </div>
                  )}
                  
                  {pedidoSeleccionado.horasAdicionales > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Horas Adicionales:</span>
                      <span className="font-medium">{pedidoSeleccionado.horasAdicionales}h (+{formatCurrency(pedidoSeleccionado.horasAdicionales * 2000)})</span>
                    </div>
                  )}
                  {pedidoSeleccionado.descuentos.length > 0 && (
                    <div>
                      <span className="text-gray-500">Descuentos:</span>
                      <ul className="ml-4 mt-1">
                        {pedidoSeleccionado.descuentos.map((desc, index) => (
                          <li key={index} className="text-sm">
                            {desc.reason}: -{formatCurrency(desc.amount)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-500 font-medium">Total del Servicio:</span>
                    <span className="font-bold text-lg">{formatCurrency(pedidoSeleccionado.total)}</span>
                  </div>
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

      {/* Modal de Editar Pedido */}
      {mostrarModalEditar && pedidoAEditar && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Editar Servicio</h3>
              <button
                onClick={() => setMostrarModalEditar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <EditarPedido 
              pedido={pedidoAEditar} 
              onClose={() => setMostrarModalEditar(false)}
              onSave={(pedidoActualizado) => {
                cargarPedidos();
                setMostrarModalEditar(false);
              }}
            />
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



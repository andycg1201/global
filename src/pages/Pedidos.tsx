import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardDocumentListIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  PlusIcon,
  CalendarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { pedidoService, configService, lavadoraService } from '../services/firebaseService';
import { Pedido } from '../types';
import { formatDate, formatCurrency, calculatePickupDate, getCurrentDateColombia } from '../utils/dateUtils';
import NuevoPedido from './NuevoPedido';
import EditarPedido from '../components/EditarPedido';
import ModalCancelacion from '../components/ModalCancelacion';
import ModalFacturacion from '../components/ModalFacturacion';
import ModalLiquidacion from '../components/ModalLiquidacion';
import ModalValidacionQR from '../components/ModalValidacionQR';
import CalendarPicker from '../components/CalendarPicker';

interface FiltrosPedidos {
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  tipoFiltro: 'hoy' | 'ayer' | 'personalizado';
}

const Pedidos: React.FC = () => {
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
  
  // Estados para modales de facturación
  const [mostrarModalFacturacion, setMostrarModalFacturacion] = useState(false);
  const [mostrarModalLiquidacion, setMostrarModalLiquidacion] = useState(false);
  const [pedidoAFacturar, setPedidoAFacturar] = useState<Pedido | null>(null);
  const [configuracion, setConfiguracion] = useState<any>(null);
  
  // Estados para validación QR
  const [mostrarModalValidacionQR, setMostrarModalValidacionQR] = useState(false);
  const [pedidoAValidar, setPedidoAValidar] = useState<Pedido | null>(null);
  const [lavadoras, setLavadoras] = useState<any[]>([]);
  
  // Estados para calendario de horarios
  const [mostrarCalendarioHorarios, setMostrarCalendarioHorarios] = useState(false);
  
  const [filtros, setFiltros] = useState<FiltrosPedidos>({
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia(),
    estado: 'todos',
    tipoFiltro: 'hoy'
  });

  useEffect(() => {
    cargarPedidos();
    cargarConfiguracion();
    cargarLavadoras();
  }, [filtros]);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      // Obtener todos los pedidos de una vez (más eficiente que múltiples consultas)
      const todosLosPedidos = await pedidoService.getAllPedidos();
      
      // Filtrar por rango de fechas localmente
      const fechaInicio = new Date(filtros.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(filtros.fechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      
      const pedidosFiltradosPorFecha = todosLosPedidos.filter(pedido => {
        const fechaPedido = new Date(pedido.fechaAsignacion);
        return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
      });
      
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
    } catch (error) {
      console.error('Error al cargar lavadoras:', error);
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

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer') => {
    const hoy = getCurrentDateColombia();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    switch (tipo) {
      case 'hoy':
        setFiltros(prev => ({ ...prev, fechaInicio: hoy, fechaFin: hoy, tipoFiltro: 'hoy' }));
        break;
      case 'ayer':
        setFiltros(prev => ({ ...prev, fechaInicio: ayer, fechaFin: ayer, tipoFiltro: 'ayer' }));
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

  const cambiarEstadoPedido = async (pedido: Pedido, nuevoEstado: 'pendiente' | 'entregado' | 'recogido' | 'cancelado') => {
    const nombresEstados = {
      pendiente: 'Pendiente',
      entregado: 'Entregado',
      recogido: 'Recogido',
      cancelado: 'Cancelado'
    };

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
        updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan.id, pedido.horasAdicionales);
        // Recalcular total con horas adicionales y descuentos
        updateData.total = pedido.plan.price + (pedido.horasAdicionales * 2000) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
      } else if (nuevoEstado === 'recogido') {
        // Si no tiene fecha de entrega, la asignamos también
        if (!pedido.fechaEntrega) {
          updateData.fechaEntrega = fechaActual;
          updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan.id, pedido.horasAdicionales);
          updateData.total = pedido.plan.price + (pedido.horasAdicionales * 2000) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
        }
        updateData.fechaRecogida = fechaActual;
      } else if (nuevoEstado === 'cancelado') {
        // Para cancelado, mantenemos las fechas existentes
      }

      await pedidoService.updatePedido(pedido.id, updateData);
      
      // Si se marca como recogido y tiene lavadora asignada, liberar la lavadora
      if (nuevoEstado === 'recogido' && pedido.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
      }
      
      cargarPedidos();
      alert(`Pedido actualizado a estado "${nombresEstados[nuevoEstado]}"`);
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
        updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan.id, pedido.horasAdicionales);
        // Obtener configuración para precio de hora adicional
        const config = await configService.getConfiguracion();
        const precioHoraAdicional = config?.horaAdicional || 2000;
        updateData.total = pedido.plan.price + (pedido.horasAdicionales * precioHoraAdicional) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
      } else if (nuevoEstado === 'recogido') {
        if (!pedido.fechaEntrega) {
          updateData.fechaEntrega = fechaActual;
          updateData.fechaRecogidaCalculada = calculatePickupDate(fechaActual, pedido.plan.id, pedido.horasAdicionales);
          // Obtener configuración para precio de hora adicional
          const config = await configService.getConfiguracion();
          const precioHoraAdicional = config?.horaAdicional || 2000;
          updateData.total = pedido.plan.price + (pedido.horasAdicionales * precioHoraAdicional) - pedido.descuentos.reduce((sum, d) => sum + d.amount, 0);
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

  const getProgresoButton = (pedido: Pedido) => {
    if (pedido.status === 'pendiente') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Botón Entregar clickeado para pedido:', pedido.id);
            setPedidoAValidar(pedido);
            setMostrarModalValidacionQR(true);
          }}
          className="px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors w-24"
          title="Validar QR y entregar"
        >
          Entregar
        </button>
      );
    } else if (pedido.status === 'entregado') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPedidoAFacturar(pedido);
            setMostrarModalLiquidacion(true);
          }}
          className="px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors w-24"
          title="Liquidar y recoger"
        >
          Recoger
        </button>
      );
    } else if (pedido.status === 'recogido') {
      return (
        <span className="px-4 py-3 text-sm font-medium text-white bg-gray-500 rounded-md w-24 inline-block text-center">
          Completado
        </span>
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
      // Liberar la lavadora asignada si existe
      if (pedido.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedido.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
      }
      
      await pedidoService.deletePedido(pedido.id);
      cargarPedidos();
      setMostrarModalDetalles(false);
      alert('Pedido eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar pedido:', error);
      alert('Error al eliminar el pedido');
    }
  };

  const handleFacturacion = async (facturacion: any) => {
    console.log('handleFacturacion llamado con:', facturacion);
    console.log('pedidoAFacturar:', pedidoAFacturar);
    
    if (!pedidoAFacturar) {
      console.log('No hay pedido para facturar');
      return;
    }
    
    try {
      console.log('Iniciando proceso de facturación...');
      
      const updateData: Partial<Pedido> = {
        cobrosAdicionales: facturacion.cobrosAdicionales,
        horasAdicionales: facturacion.horasAdicionales,
        observacionesPago: facturacion.observacionesPago,
        updatedAt: new Date(),
        status: 'entregado', // Cambiar estado a entregado
        fechaEntrega: new Date() // Agregar fecha de entrega
      };

      // Si no pagó anticipado, agregar método de pago
      if (pedidoAFacturar.estadoPago !== 'pagado_anticipado' && facturacion.paymentMethod) {
        updateData.paymentMethod = facturacion.paymentMethod;
        updateData.estadoPago = 'pagado_entrega';
      } else if (pedidoAFacturar.estadoPago === 'pagado_anticipado') {
        updateData.estadoPago = 'pagado_entrega';
      }

      // Recalcular totales
      const subtotal = pedidoAFacturar.plan.price;
      const totalCobrosAdicionales = facturacion.cobrosAdicionales.reduce((sum: number, cobro: any) => sum + cobro.monto, 0);
      const totalHorasAdicionales = facturacion.horasAdicionales * (configuracion?.horaAdicional || 2000);
      
      updateData.subtotal = subtotal;
      updateData.totalCobrosAdicionales = totalCobrosAdicionales;
      updateData.total = subtotal + totalCobrosAdicionales + totalHorasAdicionales;

      console.log('Datos a actualizar:', updateData);

      await pedidoService.updatePedido(pedidoAFacturar.id, updateData);
      console.log('Pedido actualizado exitosamente');
      
      cargarPedidos();
      setMostrarModalFacturacion(false);
      setPedidoAFacturar(null);
      alert('Facturación procesada exitosamente');
    } catch (error) {
      console.error('Error al procesar facturación:', error);
      alert('Error al procesar la facturación: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
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
      if (pedidoAFacturar.estadoPago === 'pendiente' && liquidacion.paymentMethod) {
        updateData.paymentMethod = liquidacion.paymentMethod;
        updateData.estadoPago = 'pagado_recogida';
      } else if (pedidoAFacturar.estadoPago === 'pagado_entrega') {
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
    } catch (error) {
      console.error('Error al procesar liquidación:', error);
      alert('Error al procesar la liquidación: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleValidacionQR = async (validacionData: any) => {
    console.log('handleValidacionQR llamado con:', validacionData);
    console.log('pedidoAValidar:', pedidoAValidar);
    
    if (!pedidoAValidar) {
      console.log('No hay pedido para validar');
      return;
    }
    
    try {
      console.log('Iniciando proceso de validación QR...');
      
      // Buscar la lavadora escaneada
      const lavadoraEscaneada = lavadoras.find(l => l.codigoQR === validacionData.lavadoraEscaneada);
      if (!lavadoraEscaneada) {
        alert('No se encontró la lavadora escaneada');
        return;
      }

      // Verificar si la lavadora escaneada está disponible
      if (lavadoraEscaneada.estado !== 'disponible' && lavadoraEscaneada.estado !== 'alquilada') {
        alert('La lavadora escaneada no está disponible para alquiler');
        return;
      }

      // Actualizar el pedido con la información de validación QR (estructura simplificada)
      const updateData: any = {
        validacionQR_lavadoraEscaneada: validacionData.lavadoraEscaneada,
        validacionQR_lavadoraOriginal: pedidoAValidar.lavadoraAsignada?.codigoQR || '',
        validacionQR_cambioRealizado: validacionData.cambioRealizado,
        validacionQR_fechaValidacion: new Date(),
        validacionQR_fotoInstalacion: validacionData.fotoInstalacion,
        validacionQR_observacionesValidacion: validacionData.observacionesValidacion,
        updatedAt: new Date()
      };

      // Si se cambió la lavadora, actualizar la asignación
      if (validacionData.cambioRealizado) {
        // Liberar la lavadora original si existe
        if (pedidoAValidar.lavadoraAsignada) {
          await lavadoraService.updateLavadora(pedidoAValidar.lavadoraAsignada.lavadoraId, {
            estado: 'disponible'
          });
        }

        // Asignar la nueva lavadora
        await lavadoraService.updateLavadora(lavadoraEscaneada.id, {
          estado: 'alquilada'
        });

        // Actualizar la asignación en el pedido (estructura simplificada)
        updateData.lavadoraAsignada_lavadoraId = lavadoraEscaneada.id;
        updateData.lavadoraAsignada_codigoQR = lavadoraEscaneada.codigoQR;
        updateData.lavadoraAsignada_marca = lavadoraEscaneada.marca;
        updateData.lavadoraAsignada_modelo = lavadoraEscaneada.modelo;
        updateData.lavadoraAsignada_fotoInstalacion = validacionData.fotoInstalacion;
        updateData.lavadoraAsignada_observacionesInstalacion = validacionData.observacionesValidacion;

        console.log('Lavadora cambiada de', pedidoAValidar.lavadoraAsignada?.codigoQR, 'a', validacionData.lavadoraEscaneada);
      } else {
        // Solo actualizar la foto y observaciones de la lavadora original
        if (pedidoAValidar.lavadoraAsignada) {
          updateData.lavadoraAsignada_fotoInstalacion = validacionData.fotoInstalacion;
          updateData.lavadoraAsignada_observacionesInstalacion = validacionData.observacionesValidacion;
        }
      }

      console.log('Datos a actualizar:', updateData);

      // Actualizar solo los campos básicos del pedido
      const { doc, setDoc, collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const pedidoRef = doc(db, 'pedidos', pedidoAValidar.id);
      
      // Actualizar campos básicos
      await setDoc(pedidoRef, {
        validacionQR_lavadoraEscaneada: validacionData.lavadoraEscaneada,
        validacionQR_lavadoraOriginal: pedidoAValidar.lavadoraAsignada?.codigoQR || '',
        validacionQR_cambioRealizado: validacionData.cambioRealizado,
        validacionQR_fechaValidacion: new Date(),
        validacionQR_fotoInstalacion: validacionData.fotoInstalacion,
        validacionQR_observacionesValidacion: validacionData.observacionesValidacion,
        updatedAt: new Date()
      }, { merge: true });
      
      // Si hay cambios en lavadoraAsignada, actualizar por separado
      if (validacionData.cambioRealizado) {
        await setDoc(pedidoRef, {
          lavadoraAsignada_lavadoraId: lavadoraEscaneada.id,
          lavadoraAsignada_codigoQR: lavadoraEscaneada.codigoQR,
          lavadoraAsignada_marca: lavadoraEscaneada.marca,
          lavadoraAsignada_modelo: lavadoraEscaneada.modelo,
          lavadoraAsignada_fotoInstalacion: validacionData.fotoInstalacion,
          lavadoraAsignada_observacionesInstalacion: validacionData.observacionesValidacion
        }, { merge: true });
      } else if (pedidoAValidar.lavadoraAsignada) {
        await setDoc(pedidoRef, {
          lavadoraAsignada_fotoInstalacion: validacionData.fotoInstalacion,
          lavadoraAsignada_observacionesInstalacion: validacionData.observacionesValidacion
        }, { merge: true });
      }
      
      console.log('Pedido actualizado exitosamente');
      
      // Cerrar modal de validación y abrir modal de facturación
      setMostrarModalValidacionQR(false);
      setPedidoAFacturar(pedidoAValidar);
      setMostrarModalFacturacion(true);
      setPedidoAValidar(null);
      
      // Recargar datos
      cargarPedidos();
      cargarLavadoras();
      
    } catch (error) {
      console.error('Error al procesar validación QR:', error);
      alert('Error al procesar la validación QR: ' + (error instanceof Error ? error.message : 'Error desconocido'));
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
                    Gestión de Pedidos
                  </h1>
                  <p className="text-gray-600 text-lg mt-1">Administra y monitorea todos los pedidos de lavadoras</p>
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
                <PlusIcon className="h-5 w-5" />
          <span>Nuevo Pedido</span>
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
        </div>

        {/* Botón para ver calendario de horarios */}
        <div className="flex justify-center mb-4">
          <button
            onClick={() => setMostrarCalendarioHorarios(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors flex items-center gap-2"
            title="Ver horarios de lavadoras"
          >
            <CalendarIcon className="h-4 w-4" />
            Ver Horarios de Lavadoras
          </button>
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
                    Lista de Pedidos
        </h3>
                  <p className="text-sm text-gray-600">
                    {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''} encontrado{pedidosFiltrados.length !== 1 ? 's' : ''}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron pedidos</h3>
              <p className="text-gray-500 mb-6">Intenta ajustar los filtros o crear un nuevo pedido</p>
              <button
                onClick={() => setMostrarNuevoPedido(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Crear Primer Pedido
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
                    Estado
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Pago
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Entrega
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Recogida
                  </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {pedidosFiltrados.map((pedido, index) => (
                    <tr key={pedido.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer transition-all duration-200 group" onClick={() => verDetallesPedido(pedido)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                              <span className="text-sm font-bold text-white">
                                {pedido.cliente.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {pedido.cliente.name}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                              {pedido.cliente.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                          <div className="text-sm font-semibold text-green-800">
                            {pedido.plan.name}
                          </div>
                          <div className="text-xs text-green-600">
                            {formatCurrency(pedido.plan.price)}
                          </div>
                        </div>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(pedido.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEstadoPagoBadge(pedido.estadoPago)}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(pedido.fechaEntrega || pedido.fechaAsignacion, 'dd/MM HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {pedido.status === 'pendiente' ? (
                            <span className="text-gray-400 italic">Pendiente</span>
                          ) : pedido.fechaRecogida ? (
                            formatDate(pedido.fechaRecogida, 'dd/MM HH:mm')
                          ) : (
                            pedido.fechaRecogidaCalculada ? formatDate(pedido.fechaRecogidaCalculada, 'dd/MM HH:mm') : (
                              <span className="text-gray-400 italic">Pendiente</span>
                            )
                        )}
                      </div>
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(pedido.total)}
                      </div>
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
                {formatCurrency(pedidosFiltrados.reduce((sum, p) => sum + p.total, 0))}
              </span>
              </div>
              <div className="flex justify-between">
                <span>Promedio por pedido:</span>
                <span className="font-medium text-gray-600">
                  {pedidosFiltrados.length > 0 ? formatCurrency(pedidosFiltrados.reduce((sum, p) => sum + p.total, 0) / pedidosFiltrados.length) : '$0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ingresos pendientes:</span>
                <span className="font-medium text-warning-600">
                  {formatCurrency(pedidosFiltrados.filter(p => p.status === 'pendiente').reduce((sum, p) => sum + p.total, 0))}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Nuevo Pedido */}
      {mostrarNuevoPedido && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nuevo Pedido</h3>
              <button
                onClick={() => setMostrarNuevoPedido(false)}
                className="text-gray-400 hover:text-gray-600"
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
              <h3 className="text-lg font-medium text-gray-900">Detalles del Pedido</h3>
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
                    <span className="ml-2">{getEstadoPagoBadge(pedidoSeleccionado.estadoPago)}</span>
                  </div>
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
                        <span className="text-sm text-gray-500">{formatDate(pedidoSeleccionado.fechaAsignacion, 'dd/MM/yyyy HH:mm')}</span>
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
                            ? formatDate(pedidoSeleccionado.fechaRecogidaCalculada, 'dd/MM/yyyy HH:mm')
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

              {/* Pagos y Descuentos */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Pagos y Descuentos</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Método de Pago:</span>
                    <span className="font-medium">
                      {pedidoSeleccionado.paymentMethod?.method || 'No especificado'}
                    </span>
                  </div>
                  {pedidoSeleccionado.horasAdicionales > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Horas Adicionales:</span>
                      <span className="font-medium">{pedidoSeleccionado.horasAdicionales}h</span>
                    </div>
                  )}
                  {pedidoSeleccionado.descuentos.length > 0 && (
                    <div>
                      <span className="text-gray-500">Descuentos:</span>
                      <ul className="ml-4 mt-1">
                        {pedidoSeleccionado.descuentos.map((desc, index) => (
                          <li key={index} className="text-sm">
                            {desc.reason}: {formatCurrency(desc.amount)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-500 font-medium">Total:</span>
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
              <h3 className="text-lg font-medium text-gray-900">Editar Pedido</h3>
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

      {/* Modal de Facturación */}
      {mostrarModalFacturacion && pedidoAFacturar && (
        <ModalFacturacion
          isOpen={mostrarModalFacturacion}
          onClose={() => {
            console.log('Cerrando modal de facturación');
            setMostrarModalFacturacion(false);
            setPedidoAFacturar(null);
          }}
          onConfirm={handleFacturacion}
          pedido={pedidoAFacturar}
          precioHoraAdicional={configuracion?.horaAdicional || 2000}
        />
      )}
      
      {/* Debug info */}
      {(() => {
        console.log('Renderizando Pedidos - mostrarModalFacturacion:', mostrarModalFacturacion, 'pedidoAFacturar:', pedidoAFacturar?.id, 'configuracion:', !!configuracion);
        return null;
      })()}

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

      {/* Modal de Validación QR */}
      {mostrarModalValidacionQR && pedidoAValidar && (
        <ModalValidacionQR
          isOpen={mostrarModalValidacionQR}
          onClose={() => {
            setMostrarModalValidacionQR(false);
            setPedidoAValidar(null);
          }}
          onConfirm={handleValidacionQR}
          pedido={pedidoAValidar}
          lavadoras={lavadoras}
        />
      )}

      {/* Modal de Horarios de Lavadoras */}
      {mostrarCalendarioHorarios && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Horarios de Lavadoras
                </h2>
              </div>
              <button
                onClick={() => setMostrarCalendarioHorarios(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Estado de Lavadoras</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {lavadoras.map((lavadora) => (
                    <div
                      key={lavadora.id}
                      className={`p-4 rounded-lg border-2 ${
                        lavadora.estado === 'disponible'
                          ? 'bg-green-50 border-green-200'
                          : lavadora.estado === 'alquilada'
                          ? 'bg-blue-50 border-blue-200'
                          : lavadora.estado === 'mantenimiento'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold text-lg text-gray-900 mb-1">
                          {lavadora.codigoQR}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {lavadora.marca} {lavadora.modelo}
                        </div>
                        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          lavadora.estado === 'disponible'
                            ? 'bg-green-100 text-green-800'
                            : lavadora.estado === 'alquilada'
                            ? 'bg-blue-100 text-blue-800'
                            : lavadora.estado === 'mantenimiento'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {lavadora.estado === 'disponible' ? 'Disponible' :
                           lavadora.estado === 'alquilada' ? 'Alquilada' :
                           lavadora.estado === 'mantenimiento' ? 'Mantenimiento' : 'Retirada'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pedidos Activos</h3>
                <div className="space-y-3">
                  {pedidos
                    .filter(p => p.status === 'pendiente' || p.status === 'entregado')
                    .map((pedido) => (
                      <div key={pedido.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">
                              {pedido.cliente.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              Plan: {pedido.plan.name}
                            </div>
                            {pedido.lavadoraAsignada && (
                              <div className="text-sm text-blue-600">
                                Lavadora: {pedido.lavadoraAsignada.codigoQR}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              pedido.status === 'pendiente'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {pedido.status === 'pendiente' ? 'Pendiente' : 'Entregado'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(pedido.fechaEntrega, 'dd/MM/yyyy HH:mm')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setMostrarCalendarioHorarios(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pedidos;



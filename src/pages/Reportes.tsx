import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  CalendarIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { pedidoService, gastoService, planService, clienteService } from '../services/firebaseService';
import { modificacionesService } from '../services/modificacionesService';
import { Pedido, Gasto, Plan, Cliente } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

interface FiltrosReporte {
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  planId: string;
  clienteId: string;
  tipoReporte: 'diario' | 'semanal' | 'mensual' | 'personalizado';
}

const Reportes: React.FC = () => {
  const [filtros, setFiltros] = useState<FiltrosReporte>({
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia(),
    estado: 'todos',
    planId: 'todos',
    clienteId: 'todos',
    tipoReporte: 'diario'
  });

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [analisisPlanes, setAnalisisPlanes] = useState<any[]>([]);
  const [totalModificaciones, setTotalModificaciones] = useState({
    horasExtras: 0,
    cobrosAdicionales: 0,
    descuentos: 0,
    total: 0
  });

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    cargarReporte();
  }, [filtros]);

  const cargarDatosIniciales = async () => {
    try {
      const [planesData, clientesData] = await Promise.all([
        planService.getActivePlans(),
        clienteService.searchClientes('')
      ]);
      setPlanes(planesData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    }
  };

  const cargarReporte = async () => {
    setLoading(true);
    console.log('🔄 Iniciando carga de reporte...');
    try {
      // Cargar pedidos del rango de fechas
      const pedidosPromises = [];
      const fechaActual = new Date(filtros.fechaInicio);
      const fechaFin = new Date(filtros.fechaFin);
      
      console.log('📅 Rango de fechas:', fechaActual.toDateString(), 'a', fechaFin.toDateString());
      
      while (fechaActual <= fechaFin) {
        pedidosPromises.push(pedidoService.getPedidosDelDia(new Date(fechaActual)));
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      
      console.log('📋 Cargando pedidos de', pedidosPromises.length, 'días...');
      const pedidosArrays = await Promise.all(pedidosPromises);
      let todosLosPedidos = pedidosArrays.flat();
      console.log('📊 Total de pedidos encontrados:', todosLosPedidos.length);

      // Aplicar filtros
      if (filtros.estado !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.status === filtros.estado);
        console.log('🔍 Filtrado por estado:', filtros.estado, '- Pedidos restantes:', todosLosPedidos.length);
      }
      if (filtros.planId !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.planId === filtros.planId);
        console.log('🔍 Filtrado por plan:', filtros.planId, '- Pedidos restantes:', todosLosPedidos.length);
      }
      if (filtros.clienteId !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.clienteId === filtros.clienteId);
        console.log('🔍 Filtrado por cliente:', filtros.clienteId, '- Pedidos restantes:', todosLosPedidos.length);
      }

      setPedidos(todosLosPedidos);
      console.log('✅ Pedidos establecidos en estado');

      // Calcular análisis de planes y modificaciones
      console.log('🔄 Iniciando cálculo de análisis de planes...');
      await calcularAnalisisPlanes(todosLosPedidos);
      console.log('✅ Análisis de planes completado');

      // Cargar gastos del rango de fechas
      console.log('🔄 Cargando gastos...');
      const gastosPromises = [];
      const fechaActualGastos = new Date(filtros.fechaInicio);
      
      while (fechaActualGastos <= fechaFin) {
        gastosPromises.push(gastoService.getGastosDelDia(new Date(fechaActualGastos)));
        fechaActualGastos.setDate(fechaActualGastos.getDate() + 1);
      }
      
      const gastosArrays = await Promise.all(gastosPromises);
      const todosLosGastos = gastosArrays.flat();
      setGastos(todosLosGastos);
      console.log('✅ Gastos cargados:', todosLosGastos.length);

    } catch (error) {
      console.error('❌ Error al cargar reporte:', error);
    } finally {
      setLoading(false);
      console.log('✅ Carga de reporte completada');
    }
  };

  const calcularAnalisisPlanes = async (pedidosFiltrados: Pedido[]) => {
    try {
      console.log('🔄 Calculando análisis de planes para', pedidosFiltrados.length, 'pedidos');
      
      // Agrupar pedidos por plan
      const planesMap = new Map();
      
      for (const pedido of pedidosFiltrados) {
        const planId = pedido.plan.id;
        const planName = pedido.plan.name;
        const planPrice = pedido.plan.price;
        
        if (!planesMap.has(planId)) {
          planesMap.set(planId, {
            planId,
            planName,
            planPrice,
            cantidad: 0,
            valorTotal: 0
          });
        }
        
        const planData = planesMap.get(planId);
        planData.cantidad += 1;
        planData.valorTotal += planPrice;
      }
      
      // Convertir a array y ordenar por cantidad
      const analisisPlanesArray = Array.from(planesMap.values())
        .sort((a, b) => b.cantidad - a.cantidad);
      
      console.log('📊 Análisis de planes calculado:', analisisPlanesArray);
      setAnalisisPlanes(analisisPlanesArray);
      
      // Calcular totales de modificaciones de forma eficiente
      let totalHorasExtras = 0;
      let totalCobrosAdicionales = 0;
      let totalDescuentos = 0;
      
      console.log('🔄 Calculando modificaciones...');
      
      // Obtener todas las modificaciones en paralelo (con límite para evitar sobrecarga)
      const modificacionesPromises = pedidosFiltrados.slice(0, 50).map(async (pedido) => {
        try {
          return await modificacionesService.obtenerModificacionPorPedido(pedido.id);
        } catch (error) {
          return null;
        }
      });
      
      const modificaciones = await Promise.all(modificacionesPromises);
      console.log('📊 Modificaciones obtenidas:', modificaciones.filter((m: any) => m !== null).length);
      
      // Procesar modificaciones
      modificaciones.forEach((modificacion: any) => {
        if (modificacion) {
          // Horas extras (asumiendo $2,000 por hora)
          totalHorasExtras += (modificacion.horasExtras?.total || 0);
          
          // Cobros adicionales
          totalCobrosAdicionales += modificacion.cobrosAdicionales?.reduce((sum: any, cobro: any) => sum + cobro.monto, 0) || 0;
          
          // Descuentos
          totalDescuentos += modificacion.descuentos?.reduce((sum: any, descuento: any) => sum + descuento.monto, 0) || 0;
        }
      });
      
      console.log('💰 Totales calculados:', {
        horasExtras: totalHorasExtras,
        cobrosAdicionales: totalCobrosAdicionales,
        descuentos: totalDescuentos,
        total: totalHorasExtras + totalCobrosAdicionales - totalDescuentos
      });
      
      setTotalModificaciones({
        horasExtras: totalHorasExtras,
        cobrosAdicionales: totalCobrosAdicionales,
        descuentos: totalDescuentos,
        total: totalHorasExtras + totalCobrosAdicionales - totalDescuentos
      });
      
      console.log('✅ Análisis de planes completado');
      
    } catch (error) {
      console.error('❌ Error al calcular análisis de planes:', error);
      // Establecer valores por defecto en caso de error
      setAnalisisPlanes([]);
      setTotalModificaciones({
        horasExtras: 0,
        cobrosAdicionales: 0,
        descuentos: 0,
        total: 0
      });
    }
  };

  const calcularEstadisticas = () => {
    // Calcular ingresos reales (solo lo que se ha pagado)
    let ingresos = 0;
    let totalPendiente = 0;
    
    const ingresosPorMetodo = {
      efectivo: 0,
      nequi: 0,
      daviplata: 0
    };
    
    pedidos.forEach(pedido => {
      const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
      const saldoPendiente = pedido.total - totalPagado;
      
      ingresos += totalPagado;
      totalPendiente += saldoPendiente;
      
      // Calcular ingresos por método de pago basado en pagos reales
      if (pedido.pagosRealizados) {
        pedido.pagosRealizados.forEach(pago => {
          if (pago.medioPago === 'efectivo') {
            ingresosPorMetodo.efectivo += pago.monto;
          } else if (pago.medioPago === 'nequi') {
            ingresosPorMetodo.nequi += pago.monto;
          } else if (pago.medioPago === 'daviplata') {
            ingresosPorMetodo.daviplata += pago.monto;
          }
        });
      }
    });
    
    const gastosTotal = gastos.reduce((sum, g) => sum + g.amount, 0);
    const neto = ingresos - gastosTotal;
    
    const pedidosPorEstado = {
      pendiente: pedidos.filter(p => p.status === 'pendiente').length,
      entregado: pedidos.filter(p => p.status === 'entregado').length,
      recogido: pedidos.filter(p => p.status === 'recogido').length,
      cancelado: pedidos.filter(p => p.status === 'cancelado').length
    };

    const planesPopulares = pedidos.reduce((acc, pedido) => {
      const planName = pedido.plan.name;
      acc[planName] = (acc[planName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const clientesFrecuentes = pedidos.reduce((acc, pedido) => {
      const clienteName = pedido.cliente.name;
      acc[clienteName] = (acc[clienteName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      ingresos,
      totalPendiente,
      gastos: gastosTotal,
      neto,
      totalPedidos: pedidos.length,
      pedidosPorEstado,
      ingresosPorMetodo,
      planesPopulares,
      clientesFrecuentes,
      promedioPorPedido: pedidos.length > 0 ? ingresos / pedidos.length : 0
    };
  };

  const exportarReporte = () => {
    const stats = calcularEstadisticas();
    const fechaInicioStr = formatDate(filtros.fechaInicio, 'dd/MM/yyyy');
    const fechaFinStr = formatDate(filtros.fechaFin, 'dd/MM/yyyy');
    
    console.log('📊 Exportando reporte a Excel...');
    console.log('📊 Estadísticas:', stats);
    
    // Crear un nuevo workbook
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Resumen General
    const resumenData = [
      ['REPORTE DE PEDIDOS'],
      [''],
      ['Período', `${fechaInicioStr} - ${fechaFinStr}`],
      ['Fecha de generación', formatDate(new Date(), 'dd/MM/yyyy HH:mm')],
      [''],
      ['RESUMEN FINANCIERO'],
      ['Ingresos Cobrados', stats.ingresos],
      ['Total Pendiente', stats.totalPendiente],
      ['Gastos', stats.gastos],
      ['Neto', stats.neto],
      ['Promedio por pedido', stats.promedioPorPedido],
      [''],
      ['INGRESOS POR MÉTODO DE PAGO'],
      ['Efectivo', stats.ingresosPorMetodo.efectivo],
      ['Nequi', stats.ingresosPorMetodo.nequi],
      ['Daviplata', stats.ingresosPorMetodo.daviplata],
      [''],
      ['RESUMEN OPERACIONAL'],
      ['Total pedidos', stats.totalPedidos],
      ['Pendientes', stats.pedidosPorEstado.pendiente],
      ['Entregados', stats.pedidosPorEstado.entregado],
      ['Recogidos', stats.pedidosPorEstado.recogido],
      ['Cancelados', stats.pedidosPorEstado.cancelado]
    ];
    
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    
    // Configurar ancho de columnas
    wsResumen['!cols'] = [
      { wch: 25 }, // Columna A
      { wch: 20 }  // Columna B
    ];
    
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen General');
    
    // Hoja 2: Análisis de Planes
    const planesData = [
      ['PLAN', 'CANTIDAD', 'VALOR TOTAL', 'PRECIO UNITARIO'],
      ...analisisPlanes.map(plan => [
        plan.planName,
        plan.cantidad,
        plan.valorTotal,
        plan.planPrice
      ])
    ];
    
    const wsPlanes = XLSX.utils.aoa_to_sheet(planesData);
    wsPlanes['!cols'] = [
      { wch: 20 }, // Plan
      { wch: 12 }, // Cantidad
      { wch: 15 }, // Valor Total
      { wch: 15 }  // Precio Unitario
    ];
    
    XLSX.utils.book_append_sheet(wb, wsPlanes, 'Análisis de Planes');
    
    // Hoja 3: Clientes con Saldo Pendiente
    const clientesConSaldo = Object.entries(stats.clientesFrecuentes)
      .map(([clienteName, cantidad]) => {
        const pedidosCliente = pedidos.filter(p => p.cliente.name === clienteName);
        const serviciosTotales = pedidosCliente.reduce((sum, p) => sum + (p.total || 0), 0);
        const abonosRealizados = pedidosCliente.reduce((sum, p) => {
          return sum + (p.pagosRealizados?.reduce((sumPago, pago) => sumPago + pago.monto, 0) || 0);
        }, 0);
        const saldoPendiente = serviciosTotales - abonosRealizados;
        
        return {
          cliente: clienteName,
          servicios: cantidad,
          serviciosTotales,
          abonosRealizados,
          saldoPendiente,
          telefono: pedidosCliente[0]?.cliente.phone || ''
        };
      })
      .filter(cliente => cliente.saldoPendiente > 0)
      .sort((a, b) => b.saldoPendiente - a.saldoPendiente);
    
    const clientesData = [
      ['CLIENTE', 'TELÉFONO', 'SERVICIOS', 'TOTAL SERVICIOS', 'ABONOS REALIZADOS', 'SALDO PENDIENTE'],
      ...clientesConSaldo.map(cliente => [
        cliente.cliente,
        cliente.telefono,
        cliente.servicios,
        cliente.serviciosTotales,
        cliente.abonosRealizados,
        cliente.saldoPendiente
      ])
    ];
    
    const wsClientes = XLSX.utils.aoa_to_sheet(clientesData);
    wsClientes['!cols'] = [
      { wch: 25 }, // Cliente
      { wch: 15 }, // Teléfono
      { wch: 12 }, // Servicios
      { wch: 15 }, // Total Servicios
      { wch: 15 }, // Abonos
      { wch: 15 }  // Saldo Pendiente
    ];
    
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes con Saldo');
    
    // Hoja 4: Detalle de Pedidos
    const pedidosData = [
      ['FECHA', 'CLIENTE', 'PLAN', 'ESTADO', 'TOTAL', 'PAGADO', 'PENDIENTE', 'MÉTODO PAGO'],
      ...pedidos.map(pedido => {
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        const saldoPendiente = pedido.total - totalPagado;
        const metodoPago = pedido.pagosRealizados?.map(p => p.medioPago).join(', ') || 'Sin pago';
        
        return [
          formatDate(pedido.fechaAsignacion, 'dd/MM/yyyy'),
          pedido.cliente.name,
          pedido.plan.name,
          pedido.status,
          pedido.total,
          totalPagado,
          saldoPendiente,
          metodoPago
        ];
      })
    ];
    
    const wsPedidos = XLSX.utils.aoa_to_sheet(pedidosData);
    wsPedidos['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 25 }, // Cliente
      { wch: 15 }, // Plan
      { wch: 12 }, // Estado
      { wch: 12 }, // Total
      { wch: 12 }, // Pagado
      { wch: 12 }, // Pendiente
      { wch: 15 }  // Método Pago
    ];
    
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Detalle de Pedidos');
    
    // Hoja 5: Modificaciones
    const modificacionesData = [
      ['CONCEPTO', 'VALOR'],
      ['Horas Extras', totalModificaciones.horasExtras],
      ['Cobros Adicionales', totalModificaciones.cobrosAdicionales],
      ['Descuentos', totalModificaciones.descuentos],
      ['TOTAL MODIFICACIONES', totalModificaciones.total]
    ];
    
    const wsModificaciones = XLSX.utils.aoa_to_sheet(modificacionesData);
    wsModificaciones['!cols'] = [
      { wch: 20 }, // Concepto
      { wch: 15 }  // Valor
    ];
    
    XLSX.utils.book_append_sheet(wb, wsModificaciones, 'Modificaciones');
    
    // Generar y descargar el archivo
    const nombreArchivo = `reporte_${fechaInicioStr.replace(/\//g, '-')}_a_${fechaFinStr.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    console.log('✅ Reporte exportado exitosamente:', nombreArchivo);
  };

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer' | 'semana' | 'mes') => {
    const hoy = getCurrentDateColombia();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    switch (tipo) {
      case 'hoy':
        setFiltros(prev => ({ ...prev, fechaInicio: hoy, fechaFin: hoy, tipoReporte: 'diario' }));
        break;
      case 'ayer':
        setFiltros(prev => ({ ...prev, fechaInicio: ayer, fechaFin: ayer, tipoReporte: 'diario' }));
        break;
      case 'semana':
        setFiltros(prev => ({ ...prev, fechaInicio: inicioSemana, fechaFin: hoy, tipoReporte: 'semanal' }));
        break;
      case 'mes':
        setFiltros(prev => ({ ...prev, fechaInicio: inicioMes, fechaFin: hoy, tipoReporte: 'mensual' }));
        break;
    }
  };

  const stats = calcularEstadisticas();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">
            Reportes Avanzados
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Análisis detallado del negocio con filtros personalizables
          </p>
        </div>
        <button
          onClick={exportarReporte}
          className="btn-primary"
          disabled={pedidos.length === 0}
        >
          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
          Exportar Excel
        </button>
      </div>

      {/* Filtros rápidos */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros Rápidos</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => aplicarFiltroRapido('hoy')}
            className="btn-secondary text-sm"
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarFiltroRapido('ayer')}
            className="btn-secondary text-sm"
          >
            Ayer
          </button>
          <button
            onClick={() => aplicarFiltroRapido('semana')}
            className="btn-secondary text-sm"
          >
            Esta Semana
          </button>
          <button
            onClick={() => aplicarFiltroRapido('mes')}
            className="btn-secondary text-sm"
          >
            Este Mes
          </button>
        </div>
      </div>

      {/* Filtros avanzados */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros Avanzados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              className="input-field"
              value={filtros.fechaInicio.toISOString().split('T')[0]}
              onChange={(e) => setFiltros(prev => ({ 
                ...prev, 
                fechaInicio: new Date(e.target.value),
                tipoReporte: 'personalizado'
              }))}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              className="input-field"
              value={filtros.fechaFin.toISOString().split('T')[0]}
              onChange={(e) => setFiltros(prev => ({ 
                ...prev, 
                fechaFin: new Date(e.target.value),
                tipoReporte: 'personalizado'
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              className="input-field"
              value={filtros.estado}
              onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="entregado">Entregado</option>
              <option value="recogido">Recogido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan
            </label>
            <select
              className="input-field"
              value={filtros.planId}
              onChange={(e) => setFiltros(prev => ({ ...prev, planId: e.target.value }))}
            >
              <option value="todos">Todos los planes</option>
              {planes.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              className="input-field"
              value={filtros.clienteId}
              onChange={(e) => setFiltros(prev => ({ ...prev, clienteId: e.target.value }))}
            >
              <option value="todos">Todos los clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>{cliente.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFiltros({
                fechaInicio: getCurrentDateColombia(),
                fechaFin: getCurrentDateColombia(),
                estado: 'todos',
                planId: 'todos',
                clienteId: 'todos',
                tipoReporte: 'diario'
              })}
              className="btn-secondary w-full"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de resultados */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-colored border-l-4 border-success-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-success-100 to-success-200 border border-success-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ingresos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.ingresos)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-warning-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-warning-100 to-warning-200 border border-warning-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendiente</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalPendiente)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-danger-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-danger-100 to-danger-200 border border-danger-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-danger-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Gastos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.gastos)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-primary-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 border border-primary-300 shadow-md">
              <ChartBarIcon className="h-7 w-7 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Neto</p>
              <p className={`text-2xl font-bold ${stats.neto >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {formatCurrency(stats.neto)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-info-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-info-100 to-info-200 border border-info-300 shadow-md">
              <ClipboardDocumentListIcon className="h-7 w-7 text-info-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalPedidos}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ingresos por método de pago */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ingresos por Método de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Efectivo</p>
                <p className="text-xs text-green-600">Dinero en efectivo</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-900">
                {formatCurrency(stats.ingresosPorMetodo.efectivo)}
              </p>
              <p className="text-xs text-green-600">
                {stats.ingresos > 0 ? 
                  `${((stats.ingresosPorMetodo.efectivo / stats.ingresos) * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Nequi</p>
                <p className="text-xs text-blue-600">Billetera digital Nequi</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-900">
                {formatCurrency(stats.ingresosPorMetodo.nequi)}
              </p>
              <p className="text-xs text-blue-600">
                {stats.ingresos > 0 ? 
                  `${((stats.ingresosPorMetodo.nequi / stats.ingresos) * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-800">Daviplata</p>
                <p className="text-xs text-purple-600">Billetera digital Daviplata</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-purple-900">
                {formatCurrency(stats.ingresosPorMetodo.daviplata)}
              </p>
              <p className="text-xs text-purple-600">
                {stats.ingresos > 0 ? 
                  `${((stats.ingresosPorMetodo.daviplata / stats.ingresos) * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Análisis detallado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla de Clientes con Saldo Pendiente */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Clientes con Saldo Pendiente</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicios Totales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abonos Realizados
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(stats.clientesFrecuentes)
                  .map(([clienteName, cantidad]) => {
                    // Buscar todos los pedidos de este cliente
                    const pedidosCliente = pedidos.filter(p => p.cliente.name === clienteName);
                    
                    // Calcular totales
                    const serviciosTotales = pedidosCliente.reduce((sum, p) => sum + (p.total || 0), 0);
                    const abonosRealizados = pedidosCliente.reduce((sum, p) => {
                      return sum + (p.pagosRealizados?.reduce((sumPago, pago) => sumPago + pago.monto, 0) || 0);
                    }, 0);
                    const saldoPendiente = serviciosTotales - abonosRealizados;
                    
                    // Solo mostrar si tiene saldo pendiente
                    if (saldoPendiente <= 0) return null;
                    
                    // Obtener teléfono del cliente (usar el primer pedido)
                    const telefonoCliente = pedidosCliente[0]?.cliente.phone || '';
                    
                    // Generar mensaje de WhatsApp
                    const ahora = new Date();
                    const hora = ahora.getHours();
                    let saludo = '';
                    if (hora < 12) {
                      saludo = 'Buenos días';
                    } else if (hora < 18) {
                      saludo = 'Buenas tardes';
                    } else {
                      saludo = 'Buenas noches';
                    }
                    
                    const mensaje = `${saludo}, Lavadoras GLOBAL, le recuerda que tiene un saldo pendiente de $${saldoPendiente.toLocaleString()}, muchas gracias`;
                    const whatsappUrl = `https://wa.me/${telefonoCliente.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(mensaje)}`;
                    
                    return (
                      <tr key={clienteName}>
                        <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary-600">
                                  {clienteName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{clienteName}</div>
                              <div className="text-sm text-gray-500">{telefonoCliente}</div>
                  </div>
                </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${serviciosTotales.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${abonosRealizados.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          ${saldoPendiente.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                          >
                            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                            </svg>
                            WhatsApp
                          </a>
                        </td>
                      </tr>
                    );
                  })
                  .filter(Boolean)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Análisis de Planes y Modificaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Análisis de Planes */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Análisis de Planes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analisisPlanes.map((plan) => (
                  <tr key={plan.planId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {plan.planName.charAt(plan.planName.length - 1)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{plan.planName}</div>
                          <div className="text-sm text-gray-500">${plan.planPrice.toLocaleString()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {plan.cantidad} servicios
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${plan.valorTotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totales de Modificaciones */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Totales de Modificaciones</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Horas Extras</span>
              </div>
              <span className="text-lg font-semibold text-green-600">
                ${totalModificaciones.horasExtras.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Cobros Adicionales</span>
              </div>
              <span className="text-lg font-semibold text-blue-600">
                ${totalModificaciones.cobrosAdicionales.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Descuentos</span>
              </div>
              <span className="text-lg font-semibold text-red-600">
                -${totalModificaciones.descuentos.toLocaleString()}
              </span>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-900">Total Modificaciones</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  ${totalModificaciones.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pedidos.length === 0 && !loading && (
        <div className="card text-center py-12">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay datos para los filtros seleccionados</p>
        </div>
      )}
    </div>
  );
};

export default Reportes;
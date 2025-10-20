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
import { Pedido, Gasto, Plan, Cliente } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';

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
    try {
      // Cargar pedidos del rango de fechas
      const pedidosPromises = [];
      const fechaActual = new Date(filtros.fechaInicio);
      const fechaFin = new Date(filtros.fechaFin);
      
      while (fechaActual <= fechaFin) {
        pedidosPromises.push(pedidoService.getPedidosDelDia(new Date(fechaActual)));
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      
      const pedidosArrays = await Promise.all(pedidosPromises);
      let todosLosPedidos = pedidosArrays.flat();

      // Aplicar filtros
      if (filtros.estado !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.status === filtros.estado);
      }
      if (filtros.planId !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.planId === filtros.planId);
      }
      if (filtros.clienteId !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.clienteId === filtros.clienteId);
      }

      setPedidos(todosLosPedidos);

      // Cargar gastos del rango de fechas
      const gastosPromises = [];
      const fechaActualGastos = new Date(filtros.fechaInicio);
      
      while (fechaActualGastos <= fechaFin) {
        gastosPromises.push(gastoService.getGastosDelDia(new Date(fechaActualGastos)));
        fechaActualGastos.setDate(fechaActualGastos.getDate() + 1);
      }
      
      const gastosArrays = await Promise.all(gastosPromises);
      const todosLosGastos = gastosArrays.flat();
      setGastos(todosLosGastos);

    } catch (error) {
      console.error('Error al cargar reporte:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = () => {
    const ingresos = pedidos.reduce((sum, p) => sum + p.total, 0);
    const gastosTotal = gastos.reduce((sum, g) => sum + g.amount, 0);
    const neto = ingresos - gastosTotal;
    
    // Calcular ingresos por método de pago
    const ingresosPorMetodo = {
      efectivo: 0,
      nequi: 0,
      daviplata: 0
    };
    
    pedidos.forEach(pedido => {
      const total = pedido.total || 0;
      if (pedido.paymentMethod.type === 'efectivo') {
        ingresosPorMetodo.efectivo += total;
      } else if (pedido.paymentMethod.type === 'nequi') {
        ingresosPorMetodo.nequi += total;
      } else if (pedido.paymentMethod.type === 'daviplata') {
        ingresosPorMetodo.daviplata += total;
      }
    });
    
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
    
    const csv = [
      ['REPORTE DE PEDIDOS'],
      [''],
      ['Período', `${fechaInicioStr} - ${fechaFinStr}`],
      [''],
      ['RESUMEN FINANCIERO'],
      ['Ingresos', formatCurrency(stats.ingresos)],
      ['Gastos', formatCurrency(stats.gastos)],
      ['Neto', formatCurrency(stats.neto)],
      ['Promedio por pedido', formatCurrency(stats.promedioPorPedido)],
      [''],
      ['INGRESOS POR MÉTODO DE PAGO'],
      ['Efectivo', formatCurrency(stats.ingresosPorMetodo.efectivo)],
      ['Nequi', formatCurrency(stats.ingresosPorMetodo.nequi)],
      ['Daviplata', formatCurrency(stats.ingresosPorMetodo.daviplata)],
      [''],
      ['RESUMEN OPERACIONAL'],
      ['Total pedidos', stats.totalPedidos.toString()],
      ['Pendientes', stats.pedidosPorEstado.pendiente.toString()],
      ['Entregados', stats.pedidosPorEstado.entregado.toString()],
      ['Recogidos', stats.pedidosPorEstado.recogido.toString()],
      ['Cancelados', stats.pedidosPorEstado.cancelado.toString()],
      [''],
      ['PLANES MÁS POPULARES'],
      ...Object.entries(stats.planesPopulares)
        .sort(([,a], [,b]) => b - a)
        .map(([plan, cantidad]) => [plan, cantidad.toString()]),
      [''],
      ['CLIENTES MÁS FRECUENTES'],
      ...Object.entries(stats.clientesFrecuentes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([cliente, cantidad]) => [cliente, cantidad.toString()])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${fechaInicioStr}-${fechaFinStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
          Exportar CSV
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        {/* Estados de pedidos */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Estados de Pedidos</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 mr-2" />
                <span className="font-medium">Pendientes</span>
              </div>
              <span className="text-lg font-bold text-warning-600">
                {stats.pedidosPorEstado.pendiente}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-info-50 rounded-lg">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-info-600 mr-2" />
                <span className="font-medium">Entregados</span>
              </div>
              <span className="text-lg font-bold text-info-600">
                {stats.pedidosPorEstado.entregado}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-success-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-success-600 mr-2" />
                <span className="font-medium">Recogidos</span>
              </div>
              <span className="text-lg font-bold text-success-600">
                {stats.pedidosPorEstado.recogido}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-danger-50 rounded-lg">
              <div className="flex items-center">
                <XCircleIcon className="h-5 w-5 text-danger-600 mr-2" />
                <span className="font-medium">Cancelados</span>
              </div>
              <span className="text-lg font-bold text-danger-600">
                {stats.pedidosPorEstado.cancelado}
              </span>
            </div>
          </div>
        </div>

        {/* Planes más populares */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Planes Más Populares</h3>
          <div className="space-y-3">
            {Object.entries(stats.planesPopulares)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([plan, cantidad]) => (
                <div key={plan} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">{plan}</span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-primary-600 h-2 rounded-full" 
                        style={{ 
                          width: `${(cantidad / Math.max(...Object.values(stats.planesPopulares))) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-primary-600">{cantidad}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Clientes más frecuentes */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Clientes Más Frecuentes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(stats.clientesFrecuentes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 9)
            .map(([cliente, cantidad]) => (
              <div key={cliente} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="font-medium text-gray-900 truncate">{cliente}</span>
                </div>
                <span className="text-sm font-bold text-primary-600">{cantidad}</span>
              </div>
            ))}
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
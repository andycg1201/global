import React, { useState, useEffect } from 'react';
import { 
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  TruckIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { pedidoService, planService } from '../services/firebaseService';
import { Pedido, Plan } from '../types';
import { formatDate, getCurrentDateColombia } from '../utils/dateUtils';

interface FiltrosRendimiento {
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  planId: string;
  mostrarGraficos: boolean;
}

interface MetricasRendimiento {
  totalPedidos: number;
  pedidosEntregados: number;
  pedidosRecogidos: number;
  eficienciaGeneral: number;
}

const RendimientoTecnico: React.FC = () => {
  const [filtros, setFiltros] = useState<FiltrosRendimiento>({
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia(),
    estado: 'todos',
    planId: 'todos',
    mostrarGraficos: true
  });

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [metricas, setMetricas] = useState<MetricasRendimiento>({
    totalPedidos: 0,
    pedidosEntregados: 0,
    pedidosRecogidos: 0,
    eficienciaGeneral: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    cargarRendimiento();
  }, [filtros]);

  const cargarDatosIniciales = async () => {
    try {
      const [planesData] = await Promise.all([
        planService.getActivePlans()
      ]);
      setPlanes(planesData);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    }
  };

  const cargarRendimiento = async () => {
    setLoading(true);
    try {
      // Obtener pedidos del rango de fechas
      const pedidosData: Pedido[] = [];
      const fechaActual = new Date(filtros.fechaInicio);
      const fechaFin = new Date(filtros.fechaFin);
      
      while (fechaActual <= fechaFin) {
        const pedidosDelDia = await pedidoService.getPedidosDelDia(fechaActual);
        pedidosData.push(...pedidosDelDia);
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      
      // Filtrar pedidos según criterios
      let pedidosFiltrados = pedidosData.filter((pedido: Pedido) => {
        const fechaPedido = pedido.createdAt;
        const fechaInicio = new Date(filtros.fechaInicio);
        const fechaFin = new Date(filtros.fechaFin);
        fechaFin.setHours(23, 59, 59, 999);

        return fechaPedido >= fechaInicio && fechaPedido <= fechaFin &&
               (filtros.estado === 'todos' || pedido.status === filtros.estado) &&
               (filtros.planId === 'todos' || pedido.plan.id === filtros.planId);
      });

      setPedidos(pedidosFiltrados);
      calcularMetricas(pedidosFiltrados);
    } catch (error) {
      console.error('Error al cargar rendimiento:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = (pedidosData: Pedido[]) => {
    const totalPedidos = pedidosData.length;
    const pedidosEntregados = pedidosData.filter(p => p.status === 'entregado' || p.status === 'recogido').length;
    const pedidosRecogidos = pedidosData.filter(p => p.status === 'recogido').length;

    // Calcular eficiencia general (entregas completadas vs total)
    const eficienciaGeneral = totalPedidos > 0 ? Math.round((pedidosRecogidos / totalPedidos) * 100) : 0;

    setMetricas({
      totalPedidos,
      pedidosEntregados,
      pedidosRecogidos,
      eficienciaGeneral
    });
  };


  const formatearTiempo = (minutos: number): string => {
    if (minutos < 60) {
      return `${Math.round(minutos)} min`;
    } else {
      const horas = Math.floor(minutos / 60);
      const mins = Math.round(minutos % 60);
      return `${horas}h ${mins}m`;
    }
  };

  const exportarCSV = () => {
    const headers = [
      'Fecha Creación',
      'Cliente',
      'Plan',
      'Estado',
      'Fecha Entrega',
      'Fecha Recogida',
      'Dirección',
      'Total'
    ];

    const rows = pedidos.map(pedido => [
      formatDate(pedido.createdAt),
      pedido.cliente.name,
      pedido.plan.name,
      pedido.status,
      pedido.fechaEntrega ? formatDate(pedido.fechaEntrega, 'dd/MM HH:mm') : '-',
      pedido.fechaRecogida ? formatDate(pedido.fechaRecogida, 'dd/MM HH:mm') : '-',
      pedido.cliente.address,
      pedido.total
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rendimiento_tecnico_${formatDate(getCurrentDateColombia())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-blue-800 bg-clip-text text-transparent">
            Rendimiento del Técnico
          </h1>
          <p className="text-gray-600 mt-1">
            Análisis de tiempos de entrega y eficiencia del servicio
          </p>
        </div>
        <button
          onClick={exportarCSV}
          className="btn btn-primary flex items-center space-x-2"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <FunnelIcon className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filtros.fechaInicio.toISOString().split('T')[0]}
              onChange={(e) => setFiltros(prev => ({ ...prev, fechaInicio: new Date(e.target.value) }))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filtros.fechaFin.toISOString().split('T')[0]}
              onChange={(e) => setFiltros(prev => ({ ...prev, fechaFin: new Date(e.target.value) }))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
              className="input"
            >
              <option value="todos">Todos</option>
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
              value={filtros.planId}
              onChange={(e) => setFiltros(prev => ({ ...prev, planId: e.target.value }))}
              className="input"
            >
              <option value="todos">Todos</option>
              {planes.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filtros.mostrarGraficos}
                onChange={(e) => setFiltros(prev => ({ ...prev, mostrarGraficos: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Mostrar gráficos</span>
            </label>
          </div>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-colored border-l-4 border-primary-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 text-white">
              <TruckIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pedidos</p>
              <p className="text-3xl font-bold text-gray-900">{metricas.totalPedidos}</p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completados</p>
              <p className="text-3xl font-bold text-gray-900">{metricas.pedidosRecogidos}</p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <ChartBarIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Eficiencia</p>
              <p className="text-3xl font-bold text-gray-900">{metricas.eficienciaGeneral}%</p>
            </div>
          </div>
        </div>
      </div>


      {/* Tabla de Pedidos */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Detalle de Pedidos</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Entrega
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Recogida
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {pedido.cliente.name}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        {pedido.cliente.address}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {pedido.plan.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      pedido.status === 'pendiente' ? 'badge-warning' :
                      pedido.status === 'entregado' ? 'badge-info' :
                      pedido.status === 'recogido' ? 'badge-success' :
                      'badge-danger'
                    }`}>
                      {pedido.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {pedido.fechaEntrega ? formatDate(pedido.fechaEntrega, 'dd/MM HH:mm') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {pedido.fechaRecogida ? formatDate(pedido.fechaRecogida, 'dd/MM HH:mm') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${pedido.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico opcional */}
      {filtros.mostrarGraficos && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Tendencia de Rendimiento</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Gráfico de tendencias (implementar si es necesario)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RendimientoTecnico;

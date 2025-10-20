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
  entregasATiempo: number;
  entregasRetrasadas: number;
  tiempoPromedioEntrega: number;
  tiempoMaximoEntrega: number;
  tiempoMinimoEntrega: number;
  tasaEficiencia: number;
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
    entregasATiempo: 0,
    entregasRetrasadas: 0,
    tiempoPromedioEntrega: 0,
    tiempoMaximoEntrega: 0,
    tiempoMinimoEntrega: 0,
    tasaEficiencia: 0
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
    // Solo considerar pedidos que tienen entrega
    const pedidosConEntrega = pedidosData.filter(p => p.fechaEntrega);
    
    if (pedidosConEntrega.length === 0) {
      setMetricas({
        totalPedidos: pedidosData.length,
        entregasATiempo: 0,
        entregasRetrasadas: 0,
        tiempoPromedioEntrega: 0,
        tiempoMaximoEntrega: 0,
        tiempoMinimoEntrega: 0,
        tasaEficiencia: 0
      });
      return;
    }

    // Calcular tiempos de entrega (desde creación hasta entrega)
    const tiemposEntrega = pedidosConEntrega.map(pedido => {
      const tiempoCreacion = pedido.createdAt;
      const tiempoEntrega = pedido.fechaEntrega!;
      const diferenciaMs = tiempoEntrega.getTime() - tiempoCreacion.getTime();
      return diferenciaMs / (1000 * 60); // Convertir a minutos
    });

    // Definir tiempo esperado de entrega (ejemplo: 2 horas = 120 minutos)
    const tiempoEsperadoEntrega = 120; // 2 horas en minutos

    const entregasATiempo = tiemposEntrega.filter(tiempo => tiempo <= tiempoEsperadoEntrega).length;
    const entregasRetrasadas = tiemposEntrega.filter(tiempo => tiempo > tiempoEsperadoEntrega).length;

    const tiempoPromedio = tiemposEntrega.reduce((sum, tiempo) => sum + tiempo, 0) / tiemposEntrega.length;
    const tiempoMaximo = Math.max(...tiemposEntrega);
    const tiempoMinimo = Math.min(...tiemposEntrega);
    const tasaEficiencia = (entregasATiempo / pedidosConEntrega.length) * 100;

    setMetricas({
      totalPedidos: pedidosData.length,
      entregasATiempo,
      entregasRetrasadas,
      tiempoPromedioEntrega: Math.round(tiempoPromedio),
      tiempoMaximoEntrega: Math.round(tiempoMaximo),
      tiempoMinimoEntrega: Math.round(tiempoMinimo),
      tasaEficiencia: Math.round(tasaEficiencia)
    });
  };

  const calcularTiempoEntrega = (pedido: Pedido): number => {
    if (!pedido.fechaEntrega) return 0;
    
    const tiempoCreacion = pedido.createdAt;
    const tiempoEntrega = pedido.fechaEntrega;
    const diferenciaMs = tiempoEntrega.getTime() - tiempoCreacion.getTime();
    return diferenciaMs / (1000 * 60); // Convertir a minutos
  };

  const esEntregaRetrasada = (pedido: Pedido): boolean => {
    const tiempoEntrega = calcularTiempoEntrega(pedido);
    return tiempoEntrega > 120; // 2 horas = 120 minutos
  };

  const calcularTiempoRecogida = (pedido: Pedido): string => {
    if (!pedido.fechaRecogida || !pedido.fechaEntrega) return '-';

    const tiempoEntrega = pedido.fechaEntrega;
    const tiempoRecogida = pedido.fechaRecogida;
    
    // Lógica según el plan
    if (pedido.plan.id === 'plan1') {
      // Plan 1: recogida mismo día
      const diferenciaMs = tiempoRecogida.getTime() - tiempoEntrega.getTime();
      const diferenciaMinutos = diferenciaMs / (1000 * 60);
      return `${Math.round(diferenciaMinutos)} min`;
    } else {
      // Planes 2+: recogida día siguiente
      const diaEntrega = tiempoEntrega.getDay(); // 0 = domingo, 6 = sábado
      let fechaRecogidaEsperada = new Date(tiempoEntrega);
      
      if (diaEntrega === 6) { // Sábado
        // Recoger el lunes siguiente a las 7:00 AM
        fechaRecogidaEsperada.setDate(tiempoEntrega.getDate() + 2);
        fechaRecogidaEsperada.setHours(7, 0, 0, 0);
      } else {
        // Recoger el día siguiente a las 7:00 AM
        fechaRecogidaEsperada.setDate(tiempoEntrega.getDate() + 1);
        fechaRecogidaEsperada.setHours(7, 0, 0, 0);
      }
      
      const diferenciaMs = tiempoRecogida.getTime() - fechaRecogidaEsperada.getTime();
      const diferenciaMinutos = diferenciaMs / (1000 * 60);
      
      if (diferenciaMinutos <= 0) {
        return 'A tiempo';
      } else {
        return `+${Math.round(diferenciaMinutos)} min`;
      }
    }
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
      'Tiempo Entrega (min)',
      'Entrega Retrasada',
      'Tiempo Recogida',
      'Dirección',
      'Total'
    ];

    const rows = pedidos.map(pedido => [
      formatDate(pedido.createdAt),
      pedido.cliente.name,
      pedido.plan.name,
      pedido.status,
      calcularTiempoEntrega(pedido),
      esEntregaRetrasada(pedido) ? 'Sí' : 'No',
      calcularTiempoRecogida(pedido),
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-colored border-l-4 border-primary-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 text-white">
              <TruckIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.totalPedidos}</p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Entregas a Tiempo</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.entregasATiempo}</p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-red-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white">
              <ExclamationTriangleIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Entregas Retrasadas</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.entregasRetrasadas}</p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <ChartBarIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tasa de Eficiencia</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.tasaEficiencia}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detalles de Tiempos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <ClockIcon className="h-5 w-5 text-primary-600 mr-2" />
            Tiempo Promedio de Entrega
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-primary-600">
              {formatearTiempo(metricas.tiempoPromedioEntrega)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Tiempo esperado: 2 horas
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <ClockIcon className="h-5 w-5 text-yellow-600 mr-2" />
            Tiempo Máximo de Entrega
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">
              {formatearTiempo(metricas.tiempoMaximoEntrega)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Entrega más lenta
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <ClockIcon className="h-5 w-5 text-green-600 mr-2" />
            Tiempo Mínimo de Entrega
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">
              {formatearTiempo(metricas.tiempoMinimoEntrega)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Entrega más rápida
            </p>
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
                  Fecha Creación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiempo Entrega
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiempo Recogida
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(pedido.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        esEntregaRetrasada(pedido) ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatearTiempo(calcularTiempoEntrega(pedido))}
                      </span>
                      {esEntregaRetrasada(pedido) && (
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-600 ml-1" />
                      )}
                    </div>
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
                    {calcularTiempoRecogida(pedido)}
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

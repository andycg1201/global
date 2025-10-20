import React, { useState, useEffect } from 'react';
import { 
  ClipboardDocumentListIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, getCurrentDateColombia } from '../utils/dateUtils';
import { pedidoService, reporteService, gastoService, clienteService } from '../services/firebaseService';
import { Pedido, ReporteDiario } from '../types';

const Dashboard: React.FC = () => {
  const [reporteDiario, setReporteDiario] = useState<ReporteDiario | null>(null);
  const [pedidosPendientes, setPedidosPendientes] = useState<Pedido[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const hoy = getCurrentDateColombia();
        
        // Obtener todos los pedidos históricos
        const todosLosPedidos = await pedidoService.getAllPedidos();
        
        // Obtener todos los gastos históricos
        const fechaInicio = new Date(2024, 0, 1); // Desde enero 2024
        const fechaFin = new Date();
        const todosLosGastos = await gastoService.getGastosDelRango(fechaInicio, fechaFin);
        const totalGastos = todosLosGastos.reduce((sum, gasto) => sum + gasto.amount, 0);
        
        // Obtener total de clientes
        const todosLosClientes = await clienteService.getAllClientes();
        const totalClientesCount = todosLosClientes.length;
        
        // Calcular estadísticas históricas
        const ingresos = todosLosPedidos
          .filter(p => p.status === 'recogido')
          .reduce((sum, p) => sum + (p.total || 0), 0);
        
        const pedidosCompletados = todosLosPedidos.filter(p => p.status === 'recogido').length;
        
        // Calcular ingresos por método de pago
        const ingresosPorMetodo = {
          efectivo: 0,
          nequi: 0,
          daviplata: 0
        };
        
        todosLosPedidos
          .filter(p => p.status === 'recogido')
          .forEach(pedido => {
            const total = pedido.total || 0;
            if (pedido.paymentMethod.type === 'efectivo') {
              ingresosPorMetodo.efectivo += total;
            } else if (pedido.paymentMethod.type === 'nequi') {
              ingresosPorMetodo.nequi += total;
            } else if (pedido.paymentMethod.type === 'daviplata') {
              ingresosPorMetodo.daviplata += total;
            }
          });
        
        // Crear reporte personalizado con datos históricos
        const reportePersonalizado: ReporteDiario = {
          fecha: hoy,
          pedidos: todosLosPedidos.length,
          pedidosCompletados,
          ingresos,
          gastos: totalGastos,
          neto: ingresos - totalGastos,
          ingresosPorMetodo
        };
        
        // Obtener pedidos pendientes de recogida de los datos ya cargados
        const pendientes = todosLosPedidos.filter(p => p.status === 'entregado');
        
        setReporteDiario(reportePersonalizado);
        setPedidosPendientes(pendientes);
        setTotalClientes(totalClientesCount);
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Ingresos Totales',
      value: formatCurrency(reporteDiario?.ingresos || 0),
      icon: CurrencyDollarIcon,
      color: 'text-success-600',
      bgColor: 'bg-gradient-to-br from-success-100 to-success-200',
      borderColor: 'border-success-300',
      link: '/reportes'
    },
    {
      name: 'Total Pedidos',
      value: reporteDiario?.pedidos || 0,
      icon: ClipboardDocumentListIcon,
      color: 'text-primary-600',
      bgColor: 'bg-gradient-to-br from-primary-100 to-primary-200',
      borderColor: 'border-primary-300',
      link: '/pedidos'
    },
    {
      name: 'Total Gastos',
      value: formatCurrency(reporteDiario?.gastos || 0),
      icon: ExclamationTriangleIcon,
      color: 'text-warning-600',
      bgColor: 'bg-gradient-to-br from-warning-100 to-warning-200',
      borderColor: 'border-warning-300',
      link: '/gastos'
    },
    {
      name: 'Total Clientes',
      value: totalClientes,
      icon: UserGroupIcon,
      color: 'text-accent-600',
      bgColor: 'bg-gradient-to-br from-accent-100 to-accent-200',
      borderColor: 'border-accent-300',
      link: '/clientes'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Resumen histórico completo - Todos los datos registrados
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <a 
            key={stat.name} 
            href={stat.link}
            className="card-colored border-l-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer" 
            style={{borderLeftColor: stat.color.replace('text-', '#')}}
          >
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-4 rounded-xl ${stat.bgColor} border ${stat.borderColor} shadow-md`}>
                <stat.icon className={`h-7 w-7 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Ingresos por método de pago */}
      {reporteDiario?.ingresosPorMetodo && (
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
                {formatCurrency(reporteDiario.ingresosPorMetodo.efectivo)}
              </p>
              <p className="text-xs text-green-600">
                {reporteDiario.ingresos > 0 ? 
                  `${((reporteDiario.ingresosPorMetodo.efectivo / reporteDiario.ingresos) * 100).toFixed(1)}%` 
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
                {formatCurrency(reporteDiario.ingresosPorMetodo.nequi)}
              </p>
              <p className="text-xs text-blue-600">
                {reporteDiario.ingresos > 0 ? 
                  `${((reporteDiario.ingresosPorMetodo.nequi / reporteDiario.ingresos) * 100).toFixed(1)}%` 
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
                {formatCurrency(reporteDiario.ingresosPorMetodo.daviplata)}
              </p>
              <p className="text-xs text-purple-600">
                {reporteDiario.ingresos > 0 ? 
                  `${((reporteDiario.ingresosPorMetodo.daviplata / reporteDiario.ingresos) * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Resumen financiero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen Financiero</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Ingresos:</dt>
              <dd className="text-sm font-medium text-success-600">
                {formatCurrency(reporteDiario?.ingresos || 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Gastos:</dt>
              <dd className="text-sm font-medium text-danger-600">
                {formatCurrency(reporteDiario?.gastos || 0)}
              </dd>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-900">Neto:</dt>
                <dd className={`text-sm font-bold ${
                  (reporteDiario?.neto || 0) >= 0 ? 'text-success-600' : 'text-danger-600'
                }`}>
                  {formatCurrency(reporteDiario?.neto || 0)}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Pedidos pendientes de recogida */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pedidos Pendientes de Recogida</h3>
          {pedidosPendientes.length === 0 ? (
            <p className="text-sm text-gray-500">No hay pedidos pendientes de recogida</p>
          ) : (
            <div className="space-y-3">
              {pedidosPendientes.slice(0, 5).map((pedido) => (
                <div key={pedido.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pedido.cliente.name}</p>
                    <p className="text-xs text-gray-500">{pedido.cliente.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {pedido.fechaRecogidaCalculada ? formatDate(pedido.fechaRecogidaCalculada, 'HH:mm') : '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pedido.fechaRecogidaCalculada ? formatDate(pedido.fechaRecogidaCalculada, 'dd/MM') : '-'}
                    </p>
                  </div>
                </div>
              ))}
              {pedidosPendientes.length > 5 && (
                <p className="text-xs text-gray-500 text-center">
                  Y {pedidosPendientes.length - 5} más...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;


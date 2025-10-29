import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  EyeIcon,
  CalendarIcon,
  UserIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { pedidoService } from '../services/firebaseService';
import { formatDate, formatCurrency } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import ModalDetallesServicio from '../components/ModalDetallesServicio';

const Auditoria: React.FC = () => {
  const { firebaseUser } = useAuth();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [serviciosEliminados, setServiciosEliminados] = useState<Pedido[]>([]);
  const [serviciosFiltrados, setServiciosFiltrados] = useState<Pedido[]>([]);
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Pedido | null>(null);
  
  // Estados de filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Cargar servicios eliminados
  const cargarServiciosEliminados = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando servicios eliminados...');
      
      const todosLosPedidos = await pedidoService.getAllPedidosConEliminados();
      const eliminados = todosLosPedidos.filter(pedido => pedido.eliminado === true);
      
      console.log('📊 Total pedidos obtenidos:', todosLosPedidos.length);
      console.log('📊 Servicios eliminados encontrados:', eliminados.length);
      console.log('📊 Detalles de eliminados:', eliminados);
      
      setServiciosEliminados(eliminados);
      setServiciosFiltrados(eliminados);
      
    } catch (error) {
      console.error('❌ Error al cargar servicios eliminados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    let filtrados = [...serviciosEliminados];

    // Filtro por texto (cliente, plan, etc.)
    if (filtroTexto) {
      filtrados = filtrados.filter(servicio =>
        servicio.cliente.name.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        servicio.plan.name.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        servicio.id.toLowerCase().includes(filtroTexto.toLowerCase())
      );
    }

    // Filtro por cliente
    if (filtroCliente) {
      filtrados = filtrados.filter(servicio =>
        servicio.cliente.name.toLowerCase().includes(filtroCliente.toLowerCase())
      );
    }

    // Filtro por fecha de eliminación
    if (filtroFechaInicio) {
      const fechaInicio = new Date(filtroFechaInicio);
      filtrados = filtrados.filter(servicio => {
        const fechaEliminacion = servicio.fechaEliminacion instanceof Date 
          ? servicio.fechaEliminacion 
          : (servicio.fechaEliminacion ? new Date(servicio.fechaEliminacion) : new Date());
        return fechaEliminacion >= fechaInicio;
      });
    }

    if (filtroFechaFin) {
      const fechaFin = new Date(filtroFechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter(servicio => {
        const fechaEliminacion = servicio.fechaEliminacion instanceof Date 
          ? servicio.fechaEliminacion 
          : (servicio.fechaEliminacion ? new Date(servicio.fechaEliminacion) : new Date());
        return fechaEliminacion <= fechaFin;
      });
    }

    // Filtro por estado original
    if (filtroEstado !== 'todos') {
      filtrados = filtrados.filter(servicio => servicio.status === filtroEstado);
    }

    setServiciosFiltrados(filtrados);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroTexto('');
    setFiltroFechaInicio('');
    setFiltroFechaFin('');
    setFiltroCliente('');
    setFiltroEstado('todos');
    setServiciosFiltrados(serviciosEliminados);
  };

  // Abrir modal de detalles
  const abrirDetalles = (servicio: Pedido) => {
    setServicioSeleccionado(servicio);
    setMostrarModalDetalles(true);
  };

  // Cerrar modal
  const cerrarModal = () => {
    setMostrarModalDetalles(false);
    setServicioSeleccionado(null);
  };

  // Efectos
  useEffect(() => {
    cargarServiciosEliminados();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [filtroTexto, filtroFechaInicio, filtroFechaFin, filtroCliente, filtroEstado, serviciosEliminados]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando auditoría...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Auditoría de Servicios</h1>
          <p className="text-gray-600">Historial de servicios eliminados y modificaciones</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <FunnelIcon className="h-5 w-5 mr-2 text-primary-600" />
              Filtros de Búsqueda
            </h2>
            <button
              onClick={limpiarFiltros}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda general */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Búsqueda general
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  placeholder="Cliente, plan, ID..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Filtro por cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <div className="relative">
                <UserIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Filtro por fecha inicio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha eliminación desde
              </label>
              <div className="relative">
                <CalendarIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={filtroFechaInicio}
                  onChange={(e) => setFiltroFechaInicio(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Filtro por fecha fin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha eliminación hasta
              </label>
              <div className="relative">
                <CalendarIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={filtroFechaFin}
                  onChange={(e) => setFiltroFechaFin(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Filtro por estado */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado original del servicio
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="entregado">Entregado</option>
              <option value="recogido">Recogido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Servicios Eliminados
              </h3>
              <p className="text-gray-600">
                {serviciosFiltrados.length} de {serviciosEliminados.length} servicios
              </p>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
              Historial de auditoría
            </div>
          </div>
        </div>

        {/* Tabla de servicios eliminados */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {serviciosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {serviciosEliminados.length === 0 ? 'No hay servicios eliminados' : 'No se encontraron servicios'}
              </h3>
              <p className="text-gray-500">
                {serviciosEliminados.length === 0 
                  ? 'Los servicios eliminados aparecerán aquí para auditoría'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
            </div>
          ) : (
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
                      Estado Original
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Eliminación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {serviciosFiltrados.map((servicio) => (
                    <tr key={servicio.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {servicio.cliente.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {servicio.plan.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(servicio.plan.price || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          servicio.status === 'entregado' ? 'bg-green-100 text-green-800' :
                          servicio.status === 'recogido' ? 'bg-blue-100 text-blue-800' :
                          servicio.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {servicio.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {servicio.fechaEliminacion ? 
                          formatDate(servicio.fechaEliminacion instanceof Date ? 
                            servicio.fechaEliminacion : 
                            new Date(servicio.fechaEliminacion)
                          ) : 
                          'N/A'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(servicio.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => abrirDetalles(servicio)}
                          className="text-primary-600 hover:text-primary-900 flex items-center"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles */}
      {mostrarModalDetalles && servicioSeleccionado && (
        <ModalDetallesServicio
          isOpen={mostrarModalDetalles}
          onClose={cerrarModal}
          pedido={servicioSeleccionado}
        />
      )}
    </div>
  );
};

export default Auditoria;

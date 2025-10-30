import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  EyeIcon,
  CalendarIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Auditoria as AuditoriaType, TipoAccionAuditoria } from '../types';
import { auditoriaService } from '../services/auditoriaService';
import { formatDate } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

const Auditoria: React.FC = () => {
  const { firebaseUser, esAdmin } = useAuth();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [registrosAuditoria, setRegistrosAuditoria] = useState<AuditoriaType[]>([]);
  const [registrosFiltrados, setRegistrosFiltrados] = useState<AuditoriaType[]>([]);
  
  // Estados de filtros con fecha de hoy por defecto
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // formato YYYY-MM-DD
  
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState(todayStr);
  const [filtroFechaFin, setFiltroFechaFin] = useState(todayStr);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroAccion, setFiltroAccion] = useState<TipoAccionAuditoria | 'todos'>('todos');
  const [filtroEntidad, setFiltroEntidad] = useState('todos');

  // Cargar registros de auditoría
  const cargarRegistrosAuditoria = async () => {
    try {
      setLoading(true);
      console.log('🔍 Cargando registros de auditoría...');
      
      const registros = await auditoriaService.obtenerRegistrosAuditoria();
      
      console.log('📊 Total registros obtenidos:', registros.length);
      
      setRegistrosAuditoria(registros);
      setRegistrosFiltrados(registros);
      
    } catch (error) {
      console.error('❌ Error al cargar registros de auditoría:', error);
      alert('Error al cargar registros de auditoría: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    let filtrados = [...registrosAuditoria];

    // Filtro por texto (busca en detalles, usuario, entidad)
    if (filtroTexto) {
      const texto = filtroTexto.toLowerCase();
      filtrados = filtrados.filter(registro => 
        registro.detalles.toLowerCase().includes(texto) ||
        registro.usuarioNombre.toLowerCase().includes(texto) ||
        registro.entidadTipo.toLowerCase().includes(texto)
      );
    }

    // Filtro por fecha (manejar zona horaria correctamente)
    if (filtroFechaInicio) {
      const fechaInicio = new Date(filtroFechaInicio + 'T00:00:00');
      filtrados = filtrados.filter(registro => 
        registro.fecha >= fechaInicio
      );
    }

    if (filtroFechaFin) {
      const fechaFin = new Date(filtroFechaFin + 'T23:59:59.999');
      filtrados = filtrados.filter(registro => 
        registro.fecha <= fechaFin
      );
    }

    // Filtro por usuario
    if (filtroUsuario) {
      filtrados = filtrados.filter(registro => 
        registro.usuarioNombre.toLowerCase().includes(filtroUsuario.toLowerCase())
      );
    }

    // Filtro por acción
    if (filtroAccion !== 'todos') {
      filtrados = filtrados.filter(registro => 
        registro.tipoAccion === filtroAccion
      );
    }

    // Filtro por entidad
    if (filtroEntidad !== 'todos') {
      filtrados = filtrados.filter(registro => 
        registro.entidadTipo === filtroEntidad
      );
    }

    // Ordenar por fecha más reciente
    filtrados.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

    setRegistrosFiltrados(filtrados);
  };

  // Efecto para aplicar filtros
  useEffect(() => {
    aplicarFiltros();
  }, [filtroTexto, filtroFechaInicio, filtroFechaFin, filtroUsuario, filtroAccion, filtroEntidad, registrosAuditoria]);

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarRegistrosAuditoria();
  }, []);

  // Función para obtener el color del badge según el tipo de acción
  const getAccionColor = (accion: TipoAccionAuditoria) => {
    switch (accion) {
      case 'crear_servicio':
        return 'bg-green-100 text-green-800';
      case 'modificar_servicio':
        return 'bg-blue-100 text-blue-800';
      case 'entregar_servicio':
        return 'bg-yellow-100 text-yellow-800';
      case 'recoger_servicio':
        return 'bg-purple-100 text-purple-800';
      case 'eliminar_servicio':
        return 'bg-red-100 text-red-800';
      case 'registrar_pago':
        return 'bg-emerald-100 text-emerald-800';
      case 'gestionar_inventario':
        return 'bg-indigo-100 text-indigo-800';
      case 'gestionar_capital':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Función para obtener el texto legible de la acción
  const getAccionTexto = (accion: TipoAccionAuditoria) => {
    switch (accion) {
      case 'crear_servicio':
        return 'Crear Servicio';
      case 'modificar_servicio':
        return 'Modificar Servicio';
      case 'entregar_servicio':
        return 'Entregar Servicio';
      case 'recoger_servicio':
        return 'Recoger Servicio';
      case 'eliminar_servicio':
        return 'Eliminar Servicio';
      case 'registrar_pago':
        return 'Registrar Pago';
      case 'gestionar_inventario':
        return 'Gestionar Inventario';
      case 'gestionar_capital':
        return 'Gestionar Capital';
      default:
        return accion;
    }
  };

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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary-800">Auditoría del Sistema</h1>
          <p className="text-gray-600">Registro completo de todas las acciones realizadas en el sistema</p>
        </div>
        <button
          onClick={cargarRegistrosAuditoria}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Recargar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center mb-4">
          <FunnelIcon className="h-6 w-6 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Búsqueda por texto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Búsqueda
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar en detalles..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Filtro por fecha inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filtro por fecha fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filtro por usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              placeholder="Nombre del usuario..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filtro por acción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acción
            </label>
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value as TipoAccionAuditoria | 'todos')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Todas las acciones</option>
              <option value="crear_servicio">Crear Servicio</option>
              <option value="modificar_servicio">Modificar Servicio</option>
              <option value="entregar_servicio">Entregar Servicio</option>
              <option value="recoger_servicio">Recoger Servicio</option>
              <option value="eliminar_servicio">Eliminar Servicio</option>
              <option value="registrar_pago">Registrar Pago</option>
              <option value="gestionar_inventario">Gestionar Inventario</option>
              <option value="gestionar_capital">Gestionar Capital</option>
            </select>
          </div>

          {/* Filtro por entidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entidad
            </label>
            <select
              value={filtroEntidad}
              onChange={(e) => setFiltroEntidad(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Todas las entidades</option>
              <option value="pedido">Pedido</option>
              <option value="modificacion">Modificación</option>
              <option value="cliente">Cliente</option>
              <option value="lavadora">Lavadora</option>
              <option value="gasto">Gasto</option>
              <option value="capital">Capital</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Resumen</h2>
            <p className="text-gray-600">
              Mostrando {registrosFiltrados.length} de {registrosAuditoria.length} registros
            </p>
          </div>
        </div>
      </div>

      {/* Lista de registros */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {registrosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No se encontraron registros de auditoría</p>
            <p className="text-gray-400 text-sm">Ajusta los filtros para ver más resultados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha y Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detalles
                  </th>
                  {esAdmin() && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cambios
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrosFiltrados.map((registro, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {formatDate(registro.fecha)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {registro.usuarioNombre}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccionColor(registro.tipoAccion)}`}>
                        {getAccionTexto(registro.tipoAccion)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registro.entidadTipo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={registro.detalles}>
                        {registro.detalles}
                      </div>
                    </td>
                    {esAdmin() && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {registro.valoresAnteriores || registro.valoresNuevos ? (
                          <div className="text-xs">
                            {registro.valoresAnteriores && (
                              <div className="text-red-600 mb-1">
                                <strong>Antes:</strong> {JSON.stringify(registro.valoresAnteriores, null, 2)}
                              </div>
                            )}
                            {registro.valoresNuevos && (
                              <div className="text-green-600">
                                <strong>Después:</strong> {JSON.stringify(registro.valoresNuevos, null, 2)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auditoria;
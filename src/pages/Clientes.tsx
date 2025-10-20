import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PlusIcon, MapPinIcon, PhoneIcon, UserGroupIcon, EyeIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { clienteService } from '../services/firebaseService';
import { Cliente } from '../types';
import { formatDate } from '../utils/dateUtils';
import MapComponent from '../components/MapComponent';
import ModalCliente from '../components/ModalCliente';

const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const resultados = await clienteService.searchClientes('');
      setClientes(resultados);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarClientes = async (termino: string) => {
    setBusqueda(termino);
    if (termino.length < 2) {
      cargarClientes();
      return;
    }
    
    try {
      const resultados = await clienteService.searchClientes(termino);
      setClientes(resultados);
    } catch (error) {
      console.error('Error al buscar clientes:', error);
    }
  };

  const handleClienteCreated = (cliente: Cliente) => {
    cargarClientes();
      setClienteEditando(null);
      setMostrarFormulario(false);
  };

  const editarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setMostrarFormulario(true);
  };

  const eliminarCliente = async (clienteId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      return;
    }

    try {
      await clienteService.deleteCliente(clienteId);
      cargarClientes();
      alert('Cliente eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      alert('Error al eliminar el cliente');
    }
  };

  const cancelarEdicion = () => {
    setClienteEditando(null);
    setMostrarFormulario(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header principal */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Gestión de Clientes</h2>
          <p className="text-gray-600 mt-1">Administra la información de tus clientes y sus ubicaciones</p>
        </div>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre o teléfono..."
            className="input-field flex-1"
            value={busqueda}
            onChange={(e) => buscarClientes(e.target.value)}
          />
        </div>
      </div>

      {/* Modal para crear/editar cliente */}
      <ModalCliente
        isOpen={mostrarFormulario}
        onClose={cancelarEdicion}
        onClienteCreated={handleClienteCreated}
        clienteEditando={clienteEditando}
      />

      {/* Sección de clientes existentes */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Clientes Registrados ({clientes.length})
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {busqueda ? `Mostrando resultados para "${busqueda}"` : 'Todos los clientes registrados'}
            </p>
          </div>
          <button
            onClick={() => setMostrarMapa(!mostrarMapa)}
            className="btn-secondary flex items-center space-x-2"
          >
            <EyeIcon className="h-4 w-4" />
            <span>{mostrarMapa ? 'Ocultar Mapa' : 'Ver Mapa de Clientes'}</span>
          </button>
        </div>
        
        {/* Mapa de clientes */}
        {mostrarMapa && (
          <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Mapa de Ubicaciones de Clientes</h4>
              <p className="text-sm text-gray-600 mt-1">
                Visualiza la distribución geográfica de tus clientes para planificar rutas de entrega
              </p>
            </div>
            <MapComponent
              markers={clientes
                .filter(cliente => cliente.ubicacionGPS)
                .map(cliente => ({
                  id: cliente.id!,
                  position: [cliente.ubicacionGPS!.lat, cliente.ubicacionGPS!.lng] as [number, number],
                  title: cliente.name,
                  description: `${cliente.phone} - ${cliente.address}`
                }))}
              height="400px"
            />
          </div>
        )}
        
        {/* Tabla de clientes */}
        {clientes.length === 0 ? (
          <div className="text-center py-12">
            <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {busqueda ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </h4>
            <p className="text-gray-500 mb-4">
              {busqueda 
                ? `No hay clientes que coincidan con "${busqueda}"`
                : 'Comienza agregando tu primer cliente'
              }
            </p>
            {!busqueda && (
              <button
                onClick={() => setMostrarFormulario(true)}
                className="btn-primary"
              >
                Agregar Primer Cliente
              </button>
            )}
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
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ubicación GPS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
            {clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {cliente.name}
                        </div>
                        {cliente.notes && (
                          <div className="text-sm text-gray-500 mt-1 max-w-xs truncate">
                            {cliente.notes}
                          </div>
                        )}
                  </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`https://wa.me/57${cliente.phone.replace(/\D/g, '')}?text=Hola ${cliente.name}, te contactamos desde Alquiler Global.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-primary-600 hover:text-primary-800 transition-colors"
                        title="Enviar mensaje por WhatsApp"
                      >
                        <PhoneIcon className="h-4 w-4 mr-2" />
                        {cliente.phone}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        {cliente.address || 'Sin dirección'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cliente.ubicacionGPS ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${cliente.ubicacionGPS.lat},${cliente.ubicacionGPS.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-primary-600 hover:text-primary-800 text-sm"
                        >
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          Ver en Maps
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">Sin ubicación</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                    <button
                      onClick={() => editarCliente(cliente)}
                          className="text-warning-600 hover:text-warning-900"
                      title="Editar cliente"
                    >
                          <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => eliminarCliente(cliente.id!)}
                          className="text-danger-600 hover:text-danger-900"
                      title="Eliminar cliente"
                    >
                          <TrashIcon className="h-4 w-4" />
                    </button>
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
  );
};

export default Clientes;

import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, PlusIcon, MapPinIcon, PhoneIcon, UserGroupIcon, EyeIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { clienteService, pedidoService } from '../services/firebaseService';
import { Cliente, Pedido } from '../types';
import { formatDate, generateWhatsAppLink, formatCurrency } from '../utils/dateUtils';
import MapComponent from '../components/MapComponent';
import ModalCliente from '../components/ModalCliente';
import NuevoPedido from './NuevoPedido';

const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  
  // Estados para nuevo servicio
  const [mostrarNuevoServicio, setMostrarNuevoServicio] = useState(false);
  const [clienteParaServicio, setClienteParaServicio] = useState<Cliente | null>(null);
  
  // Estados para resumen de deudas
  const [mostrarResumenDeudas, setMostrarResumenDeudas] = useState(false);
  const [clienteConDeudas, setClienteConDeudas] = useState<Cliente | null>(null);
  const [resumenDeudas, setResumenDeudas] = useState<any>(null);

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

  // Función para abrir nuevo servicio con cliente pre-seleccionado
  const abrirNuevoServicio = (cliente: Cliente) => {
    setClienteParaServicio(cliente);
    setMostrarNuevoServicio(true);
  };

  // Función para obtener resumen de deudas de un cliente
  const obtenerResumenDeudas = async (cliente: Cliente) => {
    try {
      const pedidos = await pedidoService.getAllPedidos();
      const pedidosCliente = pedidos.filter(p => p.clienteId === cliente.id);
      const pedidosConDeuda = pedidosCliente.filter(p => (p.saldoPendiente || 0) > 0);
      
      if (pedidosConDeuda.length === 0) return null;

      const resumen = {
        totalServicios: pedidosConDeuda.length,
        totalDeuda: pedidosConDeuda.reduce((sum, p) => sum + (p.saldoPendiente || 0), 0),
        porPlan: pedidosConDeuda.reduce((acc, p) => {
          const planName = p.plan.name;
          if (!acc[planName]) {
            acc[planName] = { cantidad: 0, total: 0 };
          }
          acc[planName].cantidad += 1;
          acc[planName].total += p.saldoPendiente || 0;
          return acc;
        }, {} as any)
      };

      return resumen;
    } catch (error) {
      console.error('Error al obtener resumen de deudas:', error);
      return null;
    }
  };

  // Función para mostrar resumen de deudas
  const mostrarResumenDeudasCliente = async (cliente: Cliente) => {
    const resumen = await obtenerResumenDeudas(cliente);
    if (resumen) {
      setClienteConDeudas(cliente);
      setResumenDeudas(resumen);
      setMostrarResumenDeudas(true);
    }
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
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => abrirNuevoServicio(cliente)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            title="Crear nuevo servicio para este cliente"
                          >
                            {cliente.name}
                          </button>
                          <ClienteBadgeDeuda cliente={cliente} onShowResumen={mostrarResumenDeudasCliente} />
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
                        href={generateWhatsAppLink(cliente.phone, cliente.name)}
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

      {/* Modal para nuevo servicio con cliente pre-seleccionado */}
      {mostrarNuevoServicio && clienteParaServicio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Nuevo Servicio - {clienteParaServicio.name}
              </h3>
              <button
                onClick={() => {
                  setMostrarNuevoServicio(false);
                  setClienteParaServicio(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <NuevoPedido 
              onClose={() => {
                setMostrarNuevoServicio(false);
                setClienteParaServicio(null);
              }}
              clientePreSeleccionado={clienteParaServicio}
            />
          </div>
        </div>
      )}

      {/* Modal de resumen de deudas */}
      {mostrarResumenDeudas && clienteConDeudas && resumenDeudas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Resumen de Deudas - {clienteConDeudas.name}
              </h3>
              <button
                onClick={() => {
                  setMostrarResumenDeudas(false);
                  setClienteConDeudas(null);
                  setResumenDeudas(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium text-orange-800">Total Pendiente</h4>
                  <span className="text-2xl font-bold text-orange-900">
                    {formatCurrency(resumenDeudas.totalDeuda)}
                  </span>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  {resumenDeudas.totalServicios} servicio{resumenDeudas.totalServicios !== 1 ? 's' : ''} pendiente{resumenDeudas.totalServicios !== 1 ? 's' : ''}
                </p>
              </div>

              <div>
                <h5 className="text-md font-medium text-gray-900 mb-3">Desglose por Plan</h5>
                <div className="space-y-2">
                  {Object.entries(resumenDeudas.porPlan).map(([planName, data]: [string, any]) => (
                    <div key={planName} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900">{planName}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          ({data.cantidad} servicio{data.cantidad !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(data.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para mostrar badge de deuda pendiente
const ClienteBadgeDeuda: React.FC<{
  cliente: Cliente;
  onShowResumen: (cliente: Cliente) => void;
}> = ({ cliente, onShowResumen }) => {
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const obtenerSaldoPendiente = async () => {
      try {
        const pedidos = await pedidoService.getAllPedidos();
        const pedidosCliente = pedidos.filter(p => p.clienteId === cliente.id);
        const totalDeuda = pedidosCliente.reduce((sum, p) => {
          const totalPagado = p.pagosRealizados?.reduce((sumPago, pago) => sumPago + pago.monto, 0) || 0;
          const saldoPendiente = Math.max(0, (p.total || 0) - totalPagado);
          return sum + saldoPendiente;
        }, 0);
        setSaldoPendiente(totalDeuda);
      } catch (error) {
        console.error('Error al obtener saldo pendiente:', error);
      } finally {
        setLoading(false);
      }
    };

    obtenerSaldoPendiente();
  }, [cliente.id]);

  if (loading) return null;
  if (saldoPendiente <= 0) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onShowResumen(cliente);
      }}
      className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200 rounded-full hover:bg-orange-200 transition-colors"
      title={`Saldo pendiente: ${formatCurrency(saldoPendiente)}`}
    >
      💰 {formatCurrency(saldoPendiente)}
    </button>
  );
};

export default Clientes;

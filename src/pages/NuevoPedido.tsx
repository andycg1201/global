import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  planService, 
  clienteService, 
  pedidoService, 
  configService,
} from '../services/firebaseService';
import { 
  formatDate, 
  formatCurrency, 
  calculatePickupDate, 
  calculateOrderTotal,
  getCurrentDateColombia,
  getDefaultDeliveryDate,
  canUsePlan,
  getAvailablePlans
} from '../utils/dateUtils';
import { Plan, Cliente, Pedido, Configuracion } from '../types';
import { MagnifyingGlassIcon, PlusIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import ModalCliente from '../components/ModalCliente';

interface NuevoPedidoProps {
  onClose?: () => void;
  clientePreSeleccionado?: Cliente;
}

const NuevoPedido: React.FC<NuevoPedidoProps> = memo(({ onClose, clientePreSeleccionado }) => {
  console.log('🔄 NuevoPedido renderizando');
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados del formulario (solo datos básicos del pedido)
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState<Date>(getDefaultDeliveryDate());
  const [observaciones, setObservaciones] = useState('');
  const [isPrioritario, setIsPrioritario] = useState(false);
  const [motivoPrioridad, setMotivoPrioridad] = useState('');
  const [turno, setTurno] = useState<'mañana' | 'tarde' | null>(null);
  
  
  // Estados para búsqueda y datos
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const datosCargados = useRef(false);

  const cargarDatos = useCallback(async () => {
    console.log('🔄 cargarDatos ejecutándose');
    setLoading(true);
    try {
      const [planesData, configData, pedidosData] = await Promise.all([
        planService.getActivePlans(),
        configService.getConfiguracion(),
        pedidoService.getAllPedidos()
      ]);
      
      console.log('🔍 Planes cargados:', planesData.length, planesData);
      setPlanes(planesData);
      setConfiguracion(configData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('🔄 useEffect cargarDatos ejecutándose');
    if (!datosCargados.current) {
      datosCargados.current = true;
      cargarDatos();
    }
  }, [cargarDatos]);

  // Establecer cliente pre-seleccionado si se proporciona
  useEffect(() => {
    if (clientePreSeleccionado) {
      setCliente(clientePreSeleccionado);
    }
  }, [clientePreSeleccionado]);

  // Establecer turno por defecto según el plan seleccionado
  useEffect(() => {
    if (plan) {
      // Planes 1, 3, 4 → Mañana por defecto
      if (plan.name === 'PLAN 1' || plan.name === 'PLAN 3' || plan.name === 'PLAN 4') {
        setTurno('mañana');
      } else if (plan.name === 'PLAN 2' || plan.name === 'PLAN 5') {
        // Planes 2, 5 → Tarde por defecto
        setTurno('tarde');
      } else {
        // Plan no reconocido, seleccionar tarde por defecto
        setTurno('tarde');
      }
    }
  }, [plan]);

  // Removido: cálculo automático de totales (ahora se hace en los modales de facturación)

  const buscarClientes = async (termino: string) => {
    if (termino.length < 2) {
      setClientesEncontrados([]);
      return;
    }
    
    try {
      const resultados = await clienteService.searchClientes(termino);
      setClientesEncontrados(resultados);
    } catch (error) {
      console.error('Error al buscar clientes:', error);
    }
  };

  const seleccionarCliente = (clienteSeleccionado: Cliente) => {
    setCliente(clienteSeleccionado);
    setBusquedaCliente('');
    setClientesEncontrados([]);
  };

  const handleClienteCreated = (clienteCreado: Cliente) => {
    setCliente(clienteCreado);
    setMostrarModalCliente(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cliente) {
      alert('Debe seleccionar un cliente');
      return;
    }
    
    if (!plan) {
      alert('Debe seleccionar un plan');
      return;
    }
    
    if (!fechaEntrega) {
      alert('Debe seleccionar una fecha de entrega');
      return;
    }
    
    if (!user) {
      alert('Error de autenticación');
      return;
    }

    setSaving(true);
    try {
      const nuevoPedido: Omit<Pedido, 'id' | 'createdAt' | 'updatedAt'> = {
        clienteId: cliente.id,
        cliente,
        planId: plan.id,
        plan,
        status: 'pendiente',
        isPrioritario,
        ...(isPrioritario && motivoPrioridad && { motivoPrioridad }),
        fechaAsignacion: getCurrentDateColombia(),
        fechaEntrega,
        horasAdicionales: 0, // Se ajustará en facturación
        
        // Sistema de facturación separado
        estadoPago: 'pendiente',
        cobrosAdicionales: [],
        descuentos: [],
        reembolsos: [],
        
        // Totales iniciales
        subtotal: plan.price,
        totalCobrosAdicionales: 0,
        totalDescuentos: 0,
        totalReembolsos: 0,
        total: plan.price,
        
        // Sistema de liquidación universal
        pagosRealizados: [],
        saldoPendiente: plan.price,
        
        observaciones,
        createdBy: user.id
      };

      await pedidoService.createPedido(nuevoPedido);
      
      
      // Limpiar formulario
      setCliente(null);
      setPlan(null);
      setFechaEntrega(getDefaultDeliveryDate());
      setObservaciones('');
      setIsPrioritario(false);
      setMotivoPrioridad('');
      setTurno(null);
      
      alert('Servicio creado exitosamente');
      
      // Cerrar modal si se proporciona la función onClose
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert('Error al crear el pedido');
    } finally {
      setSaving(false);
    }
  };


  // Temporalmente mostrar todos los planes para permitir crear pedidos
  const planesDisponibles = planes; // planes.filter(p => canUsePlan(p.id, fechaEntrega, p.name));
  
  console.log('🔍 Planes disponibles para renderizar:', planesDisponibles.length, planesDisponibles);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selección de Cliente */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cliente</h3>
          
          {!cliente ? (
            <div className="space-y-4">
              <div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="input-field pr-10"
                      placeholder="Nombre o teléfono del cliente"
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        buscarClientes(e.target.value);
                      }}
                    />
                    <MagnifyingGlassIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarModalCliente(true)}
                    className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                    title="Crear nuevo cliente"
                  >
                    <PlusIcon className="h-5 w-5 text-primary-600" />
                  </button>
                </div>
                
                {clientesEncontrados.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {clientesEncontrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        onClick={() => seleccionarCliente(c)}
                      >
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-sm text-gray-500">{c.phone}</div>
                        {c.address && (
                          <div className="text-xs text-gray-400 flex items-center">
                            <MapPinIcon className="h-3 w-3 mr-1" />
                            {c.address}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">{cliente.name}</h4>
                <p className="text-sm text-gray-500">{cliente.phone}</p>
                {cliente.address && (
                  <p className="text-xs text-gray-400 flex items-center">
                    <MapPinIcon className="h-3 w-3 mr-1" />
                    {cliente.address}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCliente(null)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Cambiar
              </button>
            </div>
          )}

        </div>

        {/* Selección de Plan */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Plan de Alquiler</h3>
          
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {planesDisponibles.map((p, index) => {
              const colors = [
                'from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-200',
                'from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-200',
                'from-purple-50 to-purple-100 border-purple-200 hover:from-purple-100 hover:to-purple-200',
                'from-orange-50 to-orange-100 border-orange-200 hover:from-orange-100 hover:to-orange-200',
                'from-pink-50 to-pink-100 border-pink-200 hover:from-pink-100 hover:to-pink-200'
              ];
              const selectedColors = [
                'from-blue-100 to-blue-200 border-blue-400',
                'from-green-100 to-green-200 border-green-400',
                'from-purple-100 to-purple-200 border-purple-400',
                'from-orange-100 to-orange-200 border-orange-400',
                'from-pink-100 to-pink-200 border-pink-400'
              ];
              const colorIndex = index % colors.length;
              const isSelected = plan?.id === p.id;
              
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`w-full px-3 py-3 border-2 rounded-lg text-center transition-all duration-200 shadow-sm hover:shadow-md ${
                    isSelected
                      ? `bg-gradient-to-br ${selectedColors[colorIndex]} shadow-md scale-105`
                      : `bg-gradient-to-br ${colors[colorIndex]} hover:shadow-md`
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900 mb-2">{p.name}</div>
                  <div className="text-xs text-gray-600 mb-2 leading-tight break-words line-clamp-2">{p.description}</div>
                  <div className="text-sm font-bold text-primary-600">
                    {formatCurrency(p.price)}
                  </div>
                </button>
              );
            })}
          </div>
          
          {planesDisponibles.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No hay planes disponibles para la fecha seleccionada
            </p>
          )}
        </div>

        {/* Selección de Lavadora */}

        {/* Calendario y Selección de Fecha */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Seleccionar Fecha y Turno</h3>
          
          <div className="space-y-4">
            {/* Botón del calendario */}

            {/* Selector de fecha actual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Seleccionada
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={fechaEntrega.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setFechaEntrega(newDate);
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Turno
                </label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setTurno('mañana')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                      turno === 'mañana'
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg shadow-yellow-500/25'
                        : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 hover:from-yellow-50 hover:to-orange-50 hover:text-orange-600 border-2 border-transparent hover:border-yellow-200'
                    }`}
                  >
                    🌅 Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => setTurno('tarde')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                      turno === 'tarde'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 hover:from-purple-50 hover:to-pink-50 hover:text-purple-600 border-2 border-transparent hover:border-purple-200'
                    }`}
                  >
                    🌆 Tarde
                  </button>
                </div>
              </div>
            </div>

            {/* Información de la fecha seleccionada */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Fecha y turno seleccionados:
                  </p>
                  <p className="text-lg font-semibold text-primary-600">
                    {formatDate(fechaEntrega, 'dd/MM/yyyy')} - {turno ? (turno === 'mañana' ? 'Mañana' : 'Tarde') : 'Sin turno seleccionado'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {fechaEntrega.toLocaleDateString('es-ES', { weekday: 'long' })}
                  </p>
                </div>
              </div>
            </div>
            
            {plan && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Recogida programada:</strong> {formatDate(calculatePickupDate(fechaEntrega, plan, 0), 'dd/MM/yyyy HH:mm')}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Duración del plan: {plan.duration} horas (las horas adicionales se ajustarán en la entrega)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pedido Prioritario */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Prioridad del Pedido</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrioritario"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={isPrioritario}
                onChange={(e) => setIsPrioritario(e.target.checked)}
              />
              <label htmlFor="isPrioritario" className="ml-2 block text-sm font-medium text-gray-700">
                Marcar como pedido prioritario
              </label>
            </div>
            
            {isPrioritario && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de la prioridad
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={motivoPrioridad}
                  onChange={(e) => setMotivoPrioridad(e.target.value)}
                  placeholder="Ej: Cliente sale a las 8 AM, entrega urgente, etc."
                  required={isPrioritario}
                />
              </div>
            )}
          </div>
        </div>


        {/* Observaciones */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Observaciones</h3>
          <textarea
            className="input-field"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales del pedido..."
          />
        </div>

        {/* Resumen del Pedido */}
        {plan && (
          <div className="card bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen del Pedido</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan {plan.name}:</span>
                <span className="font-medium">{formatCurrency(plan.price)}</span>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total del Plan:</span>
                  <span className="text-primary-600">
                    {formatCurrency(plan.price)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Los cobros adicionales, horas extra, descuentos y reembolsos se manejarán en el momento de la entrega y recogida.
              </p>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!cliente || !plan || !fechaEntrega || !turno || saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Crear Servicio'}
          </button>
        </div>
      </form>

      {/* Modal para crear cliente */}
      <ModalCliente
        isOpen={mostrarModalCliente}
        onClose={() => setMostrarModalCliente(false)}
        onClienteCreated={handleClienteCreated}
        title="Crear Nuevo Cliente"
      />


    </div>
  );
});

export default NuevoPedido;


import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  planService, 
  clienteService, 
  pedidoService, 
  configService 
} from '../services/firebaseService';
import { 
  formatDate, 
  formatCurrency, 
  calculatePickupDate, 
  calculateOrderTotal,
  getCurrentDateColombia,
  canUsePlan,
  getAvailablePlans
} from '../utils/dateUtils';
import { Plan, Cliente, Pedido, PaymentMethod, Descuento, Configuracion } from '../types';
import { MagnifyingGlassIcon, PlusIcon, MapPinIcon } from '@heroicons/react/24/outline';
import ModalCliente from '../components/ModalCliente';

interface NuevoPedidoProps {
  onClose?: () => void;
}

const NuevoPedido: React.FC<NuevoPedidoProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados del formulario
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState<Date>(getCurrentDateColombia());
  const [horasAdicionales, setHorasAdicionales] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>({
    type: 'efectivo',
    method: 'efectivo',
    amount: 0
  });
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [mostrarFormularioDescuento, setMostrarFormularioDescuento] = useState(false);
  const [nuevoDescuento, setNuevoDescuento] = useState({
    type: '',
    amount: 0
  });
  
  // Estados para búsqueda y datos
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (plan && fechaEntrega) {
      const fechaRecogida = calculatePickupDate(fechaEntrega, plan.id, horasAdicionales);
      const total = calculateOrderTotal(
        plan.price,
        horasAdicionales,
        configuracion?.horaAdicional || 2000,
        descuentos
      );
      setPaymentMethod(prev => ({ ...prev, amount: total }));
    }
  }, [plan, fechaEntrega, horasAdicionales, descuentos, configuracion]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [planesData, configData] = await Promise.all([
        planService.getActivePlans(),
        configService.getConfiguracion()
      ]);
      
      setPlanes(planesData);
      setConfiguracion(configData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const agregarDescuento = () => {
    if (!nuevoDescuento.type || !nuevoDescuento.amount) {
      alert('Todos los campos son obligatorios');
      return;
    }

    setDescuentos(prev => [...prev, {
      type: nuevoDescuento.type,
      amount: nuevoDescuento.amount,
      reason: '' // Razón vacía por defecto
    }]);
    
    setNuevoDescuento({ type: '', amount: 0 });
    setMostrarFormularioDescuento(false);
  };

  const eliminarDescuento = (index: number) => {
    setDescuentos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cliente || !plan || !user) {
      alert('Faltan datos obligatorios');
      return;
    }

    setSaving(true);
    try {
      // Calcular total incluyendo horas adicionales y descuentos
      let total = plan.price;
      
      // Agregar horas adicionales
      if (horasAdicionales > 0) {
        const precioHoraAdicional = configuracion?.horaAdicional || 2000;
        total += horasAdicionales * precioHoraAdicional;
      }
      
      // Restar descuentos
      const totalDescuentos = descuentos.reduce((sum, descuento) => sum + descuento.amount, 0);
      total = Math.max(0, total - totalDescuentos);

      const nuevoPedido: Omit<Pedido, 'id' | 'createdAt' | 'updatedAt'> = {
        clienteId: cliente.id,
        cliente,
        planId: plan.id,
        plan,
        status: 'pendiente', // Nuevo estado inicial
        fechaAsignacion: getCurrentDateColombia(),
        fechaEntrega, // Hora tentativa de entrega
        // No calculamos fechaRecogidaCalculada hasta que se entregue
        horasAdicionales,
        paymentMethod: { ...paymentMethod, amount: total },
        descuentos,
        total,
        observaciones,
        createdBy: user.id
      };

      await pedidoService.createPedido(nuevoPedido);
      
      // Limpiar formulario
      setCliente(null);
      setPlan(null);
      setFechaEntrega(getCurrentDateColombia());
      setHorasAdicionales(0);
      setDescuentos([]);
      setObservaciones('');
      setPaymentMethod({ type: 'efectivo', method: 'efectivo', amount: 0 });
      
      alert('Pedido creado exitosamente');
      
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

  const planesDisponibles = planes.filter(p => canUsePlan(p.id, fechaEntrega));

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
          
          <div className="flex gap-2">
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
                  className={`flex-1 px-2 py-2 border-2 rounded-lg text-center transition-all duration-200 shadow-sm hover:shadow-md ${
                    isSelected
                      ? `bg-gradient-to-br ${selectedColors[colorIndex]} shadow-md scale-105`
                      : `bg-gradient-to-br ${colors[colorIndex]} hover:shadow-md`
                  }`}
                >
                  <div className="font-semibold text-xs text-gray-900 mb-1">{p.name}</div>
                  <div className="text-xs text-gray-600 mb-1 leading-tight whitespace-normal break-words">{p.description}</div>
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

        {/* Fecha y Hora de Entrega */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Fecha y Hora de Entrega</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha
              </label>
              <input
                type="date"
                className="input-field"
                value={fechaEntrega.toISOString().split('T')[0]}
                onChange={(e) => setFechaEntrega(new Date(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora
              </label>
              <input
                type="time"
                className="input-field"
                value={fechaEntrega.toTimeString().slice(0, 5)}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':');
                  const newDate = new Date(fechaEntrega);
                  newDate.setHours(parseInt(hours), parseInt(minutes));
                  setFechaEntrega(newDate);
                }}
                required
              />
            </div>
          </div>
          
          {plan && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Recogida programada:</strong> {formatDate(calculatePickupDate(fechaEntrega, plan.id, horasAdicionales), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          )}
        </div>

        {/* Horas Adicionales */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Horas Adicionales</h3>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Cantidad:</label>
              <input
                type="number"
                min="0"
                className="input-field w-20"
                value={horasAdicionales}
                onChange={(e) => setHorasAdicionales(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            {horasAdicionales > 0 && (
              <div className="text-sm text-gray-600">
                × {formatCurrency(configuracion?.horaAdicional || 2000)} = 
                <span className="font-semibold text-primary-600 ml-1">
                  {formatCurrency(horasAdicionales * (configuracion?.horaAdicional || 2000))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Método de Pago */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Método de Pago</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Pago
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod(prev => ({ 
                    ...prev, 
                    type: 'efectivo',
                    method: 'efectivo'
                  }))}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    paymentMethod.type === 'efectivo'
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(prev => ({ 
                    ...prev, 
                    type: 'nequi',
                    method: 'deposito'
                  }))}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    paymentMethod.type === 'nequi'
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Nequi
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(prev => ({ 
                    ...prev, 
                    type: 'daviplata',
                    method: 'deposito'
                  }))}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    paymentMethod.type === 'daviplata'
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Daviplata
                </button>
              </div>
            </div>
            
            {paymentMethod.type !== 'efectivo' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(prev => ({ 
                      ...prev, 
                      method: 'deposito'
                    }))}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      paymentMethod.method === 'deposito'
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Depósito
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(prev => ({ 
                      ...prev, 
                      method: 'transferencia'
                    }))}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      paymentMethod.method === 'transferencia'
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Transferencia
                  </button>
                </div>
              </div>
            )}
            
            {paymentMethod.type !== 'efectivo' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Comprobante
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={paymentMethod.reference || ''}
                  onChange={(e) => setPaymentMethod(prev => ({ 
                    ...prev, 
                    reference: e.target.value 
                  }))}
                  placeholder="Número de comprobante"
                />
              </div>
            )}
          </div>
        </div>

        {/* Descuentos */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Descuentos</h3>
          
          {!mostrarFormularioDescuento ? (
            <button
              type="button"
              onClick={() => setMostrarFormularioDescuento(true)}
              className="btn-secondary mb-4"
            >
              Agregar Descuento
            </button>
          ) : (
            <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-3">Nuevo Descuento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Descuento
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={nuevoDescuento.type}
                    onChange={(e) => setNuevoDescuento(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="Ej: corte_agua, problema_tecnico"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field"
                    value={nuevoDescuento.amount}
                    onChange={(e) => setNuevoDescuento(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={agregarDescuento}
                  className="btn-primary"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormularioDescuento(false);
                    setNuevoDescuento({ type: '', amount: 0 });
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          
          {descuentos.length > 0 && (
            <div className="space-y-2">
              {descuentos.map((descuento, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{descuento.type}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-danger-600">
                      -{formatCurrency(descuento.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarDescuento(index)}
                      className="text-danger-600 hover:text-danger-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Resumen y Total */}
        {plan && (
          <div className="card bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen del Pedido</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan {plan.name}:</span>
                <span className="font-medium">{formatCurrency(plan.price)}</span>
              </div>
              
              {horasAdicionales > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Horas adicionales ({horasAdicionales}):</span>
                  <span className="font-medium">
                    {formatCurrency(horasAdicionales * (configuracion?.horaAdicional || 2000))}
                  </span>
                </div>
              )}
              
              {descuentos.map((descuento, index) => (
                <div key={index} className="flex justify-between text-danger-600">
                  <span>Descuento ({descuento.type}):</span>
                  <span className="font-medium">-{formatCurrency(descuento.amount)}</span>
                </div>
              ))}
              
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary-600">
                    {formatCurrency(paymentMethod.amount)}
                  </span>
                </div>
              </div>
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
            disabled={!cliente || !plan || saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Crear Pedido'}
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
};

export default NuevoPedido;


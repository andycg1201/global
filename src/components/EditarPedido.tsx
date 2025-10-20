import React, { useState, useEffect } from 'react';
import { Pedido } from '../types';
import { planService, clienteService, pedidoService, configService } from '../services/firebaseService';
import { formatCurrency } from '../utils/dateUtils';

interface EditarPedidoProps {
  pedido: Pedido;
  onClose: () => void;
  onSave: (pedido: Pedido) => void;
}

const EditarPedido: React.FC<EditarPedidoProps> = ({ pedido, onClose, onSave }) => {
  
  const [formData, setFormData] = useState({
    cliente: pedido.cliente,
    plan: pedido.plan,
    horasAdicionales: pedido.horasAdicionales || 0,
    paymentMethod: pedido.paymentMethod,
    descuentos: pedido.descuentos || [],
    observaciones: pedido.observaciones || '',
    status: pedido.status
  });

  const [planesDisponibles, setPlanesDisponibles] = useState<any[]>([]);
  const [clientesDisponibles, setClientesDisponibles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [mostrarFormularioDescuento, setMostrarFormularioDescuento] = useState(false);
  const [nuevoDescuento, setNuevoDescuento] = useState({
    type: '',
    amount: 0
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargandoDatos(true);
      const [planes, clientes] = await Promise.all([
        planService.getActivePlans(),
        clienteService.searchClientes('') // Buscar todos los clientes
      ]);
      setPlanesDisponibles(planes);
      setClientesDisponibles(clientes);
      
      // Asegurar que el cliente y plan seleccionados estén en las listas
      if (pedido.cliente && !clientes.find(c => c.id === pedido.cliente.id)) {
        setClientesDisponibles(prev => [...prev, pedido.cliente]);
      }
      if (pedido.plan && !planes.find(p => p.id === pedido.plan.id)) {
        setPlanesDisponibles(prev => [...prev, pedido.plan]);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setCargandoDatos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Calcular total
      let total = formData.plan.price;
      
      // Agregar horas adicionales
      if (formData.horasAdicionales > 0) {
        const config = await configService.getConfiguracion();
        const precioHoraAdicional = config?.horaAdicional || 5000;
        total += formData.horasAdicionales * precioHoraAdicional;
      }
      
      // Restar descuentos
      const totalDescuentos = formData.descuentos.reduce((sum, descuento) => sum + descuento.amount, 0);
      total -= totalDescuentos;

      const pedidoActualizado: Pedido = {
        ...pedido,
        cliente: formData.cliente,
        plan: formData.plan,
        horasAdicionales: formData.horasAdicionales,
        paymentMethod: formData.paymentMethod,
        descuentos: formData.descuentos,
        observaciones: formData.observaciones,
        status: formData.status,
        total: Math.max(0, total) // Asegurar que el total no sea negativo
      };

      await pedidoService.updatePedido(pedidoActualizado.id, pedidoActualizado);
      onSave(pedidoActualizado);
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
      alert('Error al actualizar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const agregarDescuento = () => {
    if (!nuevoDescuento.type || !nuevoDescuento.amount) {
      alert('Todos los campos son obligatorios');
      return;
    }
    setFormData(prev => ({
      ...prev,
      descuentos: [...prev.descuentos, {
        type: nuevoDescuento.type,
        amount: nuevoDescuento.amount,
        reason: ''
      }]
    }));
    setNuevoDescuento({ type: '', amount: 0 });
    setMostrarFormularioDescuento(false);
  };

  const eliminarDescuento = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descuentos: prev.descuentos.filter((_, i) => i !== index)
    }));
  };

  if (cargandoDatos) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información del Cliente */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cliente</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          <select
            className="input-field"
            value={formData.cliente.id}
            onChange={(e) => {
              const cliente = clientesDisponibles.find(c => c.id === e.target.value);
              if (cliente) {
                setFormData(prev => ({ ...prev, cliente }));
              }
            }}
          >
            {clientesDisponibles.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.name} - {cliente.phone}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Dirección: {formData.cliente.address}
          </p>
        </div>
      </div>

      {/* Selección de Plan */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Plan</h3>
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
            const isSelected = formData.plan?.id === p.id;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, plan: p }))}
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
      </div>

      {/* Horas Adicionales */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Horas Adicionales</h3>
        <div className="max-w-xs">
          <input
            type="number"
            min="0"
            className="input-field w-20"
            value={formData.horasAdicionales}
            onChange={(e) => setFormData(prev => ({ ...prev, horasAdicionales: parseInt(e.target.value) || 0 }))}
          />
        </div>
      </div>

      {/* Método de Pago */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Método de Pago</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Pago</label>
            <div className="flex gap-2">
              {['efectivo', 'nequi', 'daviplata'].map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    paymentMethod: { ...prev.paymentMethod, type: tipo as 'efectivo' | 'nequi' | 'daviplata' }
                  }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    formData.paymentMethod.type === tipo
                      ? tipo === 'efectivo' 
                        ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                        : 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {tipo === 'efectivo' ? 'Efectivo' : tipo === 'nequi' ? 'Nequi' : 'Daviplata'}
                </button>
              ))}
            </div>
          </div>
          
          {formData.paymentMethod.type !== 'efectivo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Método</label>
              <div className="flex gap-2">
                {['deposito', 'transferencia'].map((metodo) => (
                  <button
                    key={metodo}
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      paymentMethod: { ...prev.paymentMethod, method: metodo as 'deposito' | 'transferencia' }
                    }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      formData.paymentMethod.method === metodo
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {metodo === 'deposito' ? 'Depósito' : 'Transferencia'}
                  </button>
                ))}
              </div>
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
        {formData.descuentos.length > 0 && (
          <div className="space-y-2">
            {formData.descuentos.map((descuento, index) => (
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

      {/* Estado del Pedido */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Estado del Pedido</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Estado actual</label>
          <select
            className="input-field"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'pendiente' | 'entregado' | 'recogido' | 'cancelado' }))}
          >
            <option value="pendiente">Pendiente</option>
            <option value="entregado">Entregado</option>
            <option value="recogido">Recogido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Observaciones */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Observaciones</h3>
        <textarea
          className="input-field"
          rows={3}
          value={formData.observaciones}
          onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
          placeholder="Observaciones adicionales..."
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
};

export default EditarPedido;

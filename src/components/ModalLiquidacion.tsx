import React, { useState } from 'react';
import { XMarkIcon, CalculatorIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Pedido, PaymentMethod, Descuento, Reembolso } from '../types';
import { formatCurrency, formatDate } from '../utils/dateUtils';

interface ModalLiquidacionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (liquidacion: {
    descuentos: Descuento[];
    reembolsos: Reembolso[];
    horasAdicionales: number;
    paymentMethod?: PaymentMethod;
    observacionesPago?: string;
  }) => void;
  pedido: Pedido;
  precioHoraAdicional: number;
}

const ModalLiquidacion: React.FC<ModalLiquidacionProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
  precioHoraAdicional
}) => {
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([]);
  const [horasAdicionales, setHorasAdicionales] = useState(pedido.horasAdicionales);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>({
    type: 'efectivo',
    method: 'efectivo',
    amount: 0
  });
  const [observacionesPago, setObservacionesPago] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para formularios
  const [mostrarFormularioDescuento, setMostrarFormularioDescuento] = useState(false);
  const [mostrarFormularioReembolso, setMostrarFormularioReembolso] = useState(false);
  const [nuevoDescuento, setNuevoDescuento] = useState({
    type: '',
    amount: 0,
    reason: ''
  });
  const [nuevoReembolso, setNuevoReembolso] = useState({
    monto: 0,
    motivo: '',
    metodo: 'efectivo' as 'efectivo' | 'nequi' | 'daviplata',
    referencia: ''
  });

  // Calcular totales
  const subtotal = pedido.plan.price;
  const totalHorasAdicionales = horasAdicionales * precioHoraAdicional;
  const totalCobrosAdicionales = pedido.cobrosAdicionales.reduce((sum, cobro) => sum + cobro.monto, 0);
  const totalDescuentos = descuentos.reduce((sum, descuento) => sum + descuento.amount, 0);
  const totalReembolsos = reembolsos.reduce((sum, reembolso) => sum + reembolso.monto, 0);
  const total = subtotal + totalHorasAdicionales + totalCobrosAdicionales - totalDescuentos - totalReembolsos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const liquidacion = {
        descuentos,
        reembolsos,
        horasAdicionales,
        paymentMethod: pedido.estadoPago === 'pagado_anticipado' || pedido.estadoPago === 'pagado_entrega' ? undefined : paymentMethod,
        observacionesPago
      };
      
      console.log('ModalLiquidacion: Enviando datos de liquidación:', liquidacion);
      console.log('ModalLiquidacion: Estado de pago del pedido:', pedido.estadoPago);
      
      await onConfirm(liquidacion);
      onClose();
    } catch (error) {
      console.error('Error al procesar liquidación:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDescuentos([]);
    setReembolsos([]);
    setHorasAdicionales(pedido.horasAdicionales);
    setPaymentMethod({
      type: 'efectivo',
      method: 'efectivo',
      amount: 0
    });
    setObservacionesPago('');
    setMostrarFormularioDescuento(false);
    setMostrarFormularioReembolso(false);
    setNuevoDescuento({ type: '', amount: 0, reason: '' });
    setNuevoReembolso({ monto: 0, motivo: '', metodo: 'efectivo', referencia: '' });
    onClose();
  };

  const agregarDescuento = () => {
    if (!nuevoDescuento.type || !nuevoDescuento.amount) {
      alert('Todos los campos son obligatorios');
      return;
    }

    setDescuentos(prev => [...prev, {
      type: nuevoDescuento.type,
      amount: nuevoDescuento.amount,
      reason: nuevoDescuento.reason
    }]);
    
    setNuevoDescuento({ type: '', amount: 0, reason: '' });
    setMostrarFormularioDescuento(false);
  };

  const eliminarDescuento = (index: number) => {
    setDescuentos(prev => prev.filter((_, i) => i !== index));
  };

  const agregarReembolso = () => {
    if (!nuevoReembolso.monto || !nuevoReembolso.motivo) {
      alert('Monto y motivo son obligatorios');
      return;
    }

    setReembolsos(prev => [...prev, {
      monto: nuevoReembolso.monto,
      motivo: nuevoReembolso.motivo,
      fecha: new Date(),
      metodo: nuevoReembolso.metodo,
      referencia: nuevoReembolso.referencia
    }]);
    
    setNuevoReembolso({ monto: 0, motivo: '', metodo: 'efectivo', referencia: '' });
    setMostrarFormularioReembolso(false);
  };

  const eliminarReembolso = (index: number) => {
    setReembolsos(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <CalculatorIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Liquidación - Recogida
              </h3>
              <p className="text-sm text-gray-500">
                {pedido.cliente.name} - {pedido.plan.name}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Información del pedido */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Información del pedido:
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Cliente:</span> {pedido.cliente.name}
              </div>
              <div>
                <span className="font-medium">Plan:</span> {pedido.plan.name}
              </div>
              <div>
                <span className="font-medium">Lavadora:</span> {pedido.lavadoraAsignada?.codigoQR || 'No asignada'}
              </div>
              <div>
                <span className="font-medium">Fecha recogida:</span> {formatDate(new Date(), 'dd/MM/yyyy HH:mm')}
              </div>
            </div>
          </div>

          {/* Estado de pago */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-800">
                Estado de pago: {pedido.estadoPago === 'pagado_anticipado' ? 'Pagado anticipado' : 
                                pedido.estadoPago === 'pagado_entrega' ? 'Pagado en entrega' : 'Pendiente de pago'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Ajustar Horas Adicionales */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ajustar Horas Adicionales
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <label className="text-sm text-gray-700">Cantidad:</label>
                  <input
                    type="number"
                    min="0"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    value={horasAdicionales}
                    onChange={(e) => setHorasAdicionales(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                {horasAdicionales > 0 && (
                  <div className="text-sm text-gray-600">
                    × {formatCurrency(precioHoraAdicional)} = 
                    <span className="font-semibold text-primary-600 ml-1">
                      {formatCurrency(horasAdicionales * precioHoraAdicional)}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Horas originales: {pedido.horasAdicionales} | Nuevas: {horasAdicionales}
              </p>
            </div>

            {/* Descuentos */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Descuentos
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarFormularioDescuento(true)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Formulario de nuevo descuento */}
              {mostrarFormularioDescuento && (
                <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h5 className="font-medium text-gray-900 mb-3">Nuevo Descuento</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tipo de Descuento
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoDescuento.type}
                        onChange={(e) => setNuevoDescuento(prev => ({ ...prev, type: e.target.value }))}
                        placeholder="Ej: corte_agua, problema_tecnico"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Monto
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoDescuento.amount}
                        onChange={(e) => setNuevoDescuento(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Razón
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoDescuento.reason}
                        onChange={(e) => setNuevoDescuento(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Descripción del descuento"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={agregarDescuento}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormularioDescuento(false);
                        setNuevoDescuento({ type: '', amount: 0, reason: '' });
                      }}
                      className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de descuentos */}
              {descuentos.length > 0 && (
                <div className="space-y-2">
                  {descuentos.map((descuento, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{descuento.type}</div>
                        <div className="text-xs text-gray-500">{descuento.reason}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-red-600">
                          -{formatCurrency(descuento.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarDescuento(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reembolsos */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Reembolsos
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarFormularioReembolso(true)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-green-600 hover:text-green-700 border border-green-300 rounded-md hover:bg-green-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Formulario de nuevo reembolso */}
              {mostrarFormularioReembolso && (
                <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h5 className="font-medium text-gray-900 mb-3">Nuevo Reembolso</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Monto
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoReembolso.monto}
                        onChange={(e) => setNuevoReembolso(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Método
                      </label>
                      <select
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoReembolso.metodo}
                        onChange={(e) => setNuevoReembolso(prev => ({ ...prev, metodo: e.target.value as 'efectivo' | 'nequi' | 'daviplata' }))}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="nequi">Nequi</option>
                        <option value="daviplata">Daviplata</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Motivo
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoReembolso.motivo}
                        onChange={(e) => setNuevoReembolso(prev => ({ ...prev, motivo: e.target.value }))}
                        placeholder="Motivo del reembolso"
                      />
                    </div>
                    {nuevoReembolso.metodo !== 'efectivo' && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Referencia
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          value={nuevoReembolso.referencia}
                          onChange={(e) => setNuevoReembolso(prev => ({ ...prev, referencia: e.target.value }))}
                          placeholder="Número de comprobante"
                        />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={agregarReembolso}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormularioReembolso(false);
                        setNuevoReembolso({ monto: 0, motivo: '', metodo: 'efectivo', referencia: '' });
                      }}
                      className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de reembolsos */}
              {reembolsos.length > 0 && (
                <div className="space-y-2">
                  {reembolsos.map((reembolso, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{reembolso.motivo}</div>
                        <div className="text-xs text-gray-500">{reembolso.metodo} - {formatDate(reembolso.fecha, 'dd/MM/yyyy HH:mm')}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-green-600">
                          -{formatCurrency(reembolso.monto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarReembolso(index)}
                          className="text-green-600 hover:text-green-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Método de pago (solo si no ha pagado) */}
            {(pedido.estadoPago !== 'pagado_anticipado' && pedido.estadoPago !== 'pagado_entrega') && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(prev => ({ 
                      ...prev, 
                      type: 'efectivo',
                      method: 'efectivo',
                      amount: total
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
                      method: 'deposito',
                      amount: total
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
                      method: 'deposito',
                      amount: total
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

                {/* Número de comprobante para transferencias */}
                {paymentMethod.type !== 'efectivo' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Comprobante
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={paymentMethod.reference || ''}
                      onChange={(e) => setPaymentMethod(prev => ({ 
                        ...prev, 
                        reference: e.target.value 
                      }))}
                      placeholder="Número de comprobante"
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Observaciones de pago */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones de Liquidación
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales sobre la liquidación..."
              />
            </div>

            {/* Resumen de liquidación */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Resumen de Liquidación</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan {pedido.plan.name}:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                
                {horasAdicionales > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Horas adicionales ({horasAdicionales}):</span>
                    <span className="font-medium">{formatCurrency(totalHorasAdicionales)}</span>
                  </div>
                )}
                
                {pedido.cobrosAdicionales.map((cobro, index) => (
                  <div key={index} className="flex justify-between text-primary-600">
                    <span>{cobro.concepto}:</span>
                    <span className="font-medium">{formatCurrency(cobro.monto)}</span>
                  </div>
                ))}
                
                {descuentos.map((descuento, index) => (
                  <div key={index} className="flex justify-between text-red-600">
                    <span>Descuento ({descuento.type}):</span>
                    <span className="font-medium">-{formatCurrency(descuento.amount)}</span>
                  </div>
                ))}
                
                {reembolsos.map((reembolso, index) => (
                  <div key={index} className="flex justify-between text-green-600">
                    <span>Reembolso ({reembolso.motivo}):</span>
                    <span className="font-medium">-{formatCurrency(reembolso.monto)}</span>
                  </div>
                ))}
                
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total a {pedido.estadoPago === 'pagado_anticipado' || pedido.estadoPago === 'pagado_entrega' ? 'Reembolsar' : 'Pagar'}:</span>
                    <span className={total < 0 ? 'text-green-600' : 'text-primary-600'}>
                      {total < 0 ? `-${formatCurrency(Math.abs(total))}` : formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Liquidar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalLiquidacion;

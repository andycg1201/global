import React, { useState } from 'react';
import { XMarkIcon, ReceiptPercentIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Pedido, PaymentMethod, CobroAdicional } from '../types';
import { formatCurrency, formatDate } from '../utils/dateUtils';

interface ModalFacturacionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (facturacion: {
    cobrosAdicionales: CobroAdicional[];
    horasAdicionales: number;
    observacionesPago?: string;
  }) => void;
  pedido: Pedido;
  precioHoraAdicional: number;
}

const ModalFacturacion: React.FC<ModalFacturacionProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
  precioHoraAdicional
}) => {
  const [cobrosAdicionales, setCobrosAdicionales] = useState<CobroAdicional[]>([]);
  const [horasAdicionales, setHorasAdicionales] = useState<string>('0');
  const [observacionesPago, setObservacionesPago] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarFormularioCobro, setMostrarFormularioCobro] = useState(false);
  const [nuevoCobro, setNuevoCobro] = useState({
    concepto: '',
    monto: '',
    descripcion: ''
  });

  // Calcular totales
  const subtotal = pedido.plan.price;
  const horasAdicionalesNum = parseInt(horasAdicionales) || 0;
  const totalHorasAdicionales = horasAdicionalesNum * precioHoraAdicional;
  const totalCobrosAdicionales = cobrosAdicionales.reduce((sum, cobro) => sum + cobro.monto, 0);
  const total = subtotal + totalHorasAdicionales + totalCobrosAdicionales;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const facturacion = {
        cobrosAdicionales,
        horasAdicionales: horasAdicionalesNum,
        observacionesPago
      };
      
      console.log('ModalFacturacion: Enviando datos de facturación:', facturacion);
      console.log('ModalFacturacion: Estado de pago del pedido:', pedido.estadoPago);
      
      await onConfirm(facturacion);
      onClose();
    } catch (error) {
      console.error('Error al procesar facturación:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCobrosAdicionales([]);
    setHorasAdicionales('0');
    setObservacionesPago('');
    setMostrarFormularioCobro(false);
    setNuevoCobro({ concepto: '', monto: '', descripcion: '' });
    onClose();
  };

  const agregarCobroAdicional = () => {
    const montoNumerico = parseFloat(nuevoCobro.monto) || 0;
    if (!nuevoCobro.concepto || montoNumerico <= 0) {
      alert('Todos los campos son obligatorios y el monto debe ser mayor a 0');
      return;
    }

    setCobrosAdicionales(prev => [...prev, {
      concepto: nuevoCobro.concepto,
      monto: montoNumerico,
      descripcion: nuevoCobro.descripcion
    }]);
    
    setNuevoCobro({ concepto: '', monto: '', descripcion: '' });
    setMostrarFormularioCobro(false);
  };

  const eliminarCobroAdicional = (index: number) => {
    setCobrosAdicionales(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) {
    console.log('ModalFacturacion: isOpen es false, no renderizando');
    return null;
  }
  
  console.log('ModalFacturacion: Renderizando modal con pedido:', pedido.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <ReceiptPercentIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Facturación - Entrega
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
                <span className="font-medium">Fecha entrega:</span> {pedido.fechaEntrega ? formatDate(pedido.fechaEntrega, 'dd/MM/yyyy HH:mm') : 'No entregado'}
              </div>
            </div>
          </div>

          {/* Estado de pago */}
          {pedido.estadoPago === 'pagado_anticipado' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800">
                  Pago anticipado realizado: {formatCurrency(pedido.pagoAnticipado?.monto || 0)}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Horas Adicionales */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Horas Adicionales
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <label className="text-sm text-gray-700">Cantidad:</label>
                  <input
                    type="number"
                    min="0"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    value={horasAdicionales}
                    onChange={(e) => setHorasAdicionales(e.target.value)}
                    placeholder="0"
                  />
                </div>
                {horasAdicionalesNum > 0 && (
                  <div className="text-sm text-gray-600">
                    × {formatCurrency(precioHoraAdicional)} = 
                    <span className="font-semibold text-primary-600 ml-1">
                      {formatCurrency(horasAdicionalesNum * precioHoraAdicional)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cobros Adicionales */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Cobros Adicionales
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarFormularioCobro(true)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-primary-600 hover:text-primary-700 border border-primary-300 rounded-md hover:bg-primary-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Formulario de nuevo cobro */}
              {mostrarFormularioCobro && (
                <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h5 className="font-medium text-gray-900 mb-3">Nuevo Cobro Adicional</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Concepto
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoCobro.concepto}
                        onChange={(e) => setNuevoCobro(prev => ({ ...prev, concepto: e.target.value }))}
                        placeholder="Ej: zona alejada"
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
                        value={nuevoCobro.monto}
                        onChange={(e) => setNuevoCobro(prev => ({ ...prev, monto: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={nuevoCobro.descripcion}
                        onChange={(e) => setNuevoCobro(prev => ({ ...prev, descripcion: e.target.value }))}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={agregarCobroAdicional}
                      className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormularioCobro(false);
                        setNuevoCobro({ concepto: '', monto: '', descripcion: '' });
                      }}
                      className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de cobros adicionales */}
              {cobrosAdicionales.length > 0 && (
                <div className="space-y-2">
                  {cobrosAdicionales.map((cobro, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{cobro.concepto}</div>
                        {cobro.descripcion && (
                          <div className="text-xs text-gray-500">{cobro.descripcion}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-primary-600">
                          {formatCurrency(cobro.monto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarCobroAdicional(index)}
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

            {/* Método de pago (solo si no pagó anticipado) */}

            {/* Observaciones de pago */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones de Pago
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales sobre el pago..."
              />
            </div>

            {/* Resumen de totales */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Resumen de Facturación</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan {pedido.plan.name}:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                
                {horasAdicionalesNum > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Horas adicionales ({horasAdicionales}):</span>
                    <span className="font-medium">{formatCurrency(totalHorasAdicionales)}</span>
                  </div>
                )}
                
                {cobrosAdicionales.map((cobro, index) => (
                  <div key={index} className="flex justify-between text-primary-600">
                    <span>{cobro.concepto}:</span>
                    <span className="font-medium">{formatCurrency(cobro.monto)}</span>
                  </div>
                ))}
                
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary-600">{formatCurrency(total)}</span>
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
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Facturar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalFacturacion;

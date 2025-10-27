import React, { useState } from 'react';
import { XMarkIcon, CurrencyDollarIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { formatCurrency, formatDate } from '../utils/dateUtils';

interface ModalLiquidacionUniversalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: {
    amount: number;
    medioPago: 'efectivo' | 'nequi' | 'daviplata';
    reference?: string;
    isPartial: boolean;
  }) => void;
  pedido: Pedido;
}

const ModalLiquidacionUniversal: React.FC<ModalLiquidacionUniversalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido
}) => {
  const [montoAbono, setMontoAbono] = useState('');
  const [medioPago, setMedioPago] = useState<'efectivo' | 'nequi' | 'daviplata'>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  if (!isOpen) return null;

  // Calcular saldo pendiente directamente
  const saldoPendiente = (pedido.total || 0) - (pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0);
  const montoNumerico = parseFloat(montoAbono) || 0;
  const esAbonoParcial = montoNumerico < saldoPendiente;
  const saldoRestante = saldoPendiente - montoNumerico;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica del pago
    if (montoNumerico <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }
    
    if (montoNumerico > saldoPendiente) {
      alert('El monto no puede ser mayor al saldo pendiente');
      return;
    }
    
    onConfirm({
      amount: montoNumerico,
      medioPago,
      reference: referencia.trim() || undefined,
      isPartial: esAbonoParcial
    });

    // Reset form
    setMontoAbono('');
    setReferencia('');
    setMedioPago('efectivo');
    setMostrarFormulario(false);
  };

  const handleClose = () => {
    setMontoAbono('');
    setReferencia('');
    setMedioPago('efectivo');
    setMostrarFormulario(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Liquidación de Servicio
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del servicio */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Servicio #{pedido.id.slice(-6)}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-800"><strong>Cliente:</strong> {pedido.cliente.name}</p>
                <p className="text-blue-800"><strong>Plan:</strong> {pedido.plan.name}</p>
              </div>
              <div>
                <p className="text-blue-800"><strong>Estado:</strong> {pedido.status}</p>
                <p className="text-blue-800"><strong>Fecha:</strong> {formatDate(pedido.createdAt, 'dd/MM/yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Saldo pendiente */}
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-medium text-red-800">Saldo Pendiente</h4>
                <p className="text-sm text-red-600">Monto total a liquidar</p>
                <p className="text-xs text-red-500 mt-1">
                  Plan: {formatCurrency(pedido.subtotal || 0)} + Modificaciones: {formatCurrency(pedido.resumenModificaciones?.montoTotalModificaciones || 0)} - Pagado: {formatCurrency(pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0)} = {formatCurrency(saldoPendiente)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-900">
                  {formatCurrency(saldoPendiente)}
                </p>
              </div>
            </div>
          </div>

          {/* Modificaciones dinámicas */}
          {pedido.resumenModificaciones && pedido.resumenModificaciones.modificaciones.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                <DocumentTextIcon className="h-5 w-5 text-gray-600 mr-2" />
                Modificaciones al Servicio
              </h3>
              <div className="space-y-2">
                {pedido.resumenModificaciones.modificaciones.map((modificacion) => (
                  <div key={modificacion.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{modificacion.concepto}</span>
                      {modificacion.descripcion && (
                        <p className="text-gray-500 text-xs">{modificacion.descripcion}</p>
                      )}
                    </div>
                    <span className={`font-medium ${
                      modificacion.monto > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {modificacion.monto > 0 ? '+' : ''}{formatCurrency(modificacion.monto)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-gray-700">Total modificaciones:</span>
                    <span className={`${
                      pedido.resumenModificaciones.montoTotalModificaciones > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {pedido.resumenModificaciones.montoTotalModificaciones > 0 ? '+' : ''}
                      {formatCurrency(pedido.resumenModificaciones.montoTotalModificaciones)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historial de pagos (si existe) */}
          {pedido.pagosRealizados && pedido.pagosRealizados.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Historial de Pagos</h4>
              <div className="space-y-2">
                {pedido.pagosRealizados.map((pago, index) => {
                  // Manejar correctamente los timestamps de Firebase
                  let fechaPago: Date;
                  let fechaValida: boolean;
                  
                  if (pago.fecha instanceof Date) {
                    // Ya es un objeto Date
                    fechaPago = pago.fecha;
                    fechaValida = !isNaN(fechaPago.getTime());
                  } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
                    // Es un Timestamp de Firebase
                    fechaPago = (pago.fecha as any).toDate();
                    fechaValida = !isNaN(fechaPago.getTime());
                  } else {
                    // Intentar convertir string o número
                    fechaPago = new Date(pago.fecha);
                    fechaValida = !isNaN(fechaPago.getTime());
                  }
                  
                  // Debug: Log de la fecha para identificar problemas
                  if (!fechaValida) {
                    console.error('🚨 Fecha inválida en pago:', {
                      pagoIndex: index,
                      fechaOriginal: pago.fecha,
                      tipoFecha: typeof pago.fecha,
                      esTimestamp: pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha,
                      fechaConvertida: fechaPago
                    });
                  }
                  
                  return (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600">
                          {fechaValida ? formatDate(fechaPago, 'dd/MM/yyyy HH:mm') : 'Fecha inválida'}
                        </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        pago.medioPago === 'efectivo' ? 'bg-green-100 text-green-800' :
                        pago.medioPago === 'nequi' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {pago.medioPago === 'efectivo' ? '💵 Efectivo' :
                         pago.medioPago === 'nequi' ? '📱 Nequi' :
                         '📱 Daviplata'}
                      </span>
                    </div>
                    <span className="font-medium text-green-600">
                      {formatCurrency(pago.monto)}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botón para abrir formulario */}
          {!mostrarFormulario && (
            <div className="text-center">
              <button
                onClick={() => setMostrarFormulario(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Realizar Abono
              </button>
            </div>
          )}

          {/* Formulario de pago */}
          {mostrarFormulario && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto del Abono *
                </label>
                <input
                  type="number"
                  min="0"
                  max={saldoPendiente}
                  step="100"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Máximo: ${formatCurrency(saldoPendiente)}`}
                  required
                />
                {montoAbono && (
                  <div className="mt-2 text-sm">
                    {esAbonoParcial ? (
                      <p className="text-orange-600">
                        Abono parcial - Saldo restante: {formatCurrency(saldoRestante)}
                      </p>
                    ) : (
                      <p className="text-green-600">
                        Pago completo - Saldo se liquidará totalmente
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medio de Pago *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMedioPago('efectivo')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      medioPago === 'efectivo'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMedioPago('nequi')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      medioPago === 'nequi'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📱 Nequi
                  </button>
                  <button
                    type="button"
                    onClick={() => setMedioPago('daviplata')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      medioPago === 'daviplata'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📱 Daviplata
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia/Comprobante (Opcional)
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número de comprobante, referencia, etc."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {esAbonoParcial ? 'Registrar Abono' : 'Liquidar Completamente'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalLiquidacionUniversal;

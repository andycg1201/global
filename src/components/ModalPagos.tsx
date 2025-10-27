import React, { useState, useEffect } from 'react';
import { XMarkIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { formatCurrency } from '../utils/dateUtils';

interface ModalPagosProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido | null;
  onPagoRealizado: () => void;
}

const ModalPagos: React.FC<ModalPagosProps> = ({
  isOpen,
  onClose,
  pedido,
  onPagoRealizado
}) => {
  const [montoPago, setMontoPago] = useState<number | undefined>(undefined);
  const [medioPago, setMedioPago] = useState<'efectivo' | 'nequi' | 'daviplata'>('efectivo');
  const [observaciones, setObservaciones] = useState<string>('');

  // Calcular saldo pendiente
  const saldoPendiente = pedido ? (pedido.total || 0) - (pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0) : 0;

  // Resetear formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen && pedido) {
      setMontoPago(undefined); // Campo vacío por defecto
      setMedioPago('efectivo');
      setObservaciones('');
    }
  }, [isOpen, pedido]);

  const handleClose = () => {
    setMontoPago(undefined);
    setMedioPago('efectivo');
    setObservaciones('');
    onClose();
  };

  const handleConfirmar = async () => {
    const montoFinal = montoPago || 0;
    if (!pedido || montoFinal <= 0 || montoFinal > saldoPendiente) {
      alert('Monto inválido');
      return;
    }

    if (!medioPago) {
      alert('Selecciona un medio de pago');
      return;
    }

    try {
      // Importar servicios necesarios
      const { pedidoService } = await import('../services/firebaseService');
      const { capitalService } = await import('../services/capitalService');

      // Crear el pago
      const nuevoPago = {
        monto: montoFinal,
        medioPago: medioPago,
        fecha: new Date(),
        isPartial: montoFinal < saldoPendiente
      };

      console.log('🔍 ModalPagos - Nuevo pago creado:', nuevoPago);
      console.log('🔍 ModalPagos - Medio de pago seleccionado:', medioPago);

      // Actualizar el pedido con el nuevo pago
      const pagosActualizados = [...(pedido.pagosRealizados || []), nuevoPago];
      console.log('🔍 ModalPagos - Pagos actualizados:', pagosActualizados);
      console.log('🔍 ModalPagos - Verificando medioPago en pagos actualizados:', pagosActualizados.map(p => ({
        monto: p.monto,
        medioPago: p.medioPago,
        tipoMedioPago: typeof p.medioPago
      })));
      
      await pedidoService.updatePedido(pedido.id, {
        pagosRealizados: pagosActualizados
      });

      // NO crear movimiento de capital para pagos de servicios
      // Los pagos se procesan automáticamente desde pedido.pagosRealizados
      console.log('✅ Pago registrado en pedido - NO se crea movimiento de capital separado');

      console.log('✅ Pago registrado exitosamente:', nuevoPago);
      alert(`Pago de ${formatCurrency(montoFinal)} registrado exitosamente`);
      
      onPagoRealizado();
      handleClose();
    } catch (error) {
      console.error('Error al registrar pago:', error);
      alert('Error al registrar el pago: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  if (!isOpen || !pedido) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Registrar Pago</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Información del servicio */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="font-medium">{pedido.cliente.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Total servicio:</span>
                <span className="font-medium">{formatCurrency(pedido.total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pagado:</span>
                <span className="font-medium">{formatCurrency(pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-600">
                <span>Saldo pendiente:</span>
                <span>{formatCurrency(saldoPendiente)}</span>
              </div>
            </div>
          </div>

          {/* Monto del pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto a pagar
            </label>
            <input
              type="number"
              min="0"
              max={saldoPendiente}
              step="100"
              value={montoPago || ''}
              onChange={(e) => {
                const value = e.target.value;
                const cantidad = value === '' ? undefined : parseFloat(value) || 0;
                setMontoPago(cantidad);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo: {formatCurrency(saldoPendiente)}
            </p>
          </div>

          {/* Medio de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medio de pago
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMedioPago('efectivo')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  medioPago === 'efectivo'
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                💵 Efectivo
              </button>
              <button
                type="button"
                onClick={() => setMedioPago('nequi')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  medioPago === 'nequi'
                    ? 'bg-purple-100 border-purple-500 text-purple-700'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                📱 Nequi
              </button>
              <button
                type="button"
                onClick={() => setMedioPago('daviplata')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  medioPago === 'daviplata'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                💳 Daviplata
              </button>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              placeholder="Observaciones del pago (opcional)"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={(montoPago || 0) <= 0 || (montoPago || 0) > saldoPendiente || !medioPago}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Registrar Pago
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalPagos;

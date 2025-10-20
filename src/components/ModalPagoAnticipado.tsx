import React, { useState } from 'react';
import { XMarkIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { PaymentMethod, PagoAnticipado } from '../types';
import { formatCurrency } from '../utils/dateUtils';

interface ModalPagoAnticipadoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pagoAnticipado: PagoAnticipado) => void;
  montoTotal: number;
  clienteInfo: {
    name: string;
    plan: string;
  };
}

const ModalPagoAnticipado: React.FC<ModalPagoAnticipadoProps> = ({
  isOpen,
  onClose,
  onConfirm,
  montoTotal,
  clienteInfo
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>({
    type: 'efectivo',
    method: 'efectivo',
    amount: montoTotal
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const pagoAnticipado: PagoAnticipado = {
        monto: montoTotal,
        metodo: paymentMethod,
        fecha: new Date(),
        referencia: paymentMethod.reference
      };
      
      await onConfirm(pagoAnticipado);
      onClose();
    } catch (error) {
      console.error('Error al procesar pago anticipado:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentMethod({
      type: 'efectivo',
      method: 'efectivo',
      amount: montoTotal
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CreditCardIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Pago Anticipado
              </h3>
              <p className="text-sm text-gray-500">
                Cliente: {clienteInfo.name}
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
          {/* Pedido Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Resumen del pedido:
            </h4>
            <div className="space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Plan:</span> {clienteInfo.plan}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Total a pagar:</span> 
                <span className="font-bold text-green-600 ml-1">
                  {formatCurrency(montoTotal)}
                </span>
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Tipo de Pago */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
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

            {/* Método específico para transferencias */}
            {paymentMethod.type !== 'efectivo' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Transacción
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

            {/* Número de comprobante */}
            {paymentMethod.type !== 'efectivo' && (
              <div className="mb-6">
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
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Procesando...' : `Confirmar Pago ${formatCurrency(montoTotal)}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalPagoAnticipado;

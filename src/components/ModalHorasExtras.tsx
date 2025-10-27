import React, { useState } from 'react';
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/dateUtils';

interface ModalHorasExtrasProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    cantidad: number;
    precioUnitario: number;
    monto: number;
    concepto: string;
    motivo?: string;
  }) => void;
  pedido: {
    id: string;
    cliente: {
      name: string;
    };
    plan: {
      name: string;
    };
  };
  precioHoraAdicional: number;
}

const ModalHorasExtras: React.FC<ModalHorasExtrasProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
  precioHoraAdicional
}) => {
  const [cantidad, setCantidad] = useState<string>('1');
  const [motivo, setMotivo] = useState<string>('');

  if (!isOpen) return null;

  const cantidadNumerica = parseInt(cantidad) || 0;
  const monto = cantidadNumerica * precioHoraAdicional;

  const handleConfirmar = () => {
    if (cantidadNumerica <= 0) {
      alert('La cantidad de horas debe ser mayor a 0');
      return;
    }

    onConfirm({
      cantidad: cantidadNumerica,
      precioUnitario: precioHoraAdicional,
      monto: monto,
      concepto: `Horas Extras (${cantidadNumerica} hora${cantidadNumerica > 1 ? 's' : ''})`,
      motivo: motivo.trim() || undefined
    });
  };

  const handleClose = () => {
    setCantidad('1');
    setMotivo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Agregar Horas Extras</h2>
              <p className="text-sm text-gray-600">Servicio: {pedido.cliente.name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del pedido */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Información del Servicio</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">Cliente:</span> {pedido.cliente.name}</p>
              <p><span className="font-medium">Plan:</span> {pedido.plan.name}</p>
              <p><span className="font-medium">Precio por hora:</span> {formatCurrency(precioHoraAdicional)}</p>
            </div>
          </div>

          {/* Cantidad de horas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de Horas Extras
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
              placeholder="Ej: 2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Máximo 24 horas por modificación
            </p>
          </div>

          {/* Cálculo automático */}
          {cantidadNumerica > 0 && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-medium text-orange-900 mb-2">Cálculo Automático</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-orange-700">Horas:</span>
                  <span className="font-medium text-orange-900">{cantidadNumerica}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-700">Precio unitario:</span>
                  <span className="font-medium text-orange-900">{formatCurrency(precioHoraAdicional)}</span>
                </div>
                <div className="border-t border-orange-200 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-orange-900">Total:</span>
                    <span className="font-bold text-lg text-orange-900">{formatCurrency(monto)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Motivo (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo (Opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
              rows={3}
              placeholder="Ej: Cliente necesita más tiempo para completar el lavado..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-4 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={cantidadNumerica <= 0}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg transition-colors font-medium ${
              cantidadNumerica <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            Agregar Horas Extras
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalHorasExtras;

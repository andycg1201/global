import React, { useState } from 'react';
import { XMarkIcon, MinusCircleIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/dateUtils';

interface ModalDescuentosProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    concepto: string;
    descripcion?: string;
    monto: number;
    motivo: string;
  }) => void;
  pedido: {
    id: string;
    cliente: {
      name: string;
    };
    plan: {
      name: string;
    };
    saldoPendiente: number;
  };
}

const ModalDescuentos: React.FC<ModalDescuentosProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido
}) => {
  const [concepto, setConcepto] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');

  // Conceptos predefinidos comunes para descuentos
  const conceptosComunes = [
    'Corte de agua',
    'Problema técnico',
    'Demora en entrega',
    'Problema con lavadora',
    'Servicio deficiente',
    'Compensación',
    'Descuento promocional',
    'Otro'
  ];

  if (!isOpen) return null;

  const montoNumerico = parseFloat(monto) || 0;

  const handleConfirmar = () => {
    if (!concepto.trim()) {
      alert('El concepto es obligatorio');
      return;
    }

    if (!motivo.trim()) {
      alert('El motivo es obligatorio');
      return;
    }

    if (montoNumerico <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (montoNumerico > pedido.saldoPendiente) {
      alert('El descuento no puede ser mayor al saldo pendiente');
      return;
    }

    onConfirm({
      concepto: concepto.trim(),
      descripcion: descripcion.trim() || undefined,
      monto: -montoNumerico, // Negativo para descuentos
      motivo: motivo.trim()
    });
  };

  const handleClose = () => {
    setConcepto('');
    setDescripcion('');
    setMonto('');
    setMotivo('');
    onClose();
  };

  const handleConceptoComun = (conceptoComun: string) => {
    setConcepto(conceptoComun);
    if (conceptoComun === 'Otro') {
      setConcepto('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <MinusCircleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Aplicar Descuento</h2>
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
              <p><span className="font-medium">Saldo pendiente:</span> {formatCurrency(pedido.saldoPendiente)}</p>
            </div>
          </div>

          {/* Conceptos comunes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivos Comunes
            </label>
            <div className="grid grid-cols-2 gap-2">
              {conceptosComunes.map((conceptoComun) => (
                <button
                  key={conceptoComun}
                  onClick={() => handleConceptoComun(conceptoComun)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    concepto === conceptoComun
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {conceptoComun}
                </button>
              ))}
            </div>
          </div>

          {/* Concepto personalizado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Concepto del Descuento *
            </label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Ej: Compensación por inconveniente..."
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={2}
              placeholder="Detalles del problema o situación..."
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto del Descuento *
            </label>
            <input
              type="number"
              min="0"
              max={pedido.saldoPendiente}
              step="100"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-lg"
              placeholder="0"
            />
            {montoNumerico > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Descuento: {formatCurrency(montoNumerico)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Máximo: {formatCurrency(pedido.saldoPendiente)}
            </p>
          </div>

          {/* Motivo (obligatorio) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo del Descuento *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={3}
              placeholder="Explica detalladamente por qué se aplica este descuento..."
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
            disabled={!concepto.trim() || !motivo.trim() || montoNumerico <= 0 || montoNumerico > pedido.saldoPendiente}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg transition-colors font-medium ${
              !concepto.trim() || !motivo.trim() || montoNumerico <= 0 || montoNumerico > pedido.saldoPendiente
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            Aplicar Descuento
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDescuentos;

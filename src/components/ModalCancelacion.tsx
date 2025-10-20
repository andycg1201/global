import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalCancelacionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  pedidoInfo: {
    cliente: string;
    plan: string;
  };
}

const ModalCancelacion: React.FC<ModalCancelacionProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedidoInfo
}) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onConfirm(motivo);
      setMotivo('');
      onClose();
    } catch (error) {
      console.error('Error al cancelar pedido:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMotivo('');
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
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <XMarkIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Cancelar Pedido
              </h3>
              <p className="text-sm text-gray-500">
                Esta acción no se puede deshacer
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
              Pedido a cancelar:
            </h4>
            <div className="space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Cliente:</span> {pedidoInfo.cliente}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Plan:</span> {pedidoInfo.plan}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la cancelación <span className="text-gray-500">(opcional)</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                rows={4}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Cliente canceló, problema técnico, cambio de horario, etc."
              />
              <p className="mt-1 text-xs text-gray-500">
                Ayuda a entender por qué se canceló este pedido
              </p>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={loading}
              >
                No cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalCancelacion;

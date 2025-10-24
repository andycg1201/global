import React, { useState } from 'react';
import { XMarkIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { capitalService } from '../services/capitalService';
import { formatCurrency } from '../utils/dateUtils';

interface ModalMovimientoCapitalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tipo: 'inyeccion' | 'retiro';
}

const ModalMovimientoCapital: React.FC<ModalMovimientoCapitalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tipo
}) => {
  const [formData, setFormData] = useState({
    concepto: '',
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar que al menos un campo tenga valor
      if (formData.efectivo === 0 && formData.nequi === 0 && formData.daviplata === 0) {
        setError('Debe ingresar al menos un valor en algún medio de pago');
        return;
      }

      if (!formData.concepto.trim()) {
        setError('El concepto es obligatorio');
        return;
      }

      await capitalService.createMovimientoCapital({
        tipo,
        concepto: formData.concepto,
        efectivo: formData.efectivo,
        nequi: formData.nequi,
        daviplata: formData.daviplata,
        observaciones: formData.observaciones || undefined,
        fecha: new Date(),
        createdBy: 'admin' // TODO: obtener del contexto de usuario
      });

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        concepto: '',
        efectivo: 0,
        nequi: 0,
        daviplata: 0,
        observaciones: ''
      });
    } catch (error: any) {
      console.error('Error al crear movimiento de capital:', error);
      setError(error.message || 'Error al crear movimiento de capital');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  const total = formData.efectivo + formData.nequi + formData.daviplata;
  const isInyeccion = tipo === 'inyeccion';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isInyeccion ? 'bg-green-100' : 'bg-red-100'}`}>
              {isInyeccion ? (
                <ArrowUpIcon className="h-6 w-6 text-green-600" />
              ) : (
                <ArrowDownIcon className="h-6 w-6 text-red-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isInyeccion ? 'Inyección de Capital' : 'Retiro de Capital'}
              </h3>
              <p className="text-sm text-gray-500">
                {isInyeccion ? 'Agregar dinero al capital' : 'Retirar dinero del capital'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Concepto *
              </label>
              <input
                type="text"
                value={formData.concepto}
                onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Ej: Inversión en equipos, Retiro personal, etc."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Efectivo
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.efectivo || ''}
                  onChange={(e) => handleInputChange('efectivo', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nequi
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.nequi || ''}
                  onChange={(e) => handleInputChange('nequi', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daviplata
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.daviplata || ''}
                  onChange={(e) => handleInputChange('daviplata', e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones (Opcional)
              </label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder="Detalles adicionales..."
              />
            </div>
          </div>

          <div className={`p-4 rounded-lg ${isInyeccion ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Total {isInyeccion ? 'Inyección' : 'Retiro'}:
              </span>
              <span className={`text-lg font-bold ${isInyeccion ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || total === 0}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : `${isInyeccion ? 'Inyectar' : 'Retirar'} Capital`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalMovimientoCapital;

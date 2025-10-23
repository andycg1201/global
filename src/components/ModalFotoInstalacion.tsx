import React from 'react';
import { XMarkIcon, CalendarIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../utils/dateUtils';

interface ModalFotoInstalacionProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: {
    id: string;
    cliente: {
      name: string;
      phone: string;
      address: string;
    };
    lavadoraAsignada?: {
      codigoQR: string;
      marca: string;
      modelo: string;
      fotoInstalacion?: string;
      observacionesInstalacion?: string;
    };
    validacionQR?: {
      lavadoraEscaneada: string;
      lavadoraOriginal: string;
      cambioRealizado: boolean;
      fechaValidacion: Date;
      fotoInstalacion?: string;
      observacionesValidacion?: string;
    };
    fechaEntrega?: Date;
  } | null;
}

const ModalFotoInstalacion: React.FC<ModalFotoInstalacionProps> = ({
  isOpen,
  onClose,
  pedido
}) => {
  if (!isOpen || !pedido) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Evidencia de Instalación</h3>
              <p className="text-sm text-gray-500">Pedido #{pedido.id.slice(-8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Información del Pedido */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Información del Cliente */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <UserIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">{pedido.cliente.name}</h4>
                  <p className="text-sm text-gray-600">{pedido.cliente.phone}</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">{pedido.cliente.address}</p>
                </div>
              </div>

              {pedido.lavadoraAsignada && (
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {pedido.lavadoraAsignada.codigoQR}
                    </p>
                    <p className="text-sm text-gray-600">
                      {pedido.lavadoraAsignada.marca} {pedido.lavadoraAsignada.modelo}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Información de la Validación */}
            <div className="space-y-4">
              {pedido.validacionQR?.fechaValidacion && (
                <div className="flex items-start space-x-3">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Fecha de Validación</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(pedido.validacionQR.fechaValidacion, 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}

              {pedido.fechaEntrega && (
                <div className="flex items-start space-x-3">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Fecha de Entrega</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(pedido.fechaEntrega, 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}

              {pedido.validacionQR?.observacionesValidacion && (
                <div>
                  <p className="font-medium text-gray-900 mb-2">Observaciones del Técnico</p>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {pedido.validacionQR.observacionesValidacion}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Foto de Instalación */}
          {(pedido.validacionQR?.fotoInstalacion || 
            (pedido as any).validacionQR_fotoInstalacion ||
            pedido.lavadoraAsignada?.fotoInstalacion) ? (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Foto de la Instalación</h4>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
                <img
                  src={pedido.validacionQR?.fotoInstalacion || 
                        (pedido as any).validacionQR_fotoInstalacion ||
                        pedido.lavadoraAsignada?.fotoInstalacion}
                  alt="Evidencia de instalación"
                  className="max-w-full max-h-96 rounded-lg shadow-lg"
                  style={{ objectFit: 'contain' }}
                />
              </div>
              
              {/* Observaciones de la Instalación */}
              {(pedido.lavadoraAsignada?.observacionesInstalacion || 
                (pedido as any).validacionQR_observacionesInstalacion) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-900 mb-2">📝 Observaciones de la Instalación</h5>
                  <p className="text-sm text-blue-800">
                    {pedido.lavadoraAsignada?.observacionesInstalacion || 
                     (pedido as any).validacionQR_observacionesInstalacion}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin evidencia fotográfica</h3>
              <p className="text-gray-500">
                Este pedido no tiene foto de evidencia de instalación.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalFotoInstalacion;

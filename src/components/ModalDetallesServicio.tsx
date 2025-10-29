import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { formatDate, formatCurrency } from '../utils/dateUtils';

interface ModalDetallesServicioProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido;
}

const ModalDetallesServicio: React.FC<ModalDetallesServicioProps> = ({
  isOpen,
  onClose,
  pedido
}) => {
  if (!isOpen || !pedido) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Detalles del Servicio</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Cerrar</span>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Información del Cliente */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Información del Cliente</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nombre</p>
                <p className="font-medium">{pedido.cliente.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Teléfono</p>
                <p className="font-medium">{pedido.cliente.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Dirección</p>
                <p className="font-medium">{pedido.cliente.address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Barrio</p>
                <p className="font-medium">{pedido.cliente.address || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Información del Servicio */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Información del Servicio</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="font-medium">{pedido.plan.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Precio del Plan</p>
                <p className="font-medium">{formatCurrency(pedido.plan.price || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  pedido.status === 'entregado' ? 'bg-green-100 text-green-800' :
                  pedido.status === 'recogido' ? 'bg-blue-100 text-blue-800' :
                  pedido.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {pedido.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha de Asignación</p>
                <p className="font-medium">{formatDate(pedido.fechaAsignacion)}</p>
              </div>
            </div>
          </div>

          {/* Información de la Lavadora */}
          {pedido.lavadoraAsignada && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Lavadora Asignada</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Código QR</p>
                  <p className="font-medium">{pedido.lavadoraAsignada.codigoQR}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Marca</p>
                  <p className="font-medium">{pedido.lavadoraAsignada.marca}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Modelo</p>
                  <p className="font-medium">{pedido.lavadoraAsignada.modelo}</p>
                </div>
                {pedido.lavadoraAsignada.observacionesInstalacion && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600">Observaciones de Instalación</p>
                    <p className="font-medium">{pedido.lavadoraAsignada.observacionesInstalacion}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información Financiera */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Información Financiera</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="font-medium">{formatCurrency(pedido.subtotal || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cobros Adicionales</p>
                <p className="font-medium">{formatCurrency(pedido.totalCobrosAdicionales || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Descuentos</p>
                <p className="font-medium text-red-600">-{formatCurrency(pedido.totalDescuentos || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-bold text-lg">{formatCurrency(pedido.total || 0)}</p>
              </div>
            </div>
          </div>

          {/* Pagos Realizados */}
          {pedido.pagosRealizados && pedido.pagosRealizados.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Pagos Realizados</h4>
              <div className="space-y-2">
                {pedido.pagosRealizados.map((pago, index) => (
                  <div key={index} className="flex justify-between items-center bg-white p-2 rounded">
                    <div>
                      <span className="font-medium capitalize">{pago.medioPago}</span>
                      {pago.isPartial && <span className="text-xs text-gray-500 ml-2">(Abono)</span>}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(pago.monto || 0)}</p>
                      <p className="text-xs text-gray-500">{formatDate(pago.fecha)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Información de Auditoría (solo para servicios eliminados) */}
          {pedido.eliminado && (
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
              <h4 className="font-semibold text-red-900 mb-2">Información de Auditoría</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-red-600">Estado</p>
                  <p className="font-medium text-red-800">Servicio Eliminado</p>
                </div>
                <div>
                  <p className="text-sm text-red-600">Fecha de Eliminación</p>
                  <p className="font-medium text-red-800">
                    {pedido.fechaEliminacion ? formatDate(pedido.fechaEliminacion) : 'N/A'}
                  </p>
                </div>
                {pedido.motivoEliminacion && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-red-600">Motivo de Eliminación</p>
                    <p className="font-medium text-red-800">{pedido.motivoEliminacion}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Observaciones */}
          {pedido.observaciones && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Observaciones</h4>
              <p className="text-gray-700">{pedido.observaciones}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDetallesServicio;

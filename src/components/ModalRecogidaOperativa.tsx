import React, { useState } from 'react';
import { XMarkIcon, ClockIcon, UserIcon, DevicePhoneMobileIcon, CurrencyDollarIcon, DocumentTextIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { formatCurrency, formatDate } from '../utils/dateUtils';
import { ModificacionesService } from '../services/modificacionesService';

interface ModalRecogidaOperativaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    observaciones: string;
    horaRecogida: string;
    fechaRecogida: Date;
  }) => void;
  pedido: Pedido;
}

const ModalRecogidaOperativa: React.FC<ModalRecogidaOperativaProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido
}) => {
  const [observaciones, setObservaciones] = useState('');
  const [horaRecogida, setHoraRecogida] = useState('');
  const [fechaRecogida, setFechaRecogida] = useState('');
  const [modificaciones, setModificaciones] = useState<any>(null);
  const [cargandoModificaciones, setCargandoModificaciones] = useState(false);

  // Resetear formulario cuando se abre el modal
  React.useEffect(() => {
    if (isOpen) {
      const ahora = new Date();
      
      // Formatear fecha actual (YYYY-MM-DD)
      const fechaActual = ahora.toISOString().split('T')[0];
      
      // Formatear hora actual (HH:MM)
      const horaActual = ahora.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
      
      setFechaRecogida(fechaActual);
      setHoraRecogida(horaActual);
      setObservaciones('');
      
      // Cargar modificaciones del servicio
      cargarModificaciones();
    }
  }, [isOpen]);

  const cargarModificaciones = async () => {
    if (!pedido) return;
    
    setCargandoModificaciones(true);
    try {
      const modificacionesData = await ModificacionesService.obtenerModificacionPorPedido(pedido.id);
      setModificaciones(modificacionesData);
    } catch (error) {
      console.error('Error al cargar modificaciones:', error);
      setModificaciones(null);
    } finally {
      setCargandoModificaciones(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fechaRecogida.trim() || !horaRecogida.trim()) {
      alert('La fecha y hora de recogida son obligatorias');
      return;
    }

    // Combinar fecha y hora en un objeto Date
    const fechaHoraCompleta = new Date(`${fechaRecogida}T${horaRecogida}`);
    
    onConfirm({
      observaciones: observaciones.trim(),
      horaRecogida: horaRecogida.trim(),
      fechaRecogida: fechaHoraCompleta
    });

    // Reset form
    setObservaciones('');
    setHoraRecogida('');
    setFechaRecogida('');
    onClose();
  };

  const handleClose = () => {
    setObservaciones('');
    setHoraRecogida('');
    setFechaRecogida('');
    onClose();
  };

  // Calcular saldo pendiente
  const saldoPendiente = (pedido.total || 0) - (pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Recoger Servicio
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Información del servicio */}
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-3 text-sm sm:text-base">Servicio #{pedido.id.slice(-6)}</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {/* Cliente */}
              <div className="flex items-center space-x-2">
                <UserIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-blue-800">
                  <strong>Cliente:</strong> {pedido.cliente.name}
                </span>
              </div>
              
              {/* Teléfono */}
              <div className="flex items-center space-x-2">
                <DevicePhoneMobileIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-blue-800">
                  <strong>Teléfono:</strong> {pedido.cliente.phone}
                </span>
              </div>
              
              {/* Plan */}
              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm text-blue-800">
                  <strong>Plan:</strong> {pedido.plan.name}
                </span>
              </div>
              
              {/* Estado del servicio */}
              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm text-blue-800">
                  <strong>Estado:</strong> 
                  <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                    pedido.status === 'entregado' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {pedido.status}
                  </span>
                </span>
              </div>
              
              {/* Fecha de entrega */}
              <div className="flex items-center space-x-2 sm:col-span-2">
                <span className="text-xs sm:text-sm text-blue-800">
                  <strong>Fecha entrega:</strong> {formatDate(pedido.fechaEntrega || pedido.createdAt, 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              
              {/* Lavadora */}
              {pedido.lavadoraId && (
                <div className="flex items-center space-x-2 sm:col-span-2">
                  <span className="text-xs sm:text-sm text-blue-800">
                    <strong>Lavadora:</strong> {pedido.lavadoraId}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Resumen financiero del servicio */}
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center text-sm sm:text-base">
              <CurrencyDollarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 mr-2 flex-shrink-0" />
              Resumen Financiero del Servicio
            </h3>
            
            <div className="space-y-3">
              {/* Precio base del plan */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Precio base ({pedido.plan.name}):</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(pedido.plan.price)}</span>
              </div>
              
              {/* Modificaciones */}
              {cargandoModificaciones ? (
                <div className="text-center py-2">
                  <span className="text-sm text-gray-500">Cargando modificaciones...</span>
                </div>
              ) : modificaciones ? (
                <div className="space-y-2">
                  {/* Horas extras */}
                  {modificaciones.horasExtras > 0 && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-1">
                        <PlusIcon className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-gray-600">Horas extras ({modificaciones.horasExtras}):</span>
                      </div>
                      <span className="text-sm font-medium text-green-600">
                        +{formatCurrency(modificaciones.horasExtras * (modificaciones.precioHoraExtra || 2000))}
                      </span>
                    </div>
                  )}
                  
                  {/* Cobros adicionales */}
                  {modificaciones.cobrosAdicionales && modificaciones.cobrosAdicionales.length > 0 && (
                    <div className="space-y-1">
                      {modificaciones.cobrosAdicionales.map((cobro: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <div className="flex items-center space-x-1">
                            <PlusIcon className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-gray-600">{cobro.concepto}:</span>
                          </div>
                          <span className="text-sm font-medium text-green-600">
                            +{formatCurrency(cobro.monto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Descuentos */}
                  {modificaciones.descuentos && modificaciones.descuentos.length > 0 && (
                    <div className="space-y-1">
                      {modificaciones.descuentos.map((descuento: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <div className="flex items-center space-x-1">
                            <MinusIcon className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-gray-600">{descuento.concepto}:</span>
                          </div>
                          <span className="text-sm font-medium text-red-600">
                            -{formatCurrency(descuento.monto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Total modificaciones */}
                  {(modificaciones.horasExtras > 0 || 
                    (modificaciones.cobrosAdicionales && modificaciones.cobrosAdicionales.length > 0) ||
                    (modificaciones.descuentos && modificaciones.descuentos.length > 0)) && (
                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total modificaciones:</span>
                        <span className={`text-sm font-medium ${
                          modificaciones.totalModificaciones > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {modificaciones.totalModificaciones > 0 ? '+' : ''}{formatCurrency(modificaciones.totalModificaciones)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <span className="text-sm text-gray-500">Sin modificaciones</span>
                </div>
              )}
              
              {/* Total del servicio */}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total del servicio:</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(pedido.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Historial de pagos */}
          {pedido.pagosRealizados && pedido.pagosRealizados.length > 0 && (
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 mr-2 flex-shrink-0" />
                Historial de Pagos
              </h3>
              <div className="space-y-2">
                {pedido.pagosRealizados.map((pago, index) => {
                  // Manejar correctamente los timestamps de Firebase
                  let fechaPago: Date;
                  let fechaValida: boolean;
                  
                  if (pago.fecha instanceof Date) {
                    fechaPago = pago.fecha;
                    fechaValida = !isNaN(fechaPago.getTime());
                  } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
                    fechaPago = (pago.fecha as any).toDate();
                    fechaValida = !isNaN(fechaPago.getTime());
                  } else {
                    fechaPago = new Date(pago.fecha);
                    fechaValida = !isNaN(fechaPago.getTime());
                  }
                  
                  return (
                    <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm space-y-1 sm:space-y-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                        <span className="text-gray-600">
                          {fechaValida ? formatDate(fechaPago, 'dd/MM/yyyy HH:mm') : 'Fecha inválida'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs w-fit ${
                          pago.medioPago === 'efectivo' ? 'bg-green-100 text-green-800' :
                          pago.medioPago === 'nequi' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {pago.medioPago === 'efectivo' ? '💵 Efectivo' :
                           pago.medioPago === 'nequi' ? '📱 Nequi' :
                           '📱 Daviplata'}
                        </span>
                      </div>
                      <span className="font-medium text-green-600 text-sm sm:text-base">
                        {formatCurrency(pago.monto)}
                      </span>
                    </div>
                  );
                })}
                
                {/* Total pagado */}
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Total pagado:</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(pedido.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Saldo pendiente */}
          <div className={`p-3 sm:p-4 rounded-lg border ${
            saldoPendiente > 0 
              ? 'bg-red-50 border-red-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <CurrencyDollarIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${
                  saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'
                }`} />
                <div>
                  <h4 className={`text-sm sm:text-lg font-medium ${
                    saldoPendiente > 0 ? 'text-red-800' : 'text-green-800'
                  }`}>
                    {saldoPendiente > 0 ? 'Saldo Pendiente' : 'Servicio Pagado'}
                  </h4>
                  <p className={`text-xs sm:text-sm ${
                    saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {saldoPendiente > 0 ? 'Requiere liquidación' : 'Listo para recoger'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg sm:text-xl font-bold ${
                  saldoPendiente > 0 ? 'text-red-900' : 'text-green-900'
                }`}>
                  {formatCurrency(saldoPendiente)}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario de recogida */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fecha y hora de recogida */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fecha de recogida */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Recogida *
                </label>
                <input
                  type="date"
                  value={fechaRecogida}
                  onChange={(e) => setFechaRecogida(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  required
                />
              </div>

              {/* Hora de recogida */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Recogida *
                </label>
                <input
                  type="time"
                  value={horaRecogida}
                  onChange={(e) => setHoraRecogida(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  required
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones de Recogida
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base resize-none"
                placeholder="Estado de la lavadora, comentarios del cliente, etc."
              />
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
              >
                Confirmar Recogida
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalRecogidaOperativa;

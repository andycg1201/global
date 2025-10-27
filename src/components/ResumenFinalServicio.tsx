import React from 'react';
import { 
  ClockIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Pedido, ModificacionPedido } from '../types';
import { formatCurrency, formatDate } from '../utils/dateUtils';

interface ResumenFinalServicioProps {
  pedido: Pedido;
  onClose: () => void;
}

const ResumenFinalServicio: React.FC<ResumenFinalServicioProps> = ({
  pedido,
  onClose
}) => {
  // Crear timeline de eventos del servicio
  const crearTimeline = () => {
    const eventos: Array<{
      id: string;
      tipo: 'creacion' | 'entrega' | 'modificacion' | 'pago' | 'recogida';
      titulo: string;
      descripcion: string;
      fecha: Date;
      monto?: number;
      icono: React.ReactNode;
      color: string;
    }> = [];

    // Evento de creación
    eventos.push({
      id: 'creacion',
      tipo: 'creacion',
      titulo: 'Servicio Creado',
      descripcion: `Plan ${pedido.plan.name} para ${pedido.cliente.name}`,
      fecha: pedido.createdAt,
      monto: pedido.subtotal,
      icono: <InformationCircleIcon className="h-5 w-5" />,
      color: 'blue'
    });

    // Evento de entrega
    if (pedido.fechaEntrega) {
      eventos.push({
        id: 'entrega',
        tipo: 'entrega',
        titulo: 'Servicio Entregado',
        descripcion: `Lavadora ${pedido.lavadoraAsignada?.codigoQR || 'N/A'} instalada`,
        fecha: pedido.fechaEntrega,
        icono: <CheckCircleIcon className="h-5 w-5" />,
        color: 'green'
      });
    }

    // Eventos de modificaciones
    if (pedido.resumenModificaciones?.modificaciones) {
      pedido.resumenModificaciones.modificaciones.forEach((modificacion) => {
        eventos.push({
          id: modificacion.id,
          tipo: 'modificacion',
          titulo: modificacion.concepto,
          descripcion: modificacion.descripcion || modificacion.motivo || '',
          fecha: modificacion.fecha,
          monto: modificacion.monto,
          icono: modificacion.monto > 0 ? 
            <CurrencyDollarIcon className="h-5 w-5" /> : 
            <ExclamationTriangleIcon className="h-5 w-5" />,
          color: modificacion.monto > 0 ? 'green' : 'red'
        });
      });
    }

    // Eventos de pagos
    if (pedido.pagosRealizados) {
      pedido.pagosRealizados.forEach((pago, index) => {
        eventos.push({
          id: `pago-${index}`,
          tipo: 'pago',
          titulo: `Pago ${pago.medioPago}`,
          descripcion: pago.referencia ? `Ref: ${pago.referencia}` : 'Sin referencia',
          fecha: pago.fecha,
          monto: pago.monto,
          icono: <CurrencyDollarIcon className="h-5 w-5" />,
          color: 'blue'
        });
      });
    }

    // Evento de recogida
    if (pedido.fechaRecogida) {
      eventos.push({
        id: 'recogida',
        tipo: 'recogida',
        titulo: 'Servicio Recogido',
        descripcion: 'Lavadora liberada y servicio finalizado',
        fecha: pedido.fechaRecogida,
        icono: <CheckCircleIcon className="h-5 w-5" />,
        color: 'purple'
      });
    }

    // Ordenar por fecha
    return eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  };

  const timeline = crearTimeline();
  const saldoFinal = pedido.resumenModificaciones?.montoTotalModificaciones || 0;
  const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
  const saldoPendiente = (pedido.subtotal + saldoFinal) - totalPagado;

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      red: 'bg-red-100 text-red-600 border-red-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Resumen Final del Servicio</h2>
              <p className="text-sm text-gray-600">Servicio #{pedido.id.slice(-6)} - {pedido.cliente.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Resumen financiero */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Resumen Financiero</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Plan Base</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(pedido.subtotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Modificaciones</p>
                <p className={`text-lg font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {saldoFinal >= 0 ? '+' : ''}{formatCurrency(saldoFinal)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Pagado</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(totalPagado)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Saldo Final:</span>
                <span className={`text-xl font-bold ${saldoPendiente === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(saldoPendiente)}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline de eventos */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 text-gray-600 mr-2" />
              Timeline del Servicio
            </h3>
            <div className="space-y-4">
              {timeline.map((evento, index) => (
                <div key={evento.id} className="flex items-start space-x-4">
                  {/* Icono */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center ${getColorClasses(evento.color)}`}>
                    {evento.icono}
                  </div>
                  
                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">{evento.titulo}</h4>
                      <div className="flex items-center space-x-2">
                        {evento.monto !== undefined && (
                          <span className={`text-sm font-medium ${
                            evento.monto > 0 ? 'text-green-600' : evento.monto < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {evento.monto > 0 ? '+' : ''}{formatCurrency(evento.monto)}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(evento.fecha, 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    {evento.descripcion && (
                      <p className="text-sm text-gray-600 mt-1">{evento.descripcion}</p>
                    )}
                  </div>
                  
                  {/* Línea conectora */}
                  {index < timeline.length - 1 && (
                    <div className="absolute left-5 top-10 w-0.5 h-8 bg-gray-300"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Estado final */}
          <div className={`rounded-lg p-4 ${
            saldoPendiente === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center">
              {saldoPendiente === 0 ? (
                <CheckCircleIcon className="h-6 w-6 text-green-600 mr-3" />
              ) : (
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-3" />
              )}
              <div>
                <h4 className={`font-medium ${
                  saldoPendiente === 0 ? 'text-green-900' : 'text-yellow-900'
                }`}>
                  {saldoPendiente === 0 ? 'Servicio Liquidado Completamente' : 'Servicio con Saldo Pendiente'}
                </h4>
                <p className={`text-sm ${
                  saldoPendiente === 0 ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {saldoPendiente === 0 
                    ? 'El servicio ha sido completamente liquidado y puede ser archivado.'
                    : `Queda un saldo pendiente de ${formatCurrency(saldoPendiente)} por liquidar.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Cerrar Resumen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumenFinalServicio;

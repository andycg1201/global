import React from 'react';
import { 
  ClockIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  TruckIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { formatDate, formatCurrency, calculatePickupDate, generateWhatsAppLink } from '../utils/dateUtils';
import { Pedido } from '../types';

interface PedidosPendientesProps {
  pedidosPendientesEntregar: Pedido[];
  pedidosPendientesRecoger: Pedido[];
  pedidosCompletadosConSaldo?: Pedido[];
  onMarcarEntregado?: (pedidoId: string) => void;
  onMarcarRecogido?: (pedidoId: string) => void;
  onModificarServicio?: (pedido: Pedido) => void;
  onRegistrarPago?: (pedido: Pedido) => void;
}

const PedidosPendientes: React.FC<PedidosPendientesProps> = ({
  pedidosPendientesEntregar,
  pedidosPendientesRecoger,
  pedidosCompletadosConSaldo = [],
  onMarcarEntregado,
  onMarcarRecogido,
  onModificarServicio,
  onRegistrarPago
}) => {
  // Separar pedidos por prioridad
  const pedidosPrioritarios = pedidosPendientesEntregar.filter(p => p.isPrioritario);
  const pedidosNormales = pedidosPendientesEntregar.filter(p => !p.isPrioritario);

  // Ordenar pedidos pendientes de recoger por fecha de vencimiento (más urgentes primero)
  const pedidosRecogerOrdenados = [...pedidosPendientesRecoger].sort((a, b) => {
    // Calcular fecha de recogida esperada para cada pedido
    const fechaRecogidaA = a.fechaRecogidaCalculada || 
      (a.fechaEntrega ? calculatePickupDate(a.fechaEntrega, a.plan, a.horasAdicionales || 0) : new Date());
    const fechaRecogidaB = b.fechaRecogidaCalculada || 
      (b.fechaEntrega ? calculatePickupDate(b.fechaEntrega, b.plan, b.horasAdicionales || 0) : new Date());
    
    // Ordenar por fecha de recogida (más temprana primero = más urgente)
    return fechaRecogidaA.getTime() - fechaRecogidaB.getTime();
  });

  // Función para obtener el color del badge según la prioridad
  const getPriorityBadgeColor = (isPrioritario: boolean) => {
    return isPrioritario 
      ? 'bg-red-100 text-red-800 border-red-200' 
      : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  // Función para obtener el ícono según la prioridad
  const getPriorityIcon = (isPrioritario: boolean) => {
    return isPrioritario ? ExclamationTriangleIcon : ClockIcon;
  };

  // Función para calcular el tiempo transcurrido desde la entrega
  const getTiempoTranscurrido = (fechaEntrega: Date) => {
    const ahora = new Date();
    const diffMs = ahora.getTime() - fechaEntrega.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} min`;
    }
  };

  // Función para obtener el color de alerta según el tiempo transcurrido
  const getAlertColor = (fechaEntrega: Date) => {
    const ahora = new Date();
    const diffMs = ahora.getTime() - fechaEntrega.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours > 24) {
      return 'bg-red-50 border-red-200'; // Muy urgente
    } else if (diffHours > 12) {
      return 'bg-orange-50 border-orange-200'; // Urgente
    } else {
      return 'bg-yellow-50 border-yellow-200'; // Atención
    }
  };

  // Función para determinar el nivel de urgencia de recogida
  const getUrgenciaRecogida = (pedido: Pedido) => {
    const ahora = new Date();
    const fechaRecogida = pedido.fechaRecogidaCalculada || 
      (pedido.fechaEntrega ? calculatePickupDate(pedido.fechaEntrega, pedido.plan, pedido.horasAdicionales || 0) : new Date());
    
    const diffMs = ahora.getTime() - fechaRecogida.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Solo marcar como "vencido" si han pasado más de 2 horas desde la hora de recogida programada
    if (diffHours > 2) {
      return { nivel: 'vencido', color: 'bg-red-100 text-red-800 border-red-200', icon: ExclamationTriangleIcon };
    } else if (diffHours > 0) {
      return { nivel: 'venciendo', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: ClockIcon };
    } else if (diffHours > -1) {
      return { nivel: 'pronto', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: ClockIcon };
    } else {
      return { nivel: 'normal', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircleIcon };
    }
  };

  // Función para obtener el tiempo hasta la recogida o tiempo vencido
  const getTiempoRecogida = (pedido: Pedido) => {
    const ahora = new Date();
    const fechaRecogida = pedido.fechaRecogidaCalculada || 
      (pedido.fechaEntrega ? calculatePickupDate(pedido.fechaEntrega, pedido.plan, pedido.horasAdicionales || 0) : new Date());
    
    const diffMs = fechaRecogida.getTime() - ahora.getTime();
    const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHours / 24);
    
    const isVencido = diffMs < 0;
    
    // Solo mostrar "Vencido" si han pasado más de 2 horas
    if (isVencido && diffHours > 2) {
      const prefix = 'Vencido hace';
      if (diffDays > 0) {
        return `${prefix} ${diffDays} día${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 1) {
        return `${prefix} ${Math.floor(diffHours)} hora${Math.floor(diffHours) > 1 ? 's' : ''}`;
      } else {
        const diffMinutes = Math.floor(diffHours * 60);
        return `${prefix} ${diffMinutes} min`;
      }
    } else if (isVencido) {
      // Si está vencido pero menos de 2 horas, mostrar como "Pendiente por recoger"
      return 'Pendiente por recoger';
    } else {
      // Si no está vencido, mostrar tiempo restante
      const prefix = 'Vence en';
      if (diffDays > 0) {
        return `${prefix} ${diffDays} día${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 1) {
        return `${prefix} ${Math.floor(diffHours)} hora${Math.floor(diffHours) > 1 ? 's' : ''}`;
      } else {
        const diffMinutes = Math.floor(diffHours * 60);
        return `${prefix} ${diffMinutes} min`;
      }
    }
  };

  const PedidoCard = ({ pedido, tipo }: { pedido: Pedido; tipo: 'entregar' | 'recoger' }) => {
    const PriorityIcon = getPriorityIcon(pedido.isPrioritario);
    const urgenciaRecogida = tipo === 'recoger' ? getUrgenciaRecogida(pedido) : null;
    const UrgenciaIcon = urgenciaRecogida?.icon || ClockIcon;
    
    // Calcular saldo pendiente para determinar si se puede modificar
    const saldoPendiente = (pedido.total || 0) - (pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0);
    const puedeModificar = saldoPendiente > 0;
    
    // Debug: verificar cálculo del saldo
    console.log('🔍 Debug PedidosPendientes - Saldo:', {
      pedidoId: pedido.id,
      cliente: pedido.cliente.name,
      total: pedido.total,
      pagosRealizados: pedido.pagosRealizados,
      totalPagado: pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0,
      saldoPendiente,
      puedeModificar
    });
    
    return (
      <div className={`p-4 rounded-lg border ${tipo === 'recoger' ? getAlertColor(pedido.fechaEntrega!) : 'bg-gray-50 border-gray-200'} transition-all duration-200 hover:shadow-md`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityBadgeColor(pedido.isPrioritario)}`}>
                <PriorityIcon className="h-3 w-3 mr-1" />
                {pedido.isPrioritario ? 'Prioritario' : 'Normal'}
              </span>
              {tipo === 'recoger' && urgenciaRecogida && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${urgenciaRecogida.color}`}>
                  <UrgenciaIcon className="h-3 w-3 mr-1" />
                  {getTiempoRecogida(pedido)}
                </span>
              )}
              {tipo === 'entregar' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  {getTiempoTranscurrido(pedido.fechaEntrega!)}
                </span>
              )}
            </div>
            
            <h4 className="font-medium text-gray-900 mb-1">
              {pedido.cliente.name}
              {pedido.lavadoraAsignada?.codigoQR && (
                <span className="ml-2 text-sm font-normal text-gray-600">
                  ({pedido.lavadoraAsignada.codigoQR})
                </span>
              )}
            </h4>
            {tipo === 'recoger' ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                <a
                  href={generateWhatsAppLink(pedido.cliente.phone, pedido.cliente.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1 transition-colors"
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  {pedido.cliente.phone}
                </a>
                <span className="text-sm font-medium text-blue-600">{pedido.plan.name}</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(pedido.total)}</span>
                {saldoPendiente > 0 && (
                  <span className="text-sm font-medium text-red-600">
                    Saldo: {formatCurrency(saldoPendiente)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                <p className="text-sm text-gray-600">{pedido.cliente.phone}</p>
                <span className="text-sm font-medium text-blue-600">{pedido.plan.name}</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(pedido.total)}</span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500">
              {tipo === 'entregar' && (
                <div className="flex items-center gap-1">
                  <TruckIcon className="h-3 w-3" />
                  <span className="font-medium">Entrega:</span>
                  {formatDate(pedido.fechaEntrega!, 'dd/MM HH:mm')}
                </div>
              )}
              {tipo === 'recoger' && (
                <>
                  <div className="flex items-center gap-1">
                    <TruckIcon className="h-3 w-3" />
                    <span className="font-medium">Entregado:</span>
                    {formatDate(pedido.fechaEntrega!, 'dd/MM HH:mm')}
                  </div>
                  <div className="flex items-center gap-1">
                    <HomeIcon className="h-3 w-3" />
                    <span className="font-medium">Recogida:</span>
                    {formatDate(
                      pedido.fechaRecogidaCalculada || 
                      (pedido.fechaEntrega ? calculatePickupDate(pedido.fechaEntrega, pedido.plan, pedido.horasAdicionales || 0) : new Date()), 
                      'dd/MM HH:mm'
                    )}
                  </div>
                </>
              )}
            </div>
            
            {pedido.isPrioritario && pedido.motivoPrioridad && (
              <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
                <strong>Motivo:</strong> {pedido.motivoPrioridad}
              </div>
            )}
            
            {pedido.observaciones && (
              <div className="mt-2 text-xs text-gray-600">
                <strong>Obs:</strong> {pedido.observaciones}
              </div>
            )}
          </div>
          
          <div className="ml-2 sm:ml-4 flex flex-col gap-2">
            {tipo === 'entregar' && onMarcarEntregado && (
              <button
                onClick={() => onMarcarEntregado(pedido.id)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Entregar
              </button>
            )}
            
            {tipo === 'recoger' && onMarcarRecogido && pedido.status !== 'recogido' && (
              <button
                onClick={() => onMarcarRecogido(pedido.id)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <HomeIcon className="h-3 w-3 mr-1" />
                Recoger
              </button>
            )}
            
            {/* Mostrar "Completado" para servicios ya recogidos */}
            {tipo === 'recoger' && pedido.status === 'recogido' && (
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-gray-500">
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Completado
              </span>
            )}
            
            {/* Botones de modificaciones para servicios entregados */}
            {tipo === 'recoger' && onModificarServicio && pedido.status !== 'recogido' && (
              <div className="flex flex-col sm:flex-row gap-1 mt-2">
                <button
                  onClick={() => onModificarServicio(pedido)}
                  disabled={!puedeModificar}
                  className={`inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md transition-colors ${
                    puedeModificar 
                      ? 'text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' 
                      : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                  }`}
                  title={puedeModificar ? "Modificar servicio (horas extras, cobros, descuentos, cambio de plan)" : "No se pueden hacer modificaciones - servicio completamente pagado"}
                >
                  <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                  Modificar
                </button>
                {onRegistrarPago && (
                  <button
                    onClick={() => onRegistrarPago(pedido)}
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                    title="Registrar pago del servicio"
                  >
                    <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                    Pagos
                  </button>
                )}
              </div>
            )}
            
            {/* Botones de pagos para servicios completados con saldo */}
            {tipo === 'recoger' && pedido.status === 'recogido' && onRegistrarPago && saldoPendiente > 0 && (
              <div className="flex flex-col sm:flex-row gap-1 mt-2">
                <button
                  onClick={() => onRegistrarPago(pedido)}
                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  title="Registrar pago del servicio completado"
                >
                  <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                  Pagos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Primera fila: Servicios Pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Servicios Pendientes de Entregar */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Servicios Pendientes de Entregar</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              {pedidosPendientesEntregar.length} pedidos
            </span>
          </div>
        
        {pedidosPendientesEntregar.length === 0 ? (
          <div className="text-center py-8">
            <TruckIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No hay pedidos pendientes de entregar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pedidos Prioritarios */}
            {pedidosPrioritarios.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Prioritarios ({pedidosPrioritarios.length})
                </h4>
                <div className="space-y-3">
                  {pedidosPrioritarios.map((pedido) => (
                    <PedidoCard key={pedido.id} pedido={pedido} tipo="entregar" />
                  ))}
                </div>
              </div>
            )}
            
            {/* Pedidos Normales */}
            {pedidosNormales.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4" />
                  Normales ({pedidosNormales.length})
                </h4>
                <div className="space-y-3">
                  {pedidosNormales.map((pedido) => (
                    <PedidoCard key={pedido.id} pedido={pedido} tipo="entregar" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Pedidos Pendientes de Recoger */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Servicios Pendientes de Recoger</h3>
              <p className="text-sm text-gray-500">Ordenados por urgencia de vencimiento</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
              {pedidosPendientesRecoger.length} pedidos
            </span>
          </div>
          
          {pedidosPendientesRecoger.length === 0 ? (
            <div className="text-center py-8">
              <HomeIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No hay pedidos pendientes de recoger</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosRecogerOrdenados.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} tipo="recoger" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Segunda fila: Servicios Completados con Saldo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Servicios Completados con Saldo Pendiente */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Servicios Completados con Saldo</h3>
              <p className="text-sm text-gray-500">Servicios terminados con pagos pendientes</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {pedidosCompletadosConSaldo.length} servicios
            </span>
          </div>
          
          {pedidosCompletadosConSaldo.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No hay servicios completados con saldo pendiente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosCompletadosConSaldo.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} tipo="recoger" />
              ))}
            </div>
          )}
        </div>
        
        {/* Columna vacía para mantener el mismo ancho */}
        <div></div>
      </div>
    </div>
  );
};

export default PedidosPendientes;

import React, { useState, useEffect } from 'react';
import { XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../utils/dateUtils';

interface EstadoLavadorasModalProps {
  isOpen: boolean;
  onClose: () => void;
  lavadoras: any[];
  onCargarTodosLosPedidos: () => Promise<any[]>;
}

const EstadoLavadorasModal: React.FC<EstadoLavadorasModalProps> = ({
  isOpen,
  onClose,
  lavadoras,
  onCargarTodosLosPedidos
}) => {
  const [todosLosPedidos, setTodosLosPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      cargarTodosLosPedidos();
    }
  }, [isOpen]);

  const cargarTodosLosPedidos = async () => {
    setLoading(true);
    try {
      const pedidos = await onCargarTodosLosPedidos();
      setTodosLosPedidos(pedidos);
      console.log('🔍 Todos los pedidos cargados para modal:', pedidos.length);
    } catch (error) {
      console.error('Error al cargar todos los pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Estado de Lavadoras</h3>
                <p className="text-blue-100 text-sm">Visualización del estado actual de todas las lavadoras</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Cargando pedidos...</span>
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {lavadoras.filter(l => {
                      // Buscar si tiene pedido asociado
                      const tienePedido = todosLosPedidos.find(p => 
                        p.lavadoraAsignada?.lavadoraId === l.id || 
                        p.lavadoraAsignada?.codigoQR === l.codigoQR ||
                        (p as any).lavadoraAsignada_lavadoraId === l.id ||
                        (p as any).lavadoraAsignada_codigoQR === l.codigoQR
                      );
                      return l.estado === 'disponible' && !tienePedido;
                    }).length}
                  </div>
                  <div className="text-sm text-green-700">Libres</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {lavadoras.filter(l => {
                      // Buscar si tiene pedido asociado
                      const tienePedido = todosLosPedidos.find(p => 
                        p.lavadoraAsignada?.lavadoraId === l.id || 
                        p.lavadoraAsignada?.codigoQR === l.codigoQR ||
                        (p as any).lavadoraAsignada_lavadoraId === l.id ||
                        (p as any).lavadoraAsignada_codigoQR === l.codigoQR
                      );
                      return tienePedido;
                    }).length}
                  </div>
                  <div className="text-sm text-red-700">Alquiladas</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {lavadoras.filter(l => l.estado === 'mantenimiento').length}
                  </div>
                  <div className="text-sm text-yellow-700">Mantenimiento</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {lavadoras.filter(l => l.estado === 'fuera_servicio').length}
                  </div>
                  <div className="text-sm text-gray-700">Fuera de Servicio</div>
                </div>
              </div>

              {/* Lista de lavadoras */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lavadoras
                  .sort((a, b) => {
                    // Extraer números del código QR para ordenar numéricamente
                    const numA = parseInt(a.codigoQR.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.codigoQR.replace(/\D/g, '')) || 0;
                    return numA - numB;
                  })
                  .map((lavadora) => {
                  // Buscar pedido asociado usando TODOS los pedidos (sin filtro de fecha)
                  let pedidoAsociado = todosLosPedidos.find(p => {
                    // Método 1: Buscar por lavadoraAsignada.lavadoraId (objeto anidado)
                    if (p.lavadoraAsignada?.lavadoraId === lavadora.id) {
                      console.log(`✅ Encontrado pedido por lavadoraId (objeto): ${lavadora.codigoQR} -> ${p.id}`);
                      return true;
                    }
                    
                    // Método 2: Buscar por código QR (objeto anidado)
                    if (p.lavadoraAsignada?.codigoQR === lavadora.codigoQR) {
                      console.log(`✅ Encontrado pedido por codigoQR (objeto): ${lavadora.codigoQR} -> ${p.id}`);
                      return true;
                    }
                    
                    // Método 3: Buscar por campos separados con guiones bajos
                    if ((p as any).lavadoraAsignada_lavadoraId === lavadora.id) {
                      console.log(`✅ Encontrado pedido por lavadoraId (campo): ${lavadora.codigoQR} -> ${p.id}`);
                      return true;
                    }
                    
                    // Método 4: Buscar por código QR en campos separados
                    if ((p as any).lavadoraAsignada_codigoQR === lavadora.codigoQR) {
                      console.log(`✅ Encontrado pedido por codigoQR (campo): ${lavadora.codigoQR} -> ${p.id}`);
                      return true;
                    }
                    
                    return false;
                  });

                  // Debug: Mostrar información de la lavadora y pedidos
                  if (lavadora.codigoQR === 'G-01') {
                    const primerPedido = todosLosPedidos[0];
                    console.log('🔍 Debug G-01:', {
                      lavadoraId: lavadora.id,
                      lavadoraEstado: lavadora.estado,
                      lavadoraCodigoQR: lavadora.codigoQR,
                      totalPedidos: todosLosPedidos.length,
                      pedidosConLavadoraAsignada: todosLosPedidos.filter(p => p.lavadoraAsignada).length,
                      pedidoAsociado: pedidoAsociado ? {
                        id: pedidoAsociado.id,
                        status: pedidoAsociado.status,
                        lavadoraAsignada: pedidoAsociado.lavadoraAsignada
                      } : null,
                      primerPedidoCampos: primerPedido ? {
                        id: primerPedido.id,
                        lavadoraAsignada_lavadoraId: (primerPedido as any).lavadoraAsignada_lavadoraId,
                        lavadoraAsignada_codigoQR: (primerPedido as any).lavadoraAsignada_codigoQR,
                        lavadoraAsignada_marca: (primerPedido as any).lavadoraAsignada_marca,
                        lavadoraAsignada_modelo: (primerPedido as any).lavadoraAsignada_modelo
                      } : null
                    });
                  }

                  // Si no se encuentra pedido asociado, la lavadora debería estar libre
                  // Solo mostrar como alquilada si realmente tiene un pedido asociado
                  if (!pedidoAsociado && lavadora.estado === 'alquilada') {
                    console.log('🔴 Lavadora marcada como alquilada pero sin pedido asociado:', lavadora.codigoQR);
                    // No asociar ningún pedido, la lavadora debería estar libre
                  }

                  // Función para calcular fecha de recogida según el plan
                  const calcularFechaRecogida = (fechaEntrega: Date, planName: string) => {
                    const fecha = new Date(fechaEntrega);
                    
                    switch (planName) {
                      case 'PLAN 1':
                        // 5 horas después de la entrega
                        fecha.setHours(fecha.getHours() + 5);
                        return fecha;
                        
                      case 'PLAN 2':
                        // Siguiente día a las 7 AM
                        fecha.setDate(fecha.getDate() + 1);
                        fecha.setHours(7, 0, 0, 0);
                        return fecha;
                        
                      case 'PLAN 3':
                        // 24 horas después (misma hora)
                        fecha.setDate(fecha.getDate() + 1);
                        return fecha;
                        
                      case 'PLAN 4':
                        // Lunes a las 7 AM (si es sábado)
                        const diasHastaLunes = fecha.getDay() === 6 ? 2 : (8 - fecha.getDay()) % 7;
                        fecha.setDate(fecha.getDate() + diasHastaLunes);
                        fecha.setHours(7, 0, 0, 0);
                        return fecha;
                        
                      case 'PLAN 5':
                        // Lunes a las 7 AM (si es sábado tarde)
                        const diasHastaLunesPlan5 = fecha.getDay() === 6 ? 2 : (8 - fecha.getDay()) % 7;
                        fecha.setDate(fecha.getDate() + diasHastaLunesPlan5);
                        fecha.setHours(7, 0, 0, 0);
                        return fecha;
                        
                      default:
                        return null;
                    }
                  };
                  
                  const getEstadoColor = () => {
                    // Si tiene pedido asociado, mostrar como alquilada independientemente del estado en Firebase
                    if (pedidoAsociado) {
                      return 'bg-red-100 border-red-300 text-red-800';
                    }
                    
                    // Si está marcada como alquilada pero no tiene pedido asociado, tratarla como libre
                    if (lavadora.estado === 'alquilada' && !pedidoAsociado) {
                      return 'bg-green-100 border-green-300 text-green-800';
                    }
                    
                    switch (lavadora.estado) {
                      case 'disponible':
                        return 'bg-green-100 border-green-300 text-green-800';
                      case 'alquilada':
                        return 'bg-red-100 border-red-300 text-red-800';
                      case 'mantenimiento':
                        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
                      case 'fuera_servicio':
                        return 'bg-gray-100 border-gray-300 text-gray-800';
                      default:
                        return 'bg-gray-100 border-gray-300 text-gray-800';
                    }
                  };

                  const getEstadoIcon = () => {
                    // Si tiene pedido asociado, mostrar como alquilada independientemente del estado en Firebase
                    if (pedidoAsociado) {
                      return '🔴';
                    }
                    
                    // Si está marcada como alquilada pero no tiene pedido asociado, tratarla como libre
                    if (lavadora.estado === 'alquilada' && !pedidoAsociado) {
                      return '🟢';
                    }
                    
                    switch (lavadora.estado) {
                      case 'disponible':
                        return '🟢';
                      case 'alquilada':
                        return '🔴';
                      case 'mantenimiento':
                        return '🟡';
                      case 'fuera_servicio':
                        return '⚫';
                      default:
                        return '⚪';
                    }
                  };

                  return (
                    <div
                      key={lavadora.id}
                      className={`border-2 rounded-lg p-4 transition-all duration-200 hover:shadow-md ${getEstadoColor()}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getEstadoIcon()}</span>
                          <h4 className="font-semibold text-lg">{lavadora.codigoQR}</h4>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor()}`}>
                          {pedidoAsociado ? 'Alquilada' :
                           lavadora.estado === 'disponible' ? 'Libre' :
                           lavadora.estado === 'mantenimiento' ? 'Mantenimiento' :
                           'Fuera de Servicio'}
                        </span>
                      </div>

                      {pedidoAsociado && (
                        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                          {pedidoAsociado ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-sm">
                                <div className="font-medium mb-1">Cliente:</div>
                                <div className="text-xs opacity-80">{pedidoAsociado.cliente.name}</div>
                              </div>
                              {pedidoAsociado.fechaEntrega && (
                                <div className="text-sm">
                                  <div className="font-medium mb-1">Entregado:</div>
                                  <div className="text-xs opacity-80">
                                    {formatDate(pedidoAsociado.fechaEntrega, 'dd/MM HH:mm')}
                                  </div>
                                </div>
                              )}
                              <div className="text-sm">
                                <div className="font-medium mb-1">Estado:</div>
                                <div className="text-xs opacity-80">{pedidoAsociado.status}</div>
                              </div>
                              {pedidoAsociado.fechaEntrega && pedidoAsociado.status === 'entregado' && (
                                <div className="text-sm">
                                  <div className="font-medium mb-1">Recogida programada:</div>
                                  <div className="text-xs opacity-80">
                                    {(() => {
                                      const fechaRecogida = calcularFechaRecogida(pedidoAsociado.fechaEntrega, pedidoAsociado.plan.name);
                                      return fechaRecogida ? formatDate(fechaRecogida, 'dd/MM HH:mm') : 'No calculable';
                                    })()}
                                  </div>
                                </div>
                              )}
                              <div className="text-sm">
                                <div className="font-medium mb-1">Plan:</div>
                                <div className="text-xs opacity-80">{pedidoAsociado.plan.name}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <div className="font-medium mb-1">Estado:</div>
                              <div className="text-xs opacity-80">Alquilada (sin pedido asociado)</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstadoLavadorasModal;

import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  PencilIcon, 
  TrashIcon,
  XMarkIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { pedidoService } from '../services/firebaseService';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';

interface PagoCompleto {
  id: string;
  pedidoId: string;
  servicioId: string;
  clienteName: string;
  planName: string;
  monto: number;
  medioPago: 'efectivo' | 'nequi' | 'daviplata';
  referencia?: string;
  fecha: Date;
  isPartial: boolean;
  saldoAnterior: number;
  saldoNuevo: number;
}

interface FiltrosPagos {
  tipo: 'todos' | 'hoy' | 'ayer' | 'personalizado';
  fechaInicio: Date;
  fechaFin: Date;
  medioPago: 'todos' | 'efectivo' | 'nequi' | 'daviplata';
  busqueda: string;
}

const Pagos: React.FC = () => {
  const [pagos, setPagos] = useState<PagoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosPagos>({
    tipo: 'todos',
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia(),
    medioPago: 'todos',
    busqueda: ''
  });
  
  // Estados para modales
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [pagoAEditar, setPagoAEditar] = useState<PagoCompleto | null>(null);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [pagoAEliminar, setPagoAEliminar] = useState<PagoCompleto | null>(null);

  useEffect(() => {
    cargarPagos();
  }, [filtros]);

  const cargarPagos = async () => {
    setLoading(true);
    try {
      let fechaInicio: Date;
      let fechaFin: Date;

      if (filtros.tipo === 'hoy') {
        fechaInicio = getCurrentDateColombia();
        fechaFin = getCurrentDateColombia();
      } else if (filtros.tipo === 'ayer') {
        const ayer = new Date(getCurrentDateColombia());
        ayer.setDate(ayer.getDate() - 1);
        fechaInicio = ayer;
        fechaFin = ayer;
      } else if (filtros.tipo === 'todos') {
        // Para "todos", usar un rango muy amplio
        fechaInicio = new Date('2020-01-01');
        fechaFin = new Date('2030-12-31');
      } else {
        fechaInicio = filtros.fechaInicio;
        fechaFin = filtros.fechaFin;
      }

      // Normalizar fechas para comparación
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);

      console.log('🔍 Debug Pagos - Filtros:', {
        tipo: filtros.tipo,
        fechaInicio: fechaInicio.toISOString(),
        fechaFin: fechaFin.toISOString()
      });

      const pedidos = await pedidoService.getAllPedidos();
      console.log('📊 Total pedidos encontrados:', pedidos.length);
      
      // Debug: Mostrar todos los pedidos con pagos
      const pedidosConPagos = pedidos.filter(p => p.pagosRealizados && p.pagosRealizados.length > 0);
      console.log('📋 Pedidos con pagos:', pedidosConPagos.length);
      pedidosConPagos.forEach(pedido => {
        console.log(`📋 Pedido ${pedido.id.slice(-6)} (${pedido.cliente.name}):`, {
          totalPagos: pedido.pagosRealizados?.length || 0,
          pagos: pedido.pagosRealizados?.map(p => ({
            monto: p.monto,
            fecha: p.fecha,
            medioPago: p.medioPago
          }))
        });
      });
      
      const todosLosPagos: PagoCompleto[] = [];

      // Recopilar todos los pagos de los pedidos
      pedidos.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          console.log(`📋 Pedido ${pedido.id.slice(-6)} tiene ${pedido.pagosRealizados.length} pagos`);
          pedido.pagosRealizados.forEach((pago, index) => {
            // Manejar correctamente los timestamps de Firebase
            let fechaPago: Date;
            if (pago.fecha instanceof Date) {
              fechaPago = pago.fecha;
            } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
              fechaPago = (pago.fecha as any).toDate();
            } else {
              fechaPago = new Date(pago.fecha);
            }
            
            console.log(`💰 Pago ${index + 1}: ${formatCurrency(pago.monto)} - ${fechaPago.toISOString()}`);
            console.log(`🔍 Comparación de fechas:`, {
              fechaPago: fechaPago.toISOString(),
              fechaInicio: fechaInicio.toISOString(),
              fechaFin: fechaFin.toISOString(),
              cumpleFiltro: fechaPago >= fechaInicio && fechaPago <= fechaFin
            });
            if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
              // Calcular saldos
              const pagosAnteriores = pedido.pagosRealizados?.slice(0, index) || [];
              const saldoAnterior = pedido.total - pagosAnteriores.reduce((sum, p) => sum + p.monto, 0);
              const saldoNuevo = saldoAnterior - pago.monto;

              todosLosPagos.push({
                id: `${pedido.id}-${index}`,
                pedidoId: pedido.id,
                servicioId: pedido.id.slice(-6),
                clienteName: pedido.cliente.name,
                planName: pedido.plan.name,
                monto: pago.monto,
                medioPago: pago.medioPago,
                referencia: pago.referencia,
                fecha: fechaPago,
                isPartial: pago.isPartial,
                saldoAnterior,
                saldoNuevo
              });
            }
          });
        }
      });

      // Aplicar filtros adicionales
      let pagosFiltrados = todosLosPagos;

      if (filtros.medioPago !== 'todos') {
        pagosFiltrados = pagosFiltrados.filter(p => p.medioPago === filtros.medioPago);
      }

      if (filtros.busqueda.trim()) {
        const busqueda = filtros.busqueda.toLowerCase();
        pagosFiltrados = pagosFiltrados.filter(p => 
          p.clienteName.toLowerCase().includes(busqueda) ||
          p.planName.toLowerCase().includes(busqueda) ||
          p.servicioId.toLowerCase().includes(busqueda) ||
          (p.referencia && p.referencia.toLowerCase().includes(busqueda))
        );
      }

      // Ordenar por fecha (más recientes primero)
      pagosFiltrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      console.log('✅ Pagos finales encontrados:', pagosFiltrados.length);
      console.log('📋 Pagos finales:', pagosFiltrados.map(p => ({
        id: p.id,
        cliente: p.clienteName,
        monto: p.monto,
        fecha: p.fecha.toISOString(),
        medioPago: p.medioPago
      })));
      setPagos(pagosFiltrados);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
    } finally {
      setLoading(false);
    }
  };

  const editarPago = (pago: PagoCompleto) => {
    setPagoAEditar(pago);
    setMostrarModalEditar(true);
  };

  const eliminarPago = (pago: PagoCompleto) => {
    setPagoAEliminar(pago);
    setMostrarModalEliminar(true);
  };

  const handleEditarPago = async (pagoEditado: Partial<PagoCompleto>) => {
    if (!pagoAEditar) return;

    try {
      // Obtener el pedido actual
      const pedidos = await pedidoService.getAllPedidos();
      const pedido = pedidos.find(p => p.id === pagoAEditar.pedidoId);
      
      if (!pedido || !pedido.pagosRealizados) return;

      // Encontrar el índice del pago a editar
      const pagoIndex = pedido.pagosRealizados.findIndex((p, index) => 
        `${pedido.id}-${index}` === pagoAEditar.id
      );

      if (pagoIndex === -1) return;

      // Actualizar el pago
      const pagosActualizados = [...pedido.pagosRealizados];
      pagosActualizados[pagoIndex] = {
        ...pagosActualizados[pagoIndex],
        monto: pagoEditado.monto || pagosActualizados[pagoIndex].monto,
        medioPago: pagoEditado.medioPago || pagosActualizados[pagoIndex].medioPago,
        referencia: pagoEditado.referencia,
        fecha: pagoEditado.fecha || pagosActualizados[pagoIndex].fecha
      };

      // Recalcular saldo pendiente
      const nuevoSaldoPendiente = Math.max(0, pedido.total - pagosActualizados.reduce((sum, p) => sum + p.monto, 0));

      // Actualizar el pedido
      await pedidoService.updatePedido(pedido.id, {
        pagosRealizados: pagosActualizados,
        saldoPendiente: nuevoSaldoPendiente,
        estadoPago: nuevoSaldoPendiente === 0 ? 'pagado_recogida' : 'debe'
      });

      // Recargar pagos
      await cargarPagos();
      setMostrarModalEditar(false);
      setPagoAEditar(null);
      
      // Disparar evento para recargar dashboard
      window.dispatchEvent(new CustomEvent('pagoRealizado'));
    } catch (error) {
      console.error('Error al editar pago:', error);
      alert('Error al editar el pago');
    }
  };

  const handleEliminarPago = async () => {
    if (!pagoAEliminar) return;

    try {
      // Obtener el pedido actual
      const pedidos = await pedidoService.getAllPedidos();
      const pedido = pedidos.find(p => p.id === pagoAEliminar.pedidoId);
      
      if (!pedido || !pedido.pagosRealizados) return;

      // Encontrar el índice del pago a eliminar
      const pagoIndex = pedido.pagosRealizados.findIndex((p, index) => 
        `${pedido.id}-${index}` === pagoAEliminar.id
      );

      if (pagoIndex === -1) return;

      // Eliminar el pago
      const pagosActualizados = pedido.pagosRealizados.filter((_, index) => index !== pagoIndex);

      // Recalcular saldo pendiente
      const nuevoSaldoPendiente = Math.max(0, pedido.total - pagosActualizados.reduce((sum, p) => sum + p.monto, 0));

      // Actualizar el pedido
      await pedidoService.updatePedido(pedido.id, {
        pagosRealizados: pagosActualizados,
        saldoPendiente: nuevoSaldoPendiente,
        estadoPago: nuevoSaldoPendiente === 0 ? 'pagado_recogida' : 'debe'
      });

      // Recargar pagos
      await cargarPagos();
      setMostrarModalEliminar(false);
      setPagoAEliminar(null);
      
      // Disparar evento para recargar dashboard
      window.dispatchEvent(new CustomEvent('pagoRealizado'));
    } catch (error) {
      console.error('Error al eliminar pago:', error);
      alert('Error al eliminar el pago');
    }
  };

  const getBadgeColor = (medioPago: string) => {
    switch (medioPago) {
      case 'efectivo': return 'bg-green-100 text-green-800';
      case 'nequi': return 'bg-blue-100 text-blue-800';
      case 'daviplata': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getIcon = (medioPago: string) => {
    switch (medioPago) {
      case 'efectivo': return '💵';
      case 'nequi': return '📱';
      case 'daviplata': return '📱';
      default: return '💰';
    }
  };

  const totalPagos = pagos.reduce((sum, p) => sum + p.monto, 0);
  const totalEfectivo = pagos.filter(p => p.medioPago === 'efectivo').reduce((sum, p) => sum + p.monto, 0);
  const totalNequi = pagos.filter(p => p.medioPago === 'nequi').reduce((sum, p) => sum + p.monto, 0);
  const totalDaviplata = pagos.filter(p => p.medioPago === 'daviplata').reduce((sum, p) => sum + p.monto, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">
            Gestión de Pagos
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Administra todos los pagos recibidos
          </p>
        </div>
        <button
          onClick={async () => {
            console.log('🔍 Debug Manual - Cargando todos los pedidos...');
            const pedidos = await pedidoService.getAllPedidos();
            console.log('📊 Total pedidos:', pedidos.length);
            pedidos.forEach(pedido => {
              if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
                console.log(`📋 Pedido ${pedido.id.slice(-6)}:`, {
                  cliente: pedido.cliente.name,
                  total: pedido.total,
                  saldoPendiente: pedido.saldoPendiente,
                  pagos: pedido.pagosRealizados.map(p => ({
                    monto: p.monto,
                    fecha: p.fecha,
                    medioPago: p.medioPago
                  }))
                });
              }
            });
          }}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
        >
          🔍 Debug
        </button>
      </div>

      {/* Resumen de pagos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Total Recibido</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(totalPagos)}</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
          <p className="text-xs text-blue-600 mt-1">{pagos.length} pago{pagos.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Efectivo</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(totalEfectivo)}</p>
            </div>
            <div className="text-2xl">💵</div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Nequi</p>
              <p className="text-xl font-bold text-blue-900">{formatCurrency(totalNequi)}</p>
            </div>
            <div className="text-2xl">📱</div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-800">Daviplata</p>
              <p className="text-xl font-bold text-purple-900">{formatCurrency(totalDaviplata)}</p>
            </div>
            <div className="text-2xl">📱</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          {/* Filtro de fecha */}
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-4 w-4 text-gray-500" />
            <select
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
              value={filtros.tipo}
              onChange={(e) => {
                const tipo = e.target.value as 'todos' | 'hoy' | 'ayer' | 'personalizado';
                setFiltros(prev => ({ ...prev, tipo }));
              }}
            >
              <option value="todos">Todos</option>
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="personalizado">Rango Personalizado</option>
            </select>
          </div>

          {/* Fechas personalizadas */}
          {filtros.tipo === 'personalizado' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                value={filtros.fechaInicio.toISOString().split('T')[0]}
                onChange={(e) => setFiltros(prev => ({ 
                  ...prev, 
                  fechaInicio: new Date(e.target.value) 
                }))}
              />
              <span className="text-gray-500">a</span>
              <input
                type="date"
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                value={filtros.fechaFin.toISOString().split('T')[0]}
                onChange={(e) => setFiltros(prev => ({ 
                  ...prev, 
                  fechaFin: new Date(e.target.value) 
                }))}
              />
            </div>
          )}

          {/* Filtro de medio de pago */}
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
            value={filtros.medioPago}
            onChange={(e) => setFiltros(prev => ({ 
              ...prev, 
              medioPago: e.target.value as any 
            }))}
          >
            <option value="todos">Todos los medios</option>
            <option value="efectivo">💵 Efectivo</option>
            <option value="nequi">📱 Nequi</option>
            <option value="daviplata">📱 Daviplata</option>
          </select>

          {/* Búsqueda */}
          <div className="flex items-center space-x-2">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por cliente, plan, servicio..."
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:ring-primary-500 focus:border-primary-500"
              value={filtros.busqueda}
              onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Lista de pagos */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : pagos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💳</div>
            <p>No se encontraron pagos para los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pagos.map((pago) => (
              <div key={pago.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      pago.medioPago === 'efectivo' ? 'bg-green-500' :
                      pago.medioPago === 'nequi' ? 'bg-blue-500' :
                      'bg-purple-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {pago.clienteName} - {pago.planName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Servicio #{pago.servicioId} • {formatDate(pago.fecha, 'dd/MM/yyyy HH:mm')}
                      </p>
                      {pago.referencia && (
                        <p className="text-xs text-gray-500">Ref: {pago.referencia}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(pago.medioPago)}`}>
                          {getIcon(pago.medioPago)} {pago.medioPago.charAt(0).toUpperCase() + pago.medioPago.slice(1)}
                        </span>
                        {pago.isPartial && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                            Abono Parcial
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(pago.monto)}</p>
                      <p className="text-xs text-gray-500">
                        Saldo: {formatCurrency(pago.saldoAnterior)} → {formatCurrency(pago.saldoNuevo)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => editarPago(pago)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar pago"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => eliminarPago(pago)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar pago"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de editar pago */}
      {mostrarModalEditar && pagoAEditar && (
        <ModalEditarPago
          pago={pagoAEditar}
          onClose={() => {
            setMostrarModalEditar(false);
            setPagoAEditar(null);
          }}
          onSave={handleEditarPago}
        />
      )}

      {/* Modal de eliminar pago */}
      {mostrarModalEliminar && pagoAEliminar && (
        <ModalEliminarPago
          pago={pagoAEliminar}
          onClose={() => {
            setMostrarModalEliminar(false);
            setPagoAEliminar(null);
          }}
          onConfirm={handleEliminarPago}
        />
      )}
    </div>
  );
};

// Modal para editar pago
const ModalEditarPago: React.FC<{
  pago: PagoCompleto;
  onClose: () => void;
  onSave: (pago: Partial<PagoCompleto>) => void;
}> = ({ pago, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    monto: pago.monto,
    medioPago: pago.medioPago,
    referencia: pago.referencia || '',
    fecha: pago.fecha.toISOString().slice(0, 16)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      monto: formData.monto,
      medioPago: formData.medioPago,
      referencia: formData.referencia.trim() || undefined,
      fecha: new Date(formData.fecha)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">Editar Pago</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto *
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={formData.monto}
              onChange={(e) => setFormData(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medio de Pago *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['efectivo', 'nequi', 'daviplata'].map((medio) => (
                <button
                  key={medio}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, medioPago: medio as any }))}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    formData.medioPago === medio
                      ? medio === 'efectivo' ? 'bg-green-50 border-green-500 text-green-700' :
                        medio === 'nequi' ? 'bg-blue-50 border-blue-500 text-blue-700' :
                        'bg-purple-50 border-purple-500 text-purple-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {medio === 'efectivo' ? '💵 Efectivo' :
                   medio === 'nequi' ? '📱 Nequi' :
                   '📱 Daviplata'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia/Comprobante
            </label>
            <input
              type="text"
              value={formData.referencia}
              onChange={(e) => setFormData(prev => ({ ...prev, referencia: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Número de comprobante, referencia, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y Hora *
            </label>
            <input
              type="datetime-local"
              value={formData.fecha}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal para eliminar pago
const ModalEliminarPago: React.FC<{
  pago: PagoCompleto;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ pago, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">Eliminar Pago</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            ¿Estás seguro de que quieres eliminar este pago?
          </p>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="font-medium text-gray-900">{pago.clienteName} - {pago.planName}</p>
            <p className="text-sm text-gray-600">Servicio #{pago.servicioId}</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(pago.monto)}</p>
            <p className="text-sm text-gray-500">{formatDate(pago.fecha, 'dd/MM/yyyy HH:mm')}</p>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pagos;

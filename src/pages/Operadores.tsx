import React, { useState, useEffect } from 'react';
import { 
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { pedidoService, gastoService } from '../services/firebaseService';
import { obtenerTodosLosMantenimientos } from '../services/mantenimientoService';
import { Pedido, Gasto, Mantenimiento, PagoRealizado } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';

interface FiltrosOperadores {
  fechaInicio: Date;
  fechaFin: Date;
  tipoFiltro: 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';
}

const Operadores: React.FC = () => {
  const fechaHoyBase = getCurrentDateColombia();
  const fechaHoy = new Date(fechaHoyBase);
  fechaHoy.setHours(0, 0, 0, 0);
  
  const [filtros, setFiltros] = useState<FiltrosOperadores>({
    fechaInicio: new Date(fechaHoy),
    fechaFin: new Date(fechaHoy),
    tipoFiltro: 'hoy'
  });

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuarioExpandido, setUsuarioExpandido] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, [filtros]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar pedidos del rango de fechas
      const pedidosPromises = [];
      const fechaActual = new Date(filtros.fechaInicio);
      fechaActual.setHours(0, 0, 0, 0);
      
      const fechaFin = new Date(filtros.fechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      
      while (fechaActual <= fechaFin) {
        pedidosPromises.push(pedidoService.getPedidosDelDia(new Date(fechaActual)));
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      
      const pedidosArrays = await Promise.all(pedidosPromises);
      const pedidosConDuplicados = pedidosArrays.flat();
      
      // Eliminar duplicados
      const pedidosUnicos = pedidosConDuplicados.reduce((acc, pedido) => {
        if (!acc.find(p => p.id === pedido.id)) {
          acc.push(pedido);
        }
        return acc;
      }, [] as Pedido[]);
      
      setPedidos(pedidosUnicos);

      // Cargar gastos del rango de fechas
      const gastosPromises = [];
      const fechaActualGastos = new Date(filtros.fechaInicio);
      fechaActualGastos.setHours(0, 0, 0, 0);
      const fechaFinGastos = new Date(filtros.fechaFin);
      fechaFinGastos.setHours(23, 59, 59, 999);
      
      while (fechaActualGastos <= fechaFinGastos) {
        gastosPromises.push(gastoService.getGastosDelDia(new Date(fechaActualGastos)));
        fechaActualGastos.setDate(fechaActualGastos.getDate() + 1);
      }
      
      const gastosArrays = await Promise.all(gastosPromises);
      const todosLosGastos = gastosArrays.flat();
      setGastos(todosLosGastos);

      // Cargar mantenimientos del rango de fechas
      const todosLosMantenimientos = await obtenerTodosLosMantenimientos();
      const fechaInicioMant = new Date(filtros.fechaInicio);
      fechaInicioMant.setHours(0, 0, 0, 0);
      const fechaFinMant = new Date(filtros.fechaFin);
      fechaFinMant.setHours(23, 59, 59, 999);
      
      const mantenimientosFiltrados = todosLosMantenimientos.filter(mant => {
        const fechaMant = mant.fechaInicio;
        return fechaMant >= fechaInicioMant && fechaMant <= fechaFinMant;
      });
      
      setMantenimientos(mantenimientosFiltrados);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular arqueo por usuario
  const calcularArqueoPorUsuario = () => {
    interface DetallePago {
      fecha: Date;
      cliente: string;
      monto: number;
      medioPago: 'efectivo' | 'nequi' | 'daviplata';
      referencia?: string;
    }

    interface DetalleGasto {
      fecha: Date;
      concepto: string;
      monto: number;
      medioPago: 'efectivo' | 'nequi' | 'daviplata';
      descripcion?: string;
    }

    interface DetalleMantenimiento {
      fecha: Date;
      tipoFalla: string;
      monto: number;
      medioPago: 'efectivo' | 'nequi' | 'daviplata';
      descripcion?: string;
    }

    interface ArqueoUsuario {
      usuario: string;
      ingresos: {
        total: number;
        detalles: DetallePago[];
      };
      gastos: {
        total: number;
        detallesGastos: DetalleGasto[];
        detallesMantenimientos: DetalleMantenimiento[];
      };
      saldo: number;
    }

    const fechaInicio = new Date(filtros.fechaInicio);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(filtros.fechaFin);
    fechaFin.setHours(23, 59, 59, 999);

    const arqueosPorUsuario = new Map<string, ArqueoUsuario>();

    // Procesar pagos
    console.log('🔍 Calculando arqueo - Total pedidos:', pedidos.length);
    let totalPagosEncontrados = 0;
    let pagosFiltrados = 0;
    
    pedidos.forEach(pedido => {
      if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
        totalPagosEncontrados += pedido.pagosRealizados.length;
        pedido.pagosRealizados.forEach((pago: any) => {
          // Convertir fecha correctamente (puede ser Date, Timestamp de Firebase, o string)
          let fechaPago: Date;
          if (pago.fecha instanceof Date) {
            fechaPago = pago.fecha;
          } else if (pago.fecha?.toDate) {
            // Timestamp de Firebase
            fechaPago = pago.fecha.toDate();
          } else if (pago.fecha) {
            fechaPago = new Date(pago.fecha);
          } else {
            // Si no hay fecha, usar fecha de creación del pedido como fallback
            fechaPago = pedido.createdAt || new Date();
          }

          // Normalizar la fecha (solo fecha, sin hora) para comparación
          const fechaPagoNormalizada = new Date(fechaPago);
          fechaPagoNormalizada.setHours(0, 0, 0, 0);

          console.log('📊 Pago encontrado:', {
            cliente: pedido.cliente.name,
            monto: pago.monto,
            fecha: fechaPago,
            fechaNormalizada: fechaPagoNormalizada,
            rangoInicio: fechaInicio,
            rangoFin: fechaFin,
            enRango: fechaPagoNormalizada >= fechaInicio && fechaPagoNormalizada <= fechaFin,
            registradoPor: pago.registradoPor,
            tieneUsuario: !!pago.registradoPor
          });

          // Verificar que el pago esté en el rango de fechas y tenga usuario registrado
          if (fechaPagoNormalizada >= fechaInicio && fechaPagoNormalizada <= fechaFin && pago.registradoPor) {
            pagosFiltrados++;
            if (!arqueosPorUsuario.has(pago.registradoPor)) {
              arqueosPorUsuario.set(pago.registradoPor, {
                usuario: pago.registradoPor,
                ingresos: { total: 0, detalles: [] },
                gastos: { total: 0, detallesGastos: [], detallesMantenimientos: [] },
                saldo: 0
              });
            }
            const arqueo = arqueosPorUsuario.get(pago.registradoPor)!;
            arqueo.ingresos.total += pago.monto || 0;
            arqueo.ingresos.detalles.push({
              fecha: fechaPago,
              cliente: pedido.cliente.name,
              monto: pago.monto || 0,
              medioPago: pago.medioPago || 'efectivo',
              referencia: pago.referencia
            });
          }
        });
      }
    });

    // Procesar gastos
    gastos.forEach(gasto => {
      if (gasto.registradoPor) {
        const fechaGasto = gasto.date;
        // Verificar que el gasto esté en el rango de fechas
        if (fechaGasto >= fechaInicio && fechaGasto <= fechaFin) {
          if (!arqueosPorUsuario.has(gasto.registradoPor)) {
            arqueosPorUsuario.set(gasto.registradoPor, {
              usuario: gasto.registradoPor,
              ingresos: { total: 0, detalles: [] },
              gastos: { total: 0, detallesGastos: [], detallesMantenimientos: [] },
              saldo: 0
            });
          }
          const arqueo = arqueosPorUsuario.get(gasto.registradoPor)!;
          arqueo.gastos.total += gasto.amount;
          arqueo.gastos.detallesGastos.push({
            fecha: fechaGasto,
            concepto: typeof gasto.concepto === 'object' ? gasto.concepto.name : gasto.concepto || 'Gasto General',
            monto: gasto.amount,
            medioPago: gasto.medioPago || 'efectivo',
            descripcion: gasto.description
          });
        }
      }
    });

    // Procesar mantenimientos
    mantenimientos.forEach(mant => {
      if (mant.registradoPor) {
        const fechaMant = mant.fechaInicio;
        // Verificar que el mantenimiento esté en el rango de fechas
        if (fechaMant >= fechaInicio && fechaMant <= fechaFin) {
          if (!arqueosPorUsuario.has(mant.registradoPor)) {
            arqueosPorUsuario.set(mant.registradoPor, {
              usuario: mant.registradoPor,
              ingresos: { total: 0, detalles: [] },
              gastos: { total: 0, detallesGastos: [], detallesMantenimientos: [] },
              saldo: 0
            });
          }
          const arqueo = arqueosPorUsuario.get(mant.registradoPor)!;
          arqueo.gastos.total += mant.costoReparacion;
          arqueo.gastos.detallesMantenimientos.push({
            fecha: fechaMant,
            tipoFalla: mant.tipoFalla,
            monto: mant.costoReparacion,
            medioPago: mant.medioPago || 'efectivo',
            descripcion: mant.descripcion
          });
        }
      }
    });

    // Calcular saldo final para cada usuario
    const arqueos = Array.from(arqueosPorUsuario.values());
    arqueos.forEach(arqueo => {
      arqueo.saldo = arqueo.ingresos.total - arqueo.gastos.total;
    });

    // Ordenar por nombre de usuario
    arqueos.sort((a, b) => a.usuario.localeCompare(b.usuario));

    console.log('✅ Arqueo calculado:', {
      totalPagosEncontrados,
      pagosFiltrados,
      totalUsuarios: arqueos.length,
      usuarios: arqueos.map(a => ({
        usuario: a.usuario,
        ingresos: a.ingresos.total,
        gastos: a.gastos.total,
        saldo: a.saldo,
        detallesIngresos: a.ingresos.detalles.length,
        detallesGastos: a.gastos.detallesGastos.length,
        detallesMantenimientos: a.gastos.detallesMantenimientos.length
      }))
    });

    return arqueos;
  };

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer' | 'semana' | 'mes') => {
    const hoyBase = getCurrentDateColombia();
    const hoy = new Date(hoyBase);
    hoy.setHours(0, 0, 0, 0);
    
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);
    
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    inicioSemana.setHours(0, 0, 0, 0);
    
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    switch (tipo) {
      case 'hoy':
        setFiltros({ fechaInicio: hoy, fechaFin: hoy, tipoFiltro: 'hoy' });
        break;
      case 'ayer':
        setFiltros({ fechaInicio: ayer, fechaFin: ayer, tipoFiltro: 'ayer' });
        break;
      case 'semana':
        setFiltros({ fechaInicio: inicioSemana, fechaFin: hoy, tipoFiltro: 'semana' });
        break;
      case 'mes':
        setFiltros({ fechaInicio: inicioMes, fechaFin: hoy, tipoFiltro: 'mes' });
        break;
    }
  };

  const arqueosPorUsuario = calcularArqueoPorUsuario();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">
            Arqueo de Operadores
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Control de ingresos, gastos y mantenimientos por operador
          </p>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros Rápidos</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => aplicarFiltroRapido('hoy')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtros.tipoFiltro === 'hoy'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarFiltroRapido('ayer')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtros.tipoFiltro === 'ayer'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Ayer
          </button>
          <button
            onClick={() => aplicarFiltroRapido('semana')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtros.tipoFiltro === 'semana'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => aplicarFiltroRapido('mes')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filtros.tipoFiltro === 'mes'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Este Mes
          </button>
        </div>
      </div>

      {/* Filtros avanzados */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros de Fecha</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              className="input-field"
              value={filtros.fechaInicio.toISOString().split('T')[0]}
              onChange={(e) => {
                const nuevaFecha = new Date(e.target.value);
                nuevaFecha.setHours(0, 0, 0, 0);
                setFiltros(prev => ({ 
                  ...prev, 
                  fechaInicio: nuevaFecha,
                  tipoFiltro: 'personalizado'
                }));
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              className="input-field"
              value={filtros.fechaFin.toISOString().split('T')[0]}
              onChange={(e) => {
                const nuevaFecha = new Date(e.target.value);
                nuevaFecha.setHours(0, 0, 0, 0);
                setFiltros(prev => ({ 
                  ...prev, 
                  fechaFin: nuevaFecha,
                  tipoFiltro: 'personalizado'
                }));
              }}
            />
          </div>
        </div>
      </div>

      {/* Reporte de Arqueo por Usuario */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Arqueo por Usuario</h3>
        {arqueosPorUsuario.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No hay movimientos registrados por usuarios en el período seleccionado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {arqueosPorUsuario.map((arqueo) => (
              <div key={arqueo.usuario} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header del usuario */}
                <div 
                  className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setUsuarioExpandido(usuarioExpandido === arqueo.usuario ? null : arqueo.usuario)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">
                          {arqueo.usuario.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{arqueo.usuario}</h4>
                        <p className="text-sm text-gray-500">
                          {arqueo.ingresos.detalles.length} pago(s) • {arqueo.gastos.detallesGastos.length + arqueo.gastos.detallesMantenimientos.length} gasto(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(arqueo.saldo)}
                      </div>
                      <div className="text-sm text-gray-500">Saldo</div>
                    </div>
                  </div>
                </div>

                {/* Detalles expandibles */}
                {usuarioExpandido === arqueo.usuario && (
                  <div className="p-4 bg-white space-y-4">
                    {/* Ingresos */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-md font-semibold text-green-700">Ingresos</h5>
                        <span className="text-md font-bold text-green-600">
                          {formatCurrency(arqueo.ingresos.total)}
                        </span>
                      </div>
                      {arqueo.ingresos.detalles.length > 0 ? (
                        <div className="space-y-2 pl-4 border-l-2 border-green-200">
                          {arqueo.ingresos.detalles.map((pago, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{pago.cliente}</div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(pago.fecha, 'dd/MM/yyyy HH:mm')}
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                    {pago.medioPago === 'efectivo' ? '💰 Efectivo' : 
                                     pago.medioPago === 'nequi' ? '📱 Nequi' : 
                                     pago.medioPago === 'daviplata' ? '💳 Daviplata' : pago.medioPago}
                                  </span>
                                  {pago.referencia && ` • Ref: ${pago.referencia}`}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-green-600">
                                {formatCurrency(pago.monto)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 pl-4">No hay ingresos registrados</p>
                      )}
                    </div>

                    {/* Gastos */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-md font-semibold text-red-700">Gastos</h5>
                        <span className="text-md font-bold text-red-600">
                          {formatCurrency(arqueo.gastos.total)}
                        </span>
                      </div>
                      
                      {/* Gastos generales */}
                      {arqueo.gastos.detallesGastos.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-600 mb-1 pl-4">Gastos Generales</div>
                          <div className="space-y-2 pl-4 border-l-2 border-red-200">
                            {arqueo.gastos.detallesGastos.map((gasto, index) => (
                              <div key={`gasto-${index}`} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">{gasto.concepto}</div>
                                  <div className="text-xs text-gray-500">
                                    {formatDate(gasto.fecha, 'dd/MM/yyyy HH:mm')}
                                    <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                      {gasto.medioPago === 'efectivo' ? '💰 Efectivo' : 
                                       gasto.medioPago === 'nequi' ? '📱 Nequi' : 
                                       gasto.medioPago === 'daviplata' ? '💳 Daviplata' : gasto.medioPago}
                                    </span>
                                    {gasto.descripcion && ` • ${gasto.descripcion}`}
                                  </div>
                                </div>
                                <div className="text-sm font-semibold text-red-600">
                                  {formatCurrency(gasto.monto)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mantenimientos */}
                      {arqueo.gastos.detallesMantenimientos.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1 pl-4">Mantenimientos</div>
                          <div className="space-y-2 pl-4 border-l-2 border-red-200">
                            {arqueo.gastos.detallesMantenimientos.map((mant, index) => (
                              <div key={`mant-${index}`} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">Mantenimiento - {mant.tipoFalla}</div>
                                  <div className="text-xs text-gray-500">
                                    {formatDate(mant.fecha, 'dd/MM/yyyy HH:mm')}
                                    <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                      {mant.medioPago === 'efectivo' ? '💰 Efectivo' : 
                                       mant.medioPago === 'nequi' ? '📱 Nequi' : 
                                       mant.medioPago === 'daviplata' ? '💳 Daviplata' : mant.medioPago}
                                    </span>
                                    {mant.descripcion && ` • ${mant.descripcion}`}
                                  </div>
                                </div>
                                <div className="text-sm font-semibold text-red-600">
                                  {formatCurrency(mant.monto)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {arqueo.gastos.detallesGastos.length === 0 && arqueo.gastos.detallesMantenimientos.length === 0 && (
                        <p className="text-sm text-gray-400 pl-4">No hay gastos registrados</p>
                      )}
                    </div>

                    {/* Resumen */}
                    <div className="border-t pt-4 mt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Ingresos</div>
                          <div className="text-lg font-semibold text-green-600">
                            {formatCurrency(arqueo.ingresos.total)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Gastos</div>
                          <div className="text-lg font-semibold text-red-600">
                            {formatCurrency(arqueo.gastos.total)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Saldo Final</div>
                          <div className={`text-lg font-bold ${arqueo.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(arqueo.saldo)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Operadores;


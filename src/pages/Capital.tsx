import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CalendarIcon,
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { pedidoService, gastoService } from '../services/firebaseService';
import { obtenerMantenimientosActivos } from '../services/mantenimientoService';
import { Pedido, Gasto, Mantenimiento } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';

interface FiltrosCapital {
  fechaInicio: Date;
  fechaFin: Date;
  tipo: 'hoy' | 'ayer' | 'personalizado';
}

interface MovimientoLibroDiario {
  id: string;
  fecha: Date;
  hora: string;
  tipo: 'ingreso' | 'gasto';
  concepto: string;
  monto: number;
  medioPago: 'efectivo' | 'nequi' | 'daviplata';
  cliente?: string;
  plan?: string;
  referencia?: string;
}

interface SaldoMedioPago {
  efectivo: number;
  nequi: number;
  daviplata: number;
}

const Capital: React.FC = () => {
  const [movimientos, setMovimientos] = useState<MovimientoLibroDiario[]>([]);
  const [saldos, setSaldos] = useState<SaldoMedioPago>({
    efectivo: 0,
    nequi: 0,
    daviplata: 0
  });
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosCapital>({
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia(),
    tipo: 'hoy'
  });

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      // Obtener pedidos del rango de fechas
      const pedidos = await pedidoService.getAllPedidos();
      const pedidosFiltrados = pedidos.filter(pedido => {
        const fechaPedido = new Date(pedido.fechaAsignacion);
        const fechaInicio = new Date(filtros.fechaInicio);
        const fechaFin = new Date(filtros.fechaFin);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin.setHours(23, 59, 59, 999);
        return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
      });

      // Obtener gastos del rango de fechas
      const gastos = await gastoService.getGastosDelRango(filtros.fechaInicio, filtros.fechaFin);
      
      // Obtener mantenimientos del rango de fechas (temporalmente deshabilitado por índice de Firebase)
      const mantenimientosFiltrados: Mantenimiento[] = [];
      console.log('⚠️ Mantenimientos temporalmente deshabilitados - requiere índice de Firebase');

      // Procesar movimientos de ingresos (pagos de pedidos)
      const movimientosIngresos: MovimientoLibroDiario[] = [];
      pedidosFiltrados.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          pedido.pagosRealizados.forEach(pago => {
            const fechaPago = new Date(pago.fecha);
            if (!isNaN(fechaPago.getTime())) {
              movimientosIngresos.push({
                id: `${pedido.id}-${pago.fecha}`,
                fecha: fechaPago,
                hora: fechaPago.toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }),
                tipo: 'ingreso',
                concepto: `Pago servicio - ${pedido.plan.name}`,
                monto: pago.monto,
                medioPago: pago.medioPago,
                cliente: pedido.cliente.name,
                plan: pedido.plan.name,
                referencia: pago.referencia
              });
            }
          });
        }
      });

      // Procesar movimientos de gastos generales
      const movimientosGastos: MovimientoLibroDiario[] = [];
      gastos.forEach(gasto => {
        const fechaGasto = new Date(gasto.date);
        if (!isNaN(fechaGasto.getTime())) {
          movimientosGastos.push({
            id: `gasto-${gasto.id}`,
            fecha: fechaGasto,
            hora: fechaGasto.toLocaleTimeString('es-CO', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            tipo: 'gasto',
            concepto: gasto.concepto.name,
            monto: gasto.amount,
            medioPago: gasto.medioPago,
            referencia: gasto.description
          });
        }
      });

      // Procesar movimientos de mantenimiento
      mantenimientosFiltrados.forEach(mant => {
        const fechaMant = new Date(mant.fechaInicio);
        if (!isNaN(fechaMant.getTime())) {
          movimientosGastos.push({
            id: `mant-${mant.id}`,
            fecha: fechaMant,
            hora: fechaMant.toLocaleTimeString('es-CO', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            tipo: 'gasto',
            concepto: `Mantenimiento - ${mant.lavadoraId}`,
            monto: mant.costoReparacion,
            medioPago: mant.medioPago || 'efectivo',
            referencia: mant.observaciones
          });
        }
      });

      // Combinar y ordenar todos los movimientos
      const todosLosMovimientos = [...movimientosIngresos, ...movimientosGastos]
        .sort((a, b) => {
          // Ordenar por fecha y hora
          const fechaA = new Date(a.fecha);
          const fechaB = new Date(b.fecha);
          if (fechaA.getTime() === fechaB.getTime()) {
            return a.hora.localeCompare(b.hora);
          }
          return fechaA.getTime() - fechaB.getTime();
        });

      setMovimientos(todosLosMovimientos);

      // Calcular saldos por medio de pago
      const saldosCalculados = {
        efectivo: 0,
        nequi: 0,
        daviplata: 0
      };

      todosLosMovimientos.forEach(mov => {
        if (mov.tipo === 'ingreso') {
          saldosCalculados[mov.medioPago] += mov.monto;
        } else {
          saldosCalculados[mov.medioPago] -= mov.monto;
        }
      });

      setSaldos(saldosCalculados);

    } catch (error) {
      console.error('Error al cargar datos del capital:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filtros]);

  const exportarLibroDiario = () => {
    const datos = [
      ['LIBRO DIARIO - LAVADORAS GLOBAL'],
      [''],
      [`Período: ${formatDate(filtros.fechaInicio, 'dd/MM/yyyy')} - ${formatDate(filtros.fechaFin, 'dd/MM/yyyy')}`],
      [''],
      ['FECHA', 'HORA', 'TIPO', 'CONCEPTO', 'MONTO', 'MEDIO PAGO', 'CLIENTE/PLAN', 'REFERENCIA'],
      ...movimientos.map(mov => [
        formatDate(mov.fecha, 'dd/MM/yyyy'),
        mov.hora,
        mov.tipo === 'ingreso' ? 'INGRESO' : 'GASTO',
        mov.concepto,
        mov.monto,
        mov.medioPago.toUpperCase(),
        mov.cliente ? `${mov.cliente} - ${mov.plan}` : '',
        mov.referencia || ''
      ]),
      [''],
      ['RESUMEN DE SALDOS:'],
      [''],
      ['MEDIO DE PAGO', 'SALDO FINAL'],
      ['EFECTIVO', saldos.efectivo],
      ['NEQUI', saldos.nequi],
      ['DAVIPLATA', saldos.daviplata],
      [''],
      ['TOTAL GENERAL', saldos.efectivo + saldos.nequi + saldos.daviplata]
    ];

    // Crear CSV
    const csvContent = datos.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `libro_diario_${formatDate(filtros.fechaInicio, 'yyyy-MM-dd')}_${formatDate(filtros.fechaFin, 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTipoColor = (tipo: string) => {
    return tipo === 'ingreso' ? 'text-green-600' : 'text-red-600';
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === 'ingreso' ? '↗️' : '↘️';
  };

  const getMedioPagoIcon = (medio: string) => {
    switch (medio) {
      case 'efectivo': return <BanknotesIcon className="h-4 w-4" />;
      case 'nequi': return <DevicePhoneMobileIcon className="h-4 w-4" />;
      case 'daviplata': return <CreditCardIcon className="h-4 w-4" />;
      default: return <CurrencyDollarIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Capital
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Libro diario y control de movimientos financieros
          </p>
        </div>
        <button
          onClick={exportarLibroDiario}
          disabled={loading || movimientos.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          <span>Exportar Libro Diario</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
          <FunnelIcon className="h-5 w-5 text-gray-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={filtros.tipo}
              onChange={(e) => {
                const tipo = e.target.value as 'hoy' | 'ayer' | 'personalizado';
                const hoy = getCurrentDateColombia();
                const ayer = new Date(hoy);
                ayer.setDate(ayer.getDate() - 1);
                
                setFiltros(prev => ({
                  ...prev,
                  tipo,
                  fechaInicio: tipo === 'hoy' ? hoy : tipo === 'ayer' ? ayer : prev.fechaInicio,
                  fechaFin: tipo === 'hoy' ? hoy : tipo === 'ayer' ? ayer : prev.fechaFin
                }));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
          
          {filtros.tipo === 'personalizado' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={formatDate(filtros.fechaInicio, 'yyyy-MM-dd')}
                  onChange={(e) => setFiltros(prev => ({
                    ...prev,
                    fechaInicio: new Date(e.target.value)
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={formatDate(filtros.fechaFin, 'yyyy-MM-dd')}
                  onChange={(e) => setFiltros(prev => ({
                    ...prev,
                    fechaFin: new Date(e.target.value)
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resumen de Saldos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Efectivo</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(saldos.efectivo)}
              </p>
            </div>
            <BanknotesIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Nequi</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(saldos.nequi)}
              </p>
            </div>
            <DevicePhoneMobileIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Daviplata</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrency(saldos.daviplata)}
              </p>
            </div>
            <CreditCardIcon className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Libro Diario */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Libro Diario</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <ChartBarIcon className="h-4 w-4" />
            <span>{movimientos.length} movimientos</span>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay movimientos en el período seleccionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concepto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medio Pago
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente/Plan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimientos.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{formatDate(mov.fecha, 'dd/MM/yyyy')}</div>
                        <div className="text-gray-500">{mov.hora}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTipoColor(mov.tipo)}`}>
                        {getTipoIcon(mov.tipo)} {mov.tipo.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {mov.concepto}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <span className={getTipoColor(mov.tipo)}>
                        {mov.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(mov.monto)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        {getMedioPagoIcon(mov.medioPago)}
                        <span className="capitalize">{mov.medioPago}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {mov.cliente && (
                        <div>
                          <div className="font-medium">{mov.cliente}</div>
                          <div className="text-xs">{mov.plan}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Capital;

import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CalendarIcon,
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { pedidoService, gastoService } from '../services/firebaseService';
import { obtenerMantenimientosActivos } from '../services/mantenimientoService';
import { capitalService } from '../services/capitalService';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Pedido, Gasto, Mantenimiento, CapitalInicial, MovimientoCapital } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';
import ModalCapitalInicial from '../components/ModalCapitalInicial';
import ModalMovimientoCapital from '../components/ModalMovimientoCapital';

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
  saldoEfectivo: number;
  saldoNequi: number;
  saldoDaviplata: number;
  saldoTotal: number;
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
    fechaInicio: (() => {
      const hoy = getCurrentDateColombia();
      hoy.setHours(0, 0, 0, 0); // Inicio del día
      return hoy;
    })(),
    fechaFin: (() => {
      const hoy = getCurrentDateColombia();
      hoy.setHours(23, 59, 59, 999); // Fin del día
      return hoy;
    })(),
    tipo: 'hoy'
  });
  
  // Estados para capital
  const [capitalInicial, setCapitalInicial] = useState<CapitalInicial | null>(null);
  const [movimientosCapital, setMovimientosCapital] = useState<MovimientoCapital[]>([]);
  const [showModalCapitalInicial, setShowModalCapitalInicial] = useState(false);
  const [showModalMovimiento, setShowModalMovimiento] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'inyeccion' | 'retiro'>('inyeccion');

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      // Cargar datos de capital
      const [capitalInicialData, movimientosCapitalData] = await Promise.all([
        capitalService.getCapitalInicial(),
        capitalService.getMovimientosCapital()
      ]);
      
      console.log('🔍 Debug Capital - Capital inicial cargado:', capitalInicialData);
      console.log('🔍 Debug Capital - Movimientos capital cargados:', movimientosCapitalData.length);
      
      setCapitalInicial(capitalInicialData);
      setMovimientosCapital(movimientosCapitalData);
      
      // Obtener TODOS los pedidos (sin filtro de fecha de asignación)
      const todosLosPedidos = await pedidoService.getAllPedidos();
      
      // Obtener gastos del rango de fechas
      const gastos = await gastoService.getGastosDelRango(filtros.fechaInicio, filtros.fechaFin);
      
      // Obtener mantenimientos del rango de fechas
      let mantenimientosFiltrados: Mantenimiento[] = [];
      
      try {
        // Obtener todos los mantenimientos directamente de la colección (como en Dashboard)
        const mantenimientosSnapshot = await getDocs(collection(db, 'mantenimientos'));
        const todosLosMantenimientos = mantenimientosSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            lavadoraId: data.lavadoraId,
            tipoFalla: data.tipoFalla,
            descripcion: data.descripcion,
            costoReparacion: data.costoReparacion,
            servicioTecnico: data.servicioTecnico,
            fechaInicio: data.fechaInicio?.toDate() || new Date(),
            fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
            fechaFin: data.fechaFin?.toDate(),
            fotos: data.fotos || [],
            observaciones: data.observaciones || '',
            medioPago: data.medioPago || 'efectivo',
            createdBy: data.createdBy,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
        });
        
        // Filtrar mantenimientos por rango de fechas
        console.log('🔧 Debug Capital - Rango de fechas:', filtros.fechaInicio, 'a', filtros.fechaFin);
        console.log('🔧 Debug Capital - Todos los mantenimientos (sin filtrar):', todosLosMantenimientos.map(m => ({
          id: m.id,
          lavadoraId: m.lavadoraId,
          fechaInicio: m.fechaInicio,
          createdAt: m.createdAt,
          costo: m.costoReparacion
        })));
        console.log('🔧 Debug Capital - Total mantenimientos encontrados:', todosLosMantenimientos.length);
        
        mantenimientosFiltrados = todosLosMantenimientos.filter(mantenimiento => {
          // El gasto se hace efectivo cuando se CREA el mantenimiento, no cuando se estima que termine
          const fechaMantenimiento = mantenimiento.createdAt;
          const estaEnRango = fechaMantenimiento >= filtros.fechaInicio && fechaMantenimiento <= filtros.fechaFin;
          console.log('🔧 Verificando mantenimiento:', mantenimiento.id, 'fecha creación:', fechaMantenimiento, 'en rango:', estaEnRango);
          return estaEnRango;
        });
        
        console.log('🔧 Mantenimientos cargados correctamente:', mantenimientosFiltrados.length);
      } catch (error) {
        console.error('Error cargando mantenimientos:', error);
        console.log('⚠️ Usando array vacío para mantenimientos');
        mantenimientosFiltrados = [];
      }

      // Procesar movimientos de ingresos (pagos de pedidos)
      const movimientosIngresos: MovimientoLibroDiario[] = [];
      console.log('🔍 Debug Capital - Total pedidos:', todosLosPedidos.length);
      
      todosLosPedidos.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          console.log('💰 Pedido con pagos:', pedido.id, 'Pagos:', pedido.pagosRealizados.length);
          pedido.pagosRealizados.forEach(pago => {
            console.log('🔍 Pago raw:', pago);
            
            // Manejar diferentes formatos de fecha
            let fechaPago: Date;
            if (pago.fecha instanceof Date) {
              fechaPago = pago.fecha;
            } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
              // Firebase Timestamp
              fechaPago = (pago.fecha as any).toDate();
            } else if (typeof pago.fecha === 'string') {
              fechaPago = new Date(pago.fecha);
            } else {
              console.log('❌ Formato de fecha no reconocido:', typeof pago.fecha, pago.fecha);
              return;
            }
            
            console.log('📅 Fecha pago procesada:', fechaPago, 'Válida:', !isNaN(fechaPago.getTime()));
            
            if (!isNaN(fechaPago.getTime())) {
              // Verificar si el pago está en el rango de fechas
              const fechaInicio = new Date(filtros.fechaInicio);
              const fechaFin = new Date(filtros.fechaFin);
              fechaInicio.setHours(0, 0, 0, 0);
              fechaFin.setHours(23, 59, 59, 999);
              
              console.log('📊 Rango fechas:', fechaInicio, 'a', fechaFin);
              console.log('📊 Fecha pago en rango:', fechaPago >= fechaInicio && fechaPago <= fechaFin);
              
              if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
                console.log('✅ Agregando ingreso:', pago.monto, pago.medioPago);
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
                  referencia: pago.referencia,
                  saldoEfectivo: 0,
                  saldoNequi: 0,
                  saldoDaviplata: 0,
                  saldoTotal: 0
                });
              }
            }
          });
        }
      });
      
      console.log('📊 Total ingresos encontrados:', movimientosIngresos.length);

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
            referencia: gasto.description,
            saldoEfectivo: 0,
            saldoNequi: 0,
            saldoDaviplata: 0,
            saldoTotal: 0
          });
        }
      });

      // Procesar movimientos de mantenimiento
      console.log('🔧 Debug Capital - Mantenimientos encontrados:', mantenimientosFiltrados.length);
      console.log('🔧 Debug Capital - Todos los mantenimientos:', mantenimientosFiltrados.map(m => ({
        id: m.id,
        costo: m.costoReparacion,
        fechaInicio: m.fechaInicio,
        medioPago: m.medioPago,
        lavadoraId: m.lavadoraId
      })));
      
      mantenimientosFiltrados.forEach(mant => {
        // El gasto se hace efectivo cuando se CREA el mantenimiento, no cuando se estima que termine
        const fechaMant = new Date(mant.createdAt);
        console.log('🔧 Procesando mantenimiento:', mant.id, 'fecha creación:', fechaMant, 'costo:', mant.costoReparacion);
        if (!isNaN(fechaMant.getTime())) {
            movimientosGastos.push({
              id: `mant-${mant.id}`,
              fecha: fechaMant,
              hora: fechaMant.toLocaleTimeString('es-CO', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              tipo: 'gasto',
              concepto: `Mantenimiento - ${mant.tipoFalla}`,
              monto: mant.costoReparacion,
              medioPago: mant.medioPago || 'efectivo',
              referencia: mant.observaciones,
              saldoEfectivo: 0,
              saldoNequi: 0,
              saldoDaviplata: 0,
              saldoTotal: 0
            });
            console.log('✅ Mantenimiento agregado al libro diario:', mant.id);
        } else {
          console.log('❌ Fecha inválida para mantenimiento:', mant.id, mant.createdAt);
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

      // Incluir movimientos de capital en el libro diario
      const movimientosCapitalLibro: MovimientoLibroDiario[] = movimientosCapitalData.map(mov => ({
        id: `capital-${mov.id}`,
        fecha: mov.fecha,
        hora: mov.fecha.toLocaleTimeString('es-CO', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        tipo: mov.tipo === 'inyeccion' ? 'ingreso' as const : 'gasto' as const,
        concepto: `${mov.tipo === 'inyeccion' ? 'Inyección' : 'Retiro'} de Capital - ${mov.concepto}`,
        monto: mov.efectivo + mov.nequi + mov.daviplata,
        medioPago: 'efectivo' as const, // Se mostrará como efectivo pero se procesará por separado
        referencia: mov.observaciones || '',
        saldoEfectivo: 0,
        saldoNequi: 0,
        saldoDaviplata: 0,
        saldoTotal: 0
      }));

      // Incluir capital inicial si existe
      const capitalInicialLibro: MovimientoLibroDiario[] = capitalInicialData ? [{
        id: 'capital-inicial',
        fecha: capitalInicialData.fecha,
        hora: capitalInicialData.fecha.toLocaleTimeString('es-CO', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        tipo: 'ingreso' as const,
        concepto: 'Capital Inicial',
        monto: capitalInicialData.efectivo + capitalInicialData.nequi + capitalInicialData.daviplata,
        medioPago: 'efectivo' as const,
        referencia: '',
        saldoEfectivo: 0,
        saldoNequi: 0,
        saldoDaviplata: 0,
        saldoTotal: 0
      }] : [];
      
      console.log('🔍 Debug Capital - Capital inicial libro:', capitalInicialLibro);

      // Combinar todos los movimientos incluyendo capital
      const todosLosMovimientosCompletos = [...movimientosIngresos, ...movimientosGastos, ...capitalInicialLibro, ...movimientosCapitalLibro]
        .sort((a, b) => {
          const fechaA = new Date(a.fecha);
          const fechaB = new Date(b.fecha);
          if (fechaA.getTime() === fechaB.getTime()) {
            return a.hora.localeCompare(b.hora);
          }
          return fechaA.getTime() - fechaB.getTime();
        });
      
      console.log('🔍 Debug Capital - Todos los movimientos completos:', todosLosMovimientosCompletos);

      // Calcular saldos acumulados para cada movimiento
      let saldoEfectivo = 0;
      let saldoNequi = 0;
      let saldoDaviplata = 0;
      
      const movimientosConSaldos = todosLosMovimientosCompletos.map(movimiento => {
        console.log('🔍 Procesando movimiento:', movimiento.id, movimiento.concepto);
        
        // Procesar capital inicial primero (antes que movimientos de capital)
        if (movimiento.id === 'capital-inicial') {
          console.log('🔍 Verificando capital inicial - capitalInicialData:', capitalInicialData);
          if (capitalInicialData) {
            console.log('💰 Procesando capital inicial:', capitalInicialData.efectivo, capitalInicialData.nequi, capitalInicialData.daviplata);
            saldoEfectivo += capitalInicialData.efectivo;
            saldoNequi += capitalInicialData.nequi;
            saldoDaviplata += capitalInicialData.daviplata;
          } else {
            console.log('❌ Error: capitalInicialData es null/undefined');
          }
        } else if (movimiento.id.startsWith('capital-')) {
          const movCapital = movimientosCapitalData.find(m => `capital-${m.id}` === movimiento.id);
          if (movCapital) {
            console.log('💰 Procesando movimiento capital:', movCapital.tipo, movCapital.efectivo, movCapital.nequi, movCapital.daviplata);
            if (movCapital.tipo === 'inyeccion') {
              saldoEfectivo += movCapital.efectivo;
              saldoNequi += movCapital.nequi;
              saldoDaviplata += movCapital.daviplata;
            } else {
              saldoEfectivo -= movCapital.efectivo;
              saldoNequi -= movCapital.nequi;
              saldoDaviplata -= movCapital.daviplata;
            }
          }
        } else {
          console.log('💰 Procesando movimiento normal:', movimiento.tipo, movimiento.monto, movimiento.medioPago);
          // Movimientos normales (ingresos/gastos)
          if (movimiento.medioPago === 'efectivo') {
            saldoEfectivo += movimiento.tipo === 'ingreso' ? movimiento.monto : -movimiento.monto;
          } else if (movimiento.medioPago === 'nequi') {
            saldoNequi += movimiento.tipo === 'ingreso' ? movimiento.monto : -movimiento.monto;
          } else if (movimiento.medioPago === 'daviplata') {
            saldoDaviplata += movimiento.tipo === 'ingreso' ? movimiento.monto : -movimiento.monto;
          }
        }
        
        const saldoTotal = saldoEfectivo + saldoNequi + saldoDaviplata;
        
        return {
          ...movimiento,
          saldoEfectivo,
          saldoNequi,
          saldoDaviplata,
          saldoTotal
        };
      });
      
      setMovimientos(movimientosConSaldos);

      // Calcular saldos finales por medio de pago
      const saldosCalculados = {
        efectivo: saldoEfectivo,
        nequi: saldoNequi,
        daviplata: saldoDaviplata
      };

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
      ['FECHA', 'HORA', 'TIPO', 'CONCEPTO', 'MONTO', 'MEDIO PAGO', 'CLIENTE/PLAN', 'REFERENCIA', 'SALDO EFECTIVO', 'SALDO NEQUI', 'SALDO DAVIPLATA', 'SALDO TOTAL'],
      ...movimientos.map(mov => [
        formatDate(mov.fecha, 'dd/MM/yyyy'),
        mov.hora,
        mov.tipo === 'ingreso' ? 'INGRESO' : 'GASTO',
        mov.concepto,
        mov.monto,
        mov.medioPago.toUpperCase(),
        mov.cliente ? `${mov.cliente} - ${mov.plan}` : '',
        mov.referencia || '',
        mov.saldoEfectivo,
        mov.saldoNequi,
        mov.saldoDaviplata,
        mov.saldoTotal
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
        <div className="flex items-center space-x-3">
          {/* Botones de gestión de capital */}
          {!capitalInicial && (
            <button
              onClick={() => setShowModalCapitalInicial(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Capital Inicial</span>
            </button>
          )}
          
          {capitalInicial && (
            <>
              <button
                onClick={() => {
                  setTipoMovimiento('inyeccion');
                  setShowModalMovimiento(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <ArrowUpIcon className="h-5 w-5" />
                <span>Inyección</span>
              </button>
              
              <button
                onClick={() => {
                  setTipoMovimiento('retiro');
                  setShowModalMovimiento(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <ArrowDownIcon className="h-5 w-5" />
                <span>Retiro</span>
              </button>
            </>
          )}
          
          <button
            onClick={exportarLibroDiario}
            disabled={loading || movimientos.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>Exportar</span>
          </button>
        </div>
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Efectivo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Nequi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Daviplata
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Total
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
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      <span className={mov.saldoEfectivo >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(mov.saldoEfectivo)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      <span className={mov.saldoNequi >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(mov.saldoNequi)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      <span className={mov.saldoDaviplata >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(mov.saldoDaviplata)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold">
                      <span className={mov.saldoTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(mov.saldoTotal)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Modales */}
      <ModalCapitalInicial
        isOpen={showModalCapitalInicial}
        onClose={() => setShowModalCapitalInicial(false)}
        onSuccess={() => {
          cargarDatos();
          setShowModalCapitalInicial(false);
        }}
      />
      
      <ModalMovimientoCapital
        isOpen={showModalMovimiento}
        onClose={() => setShowModalMovimiento(false)}
        onSuccess={() => {
          cargarDatos();
          setShowModalMovimiento(false);
        }}
        tipo={tipoMovimiento}
      />
    </div>
  );
};

export default Capital;

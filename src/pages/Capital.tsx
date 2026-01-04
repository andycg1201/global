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
import ResumenCapital from '../components/ResumenCapital';
import * as XLSX from 'xlsx';

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
  const [mostrarResumen, setMostrarResumen] = useState(true); // Por defecto mostrar resumen
  
  // Estados para el resumen
  const [datosResumen, setDatosResumen] = useState({
    capitalInicial: 0,
    inyeccionesCapital: 0,
    serviciosPagados: 0,
    serviciosPendientes: 0,
    retiros: 0,
    gastosGenerales: 0,
    mantenimientos: 0
  });

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
      
      // Obtener gastos totales para el resumen y filtrar para el libro diario
      const fechaInicioHistorico = new Date(2000, 0, 1);
      const fechaFinHistorico = new Date();
      fechaFinHistorico.setHours(23, 59, 59, 999);

      const gastosTotales = await gastoService.getGastosDelRango(fechaInicioHistorico, fechaFinHistorico);

      const estaEnRangoFechas = (fecha: Date) =>
        fecha >= filtros.fechaInicio && fecha <= filtros.fechaFin;
      
      // Obtener mantenimientos (sin filtrar) para resumen y libro
      let mantenimientosFiltrados: Mantenimiento[] = [];
      let todosLosMantenimientos: Mantenimiento[] = [];
      
      try {
        // Obtener todos los mantenimientos directamente de la colección (como en Dashboard)
        const mantenimientosSnapshot = await getDocs(collection(db, 'mantenimientos'));
        todosLosMantenimientos = mantenimientosSnapshot.docs.map(doc => {
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
          const estaEnRango = estaEnRangoFechas(fechaMantenimiento);
          console.log('🔧 Verificando mantenimiento:', mantenimiento.id, 'fecha creación:', fechaMantenimiento, 'en rango:', estaEnRango);
          return estaEnRango;
        });
        
        console.log('🔧 Mantenimientos cargados correctamente:', mantenimientosFiltrados.length);
      } catch (error) {
        console.error('Error cargando mantenimientos:', error);
        console.log('⚠️ Usando array vacío para mantenimientos');
        mantenimientosFiltrados = [];
      }

      // Los pagos de servicios se procesan más abajo en pagosPedidosLibro
      const movimientosIngresos: MovimientoLibroDiario[] = [];
      const movimientosGastos: MovimientoLibroDiario[] = [];

      // Procesar gastos
      const gastosFiltrados = gastosTotales.filter(gasto => {
        const fechaGasto = new Date(gasto.date);
        return !isNaN(fechaGasto.getTime()) && estaEnRangoFechas(fechaGasto);
      });

      gastosFiltrados.forEach(gasto => {
        const fechaGasto = new Date(gasto.date);
        console.log('🔧 Procesando gasto:', gasto.id, 'fecha:', fechaGasto, 'monto:', gasto.amount);
        if (!isNaN(fechaGasto.getTime())) {
          movimientosGastos.push({
            id: `gasto-${gasto.id}`,
            fecha: fechaGasto,
            hora: fechaGasto.toLocaleTimeString('es-CO', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            tipo: 'gasto',
            concepto: gasto.description,
            monto: gasto.amount,
            medioPago: gasto.medioPago || 'efectivo',
            referencia: gasto.description,
            saldoEfectivo: 0,
            saldoNequi: 0,
            saldoDaviplata: 0,
            saldoTotal: 0
          });
          console.log('✅ Gasto agregado al libro diario:', gasto.id);
        } else {
          console.log('❌ Fecha inválida para gasto:', gasto.id, gasto.date);
        }
      });

      // Procesar mantenimientos
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

      // Incluir movimientos de capital en el libro diario (excluyendo pagos de servicios)
      const movimientosCapitalLibro: MovimientoLibroDiario[] = movimientosCapitalData
        .filter(mov => {
          // Excluir movimientos que son pagos de servicios
          const esPagoServicio = mov.concepto.includes('Pago servicio') || 
                                mov.concepto.includes('servicio') ||
                                mov.observaciones?.includes('servicio') ||
                                mov.observaciones?.includes('Pago');
          const estaEnRango = estaEnRangoFechas(mov.fecha);
          console.log('🔍 Filtro movimiento capital:', {
            id: mov.id,
            concepto: mov.concepto,
            observaciones: mov.observaciones,
            esPagoServicio,
            enRango: estaEnRango,
            incluir: !esPagoServicio && estaEnRango
          });
          return !esPagoServicio && estaEnRango;
        })
        .reduce<MovimientoLibroDiario[]>((acumulado, mov) => {
          const tipoMovimiento = mov.tipo === 'inyeccion' ? 'ingreso' : 'gasto';
          const conceptoBase = `${mov.tipo === 'inyeccion' ? 'Inyección' : 'Retiro'} de Capital - ${mov.concepto}`;
          const montosPorMedio: Partial<Record<MovimientoLibroDiario['medioPago'], number>> = {
            efectivo: mov.efectivo || 0,
            nequi: mov.nequi || 0,
            daviplata: mov.daviplata || 0
          };

          const movimientosPorMedio = crearMovimientosPorMedio(
            `capital-${mov.id}`,
            mov.fecha,
            tipoMovimiento,
            conceptoBase,
            montosPorMedio,
            mov.observaciones
          );

          return [...acumulado, ...movimientosPorMedio];
        }, []);

      // Incluir capital inicial en el libro diario
      const capitalInicialLibro: MovimientoLibroDiario[] =
        capitalInicialData && estaEnRangoFechas(capitalInicialData.fecha)
          ? crearMovimientosPorMedio(
            'capital-inicial',
            capitalInicialData.fecha,
            'ingreso',
            'Capital Inicial',
            {
              efectivo: capitalInicialData.efectivo || 0,
              nequi: capitalInicialData.nequi || 0,
              daviplata: capitalInicialData.daviplata || 0
            },
            'Capital inicial registrado'
          )
        : [];

      // Procesar pagos de servicios
      const pagosPedidosLibro: MovimientoLibroDiario[] = [];
      todosLosPedidos.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          pedido.pagosRealizados.forEach(pago => {
            const fechaPago = new Date(pago.fecha);
            if (!isNaN(fechaPago.getTime()) && estaEnRangoFechas(fechaPago)) {
              pagosPedidosLibro.push({
                id: `pago-${pedido.id}-${Date.now()}`,
                fecha: fechaPago,
                hora: fechaPago.toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }),
                tipo: 'ingreso',
                concepto: `Pago servicio - ${pedido.cliente.name}`,
                monto: pago.monto,
                medioPago: pago.medioPago,
                cliente: pedido.cliente.name,
                plan: pedido.plan?.name || 'Sin plan',
                referencia: pago.referencia,
                saldoEfectivo: 0,
                saldoNequi: 0,
                saldoDaviplata: 0,
                saldoTotal: 0
              });
            }
          });
        }
      });

      const todosLosMovimientosCompletos = [...movimientosIngresos, ...movimientosGastos, ...capitalInicialLibro, ...movimientosCapitalLibro, ...pagosPedidosLibro]
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
        // Actualizar saldos según el medio de pago
        if (movimiento.tipo === 'ingreso') {
          switch (movimiento.medioPago) {
            case 'efectivo':
              saldoEfectivo += movimiento.monto;
              break;
            case 'nequi':
              saldoNequi += movimiento.monto;
              break;
            case 'daviplata':
              saldoDaviplata += movimiento.monto;
              break;
          }
        } else {
          switch (movimiento.medioPago) {
            case 'efectivo':
              saldoEfectivo -= movimiento.monto;
              break;
            case 'nequi':
              saldoNequi -= movimiento.monto;
              break;
            case 'daviplata':
              saldoDaviplata -= movimiento.monto;
              break;
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

      // Calcular datos para el resumen
      const capitalInicialTotal = capitalInicialData ? 
        (capitalInicialData.efectivo + capitalInicialData.nequi + capitalInicialData.daviplata) : 0;
      
      // Calcular inyecciones de capital (movimientos de tipo 'inyeccion')
      const inyeccionesTotal = movimientosCapitalData
        .filter(mov => mov.tipo === 'inyeccion')
        .reduce((sum, mov) => sum + (mov.efectivo || 0) + (mov.nequi || 0) + (mov.daviplata || 0), 0);
      
      // Calcular retiros de capital (movimientos de tipo 'retiro')
      const retirosTotal = movimientosCapitalData
        .filter(mov => mov.tipo === 'retiro')
        .reduce((sum, mov) => sum + (mov.efectivo || 0) + (mov.nequi || 0) + (mov.daviplata || 0), 0);
      
      // Calcular servicios pagados y pendientes
      let serviciosPagadosTotal = 0;
      let serviciosPendientesTotal = 0;
      
      todosLosPedidos.forEach(pedido => {
        const pagosRecibidos = pedido.pagosRealizados?.reduce((sum, pago) => sum + (pago.monto || 0), 0) || 0;
        serviciosPagadosTotal += pagosRecibidos;
        serviciosPendientesTotal += Math.max(0, (pedido.total || 0) - pagosRecibidos);
      });
      
      // Calcular gastos generales
      const gastosGeneralesTotal = gastosTotales.reduce((sum, gasto) => sum + (gasto.amount || 0), 0);
      
      // Calcular mantenimientos
      const mantenimientosTotal = todosLosMantenimientos.reduce((sum, mant) => sum + (mant.costoReparacion || 0), 0);
      
      setDatosResumen({
        capitalInicial: capitalInicialTotal,
        inyeccionesCapital: inyeccionesTotal,
        serviciosPagados: serviciosPagadosTotal,
        serviciosPendientes: serviciosPendientesTotal,
        retiros: retirosTotal,
        gastosGenerales: gastosGeneralesTotal,
        mantenimientos: mantenimientosTotal
      });

      console.log('🔍 Debug Capital - Datos del resumen:', {
        capitalInicialTotal,
        inyeccionesTotal,
        serviciosPagadosTotal,
        serviciosPendientesTotal,
        retirosTotal,
        gastosGeneralesTotal,
        mantenimientosTotal,
        movimientosCapitalData: movimientosCapitalData.map(m => ({ 
          id: m.id, 
          tipo: m.tipo, 
          efectivo: m.efectivo, 
          nequi: m.nequi, 
          daviplata: m.daviplata,
          total: (m.efectivo || 0) + (m.nequi || 0) + (m.daviplata || 0)
        }))
      });

      console.log('✅ Capital - Datos cargados exitosamente');

    } catch (error) {
      console.error('Error al cargar datos del capital:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filtros]);

  const handleFiltroChange = (tipo: 'hoy' | 'ayer' | 'personalizado') => {
    const hoy = getCurrentDateColombia();
    
    switch (tipo) {
      case 'hoy':
        setFiltros({
          fechaInicio: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0),
          fechaFin: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59),
          tipo: 'hoy'
        });
        break;
      case 'ayer':
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        setFiltros({
          fechaInicio: new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 0, 0, 0),
          fechaFin: new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59),
          tipo: 'ayer'
        });
        break;
      case 'personalizado':
        setFiltros(prev => ({ ...prev, tipo: 'personalizado' }));
        break;
    }
  };

  const getMedioPagoLabel = (medio: MovimientoLibroDiario['medioPago']) => {
    switch (medio) {
      case 'efectivo':
        return 'Efectivo';
      case 'nequi':
        return 'Nequi';
      case 'daviplata':
        return 'Daviplata';
      default:
        return medio;
    }
  };

  const getMedioPagoInfo = (medio: MovimientoLibroDiario['medioPago']) => {
    switch (medio) {
      case 'efectivo':
        return {
          label: 'Efectivo',
          icon: <BanknotesIcon className="h-4 w-4" />,
          badgeClass: 'bg-green-50 text-green-700'
        };
      case 'nequi':
        return {
          label: 'Nequi',
          icon: <DevicePhoneMobileIcon className="h-4 w-4" />,
          badgeClass: 'bg-purple-50 text-purple-700'
        };
      case 'daviplata':
        return {
          label: 'Daviplata',
          icon: <CreditCardIcon className="h-4 w-4" />,
          badgeClass: 'bg-indigo-50 text-indigo-700'
        };
      default:
        return {
          label: medio,
          icon: <CurrencyDollarIcon className="h-4 w-4" />,
          badgeClass: 'bg-gray-100 text-gray-700'
        };
    }
  };

  const mediosDisponibles: MovimientoLibroDiario['medioPago'][] = ['efectivo', 'nequi', 'daviplata'];

  const crearMovimientosPorMedio = (
    baseId: string,
    fecha: Date,
    tipo: 'ingreso' | 'gasto',
    conceptoBase: string,
    montos: Partial<Record<MovimientoLibroDiario['medioPago'], number>>,
    referencia?: string
  ): MovimientoLibroDiario[] => {
    const horaMovimiento = fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const movimientos: MovimientoLibroDiario[] = [];

    mediosDisponibles.forEach((medio) => {
      const monto = montos[medio] || 0;
      if (monto > 0) {
        movimientos.push({
          id: `${baseId}-${medio}`,
          fecha,
          hora: horaMovimiento,
          tipo,
          concepto: `${conceptoBase} (${getMedioPagoLabel(medio)})`,
          monto,
          medioPago: medio,
          referencia,
          saldoEfectivo: 0,
          saldoNequi: 0,
          saldoDaviplata: 0,
          saldoTotal: 0
        });
      }
    });

    return movimientos;
  };

  const exportarLibroDiario = () => {
    if (movimientos.length === 0) {
      alert('No hay movimientos para exportar');
      return;
    }

    console.log('📊 Exportando libro diario con', movimientos.length, 'movimientos');
    console.log('📊 Primeros movimientos:', movimientos.slice(0, 3));

    const rows = movimientos.map(mov => ({
      Fecha: formatDate(mov.fecha, 'dd/MM/yyyy'),
      Hora: mov.hora,
      Tipo: mov.tipo,
      Concepto: mov.concepto,
      Monto: mov.tipo === 'ingreso' ? mov.monto : -mov.monto,
      'Medio de Pago': getMedioPagoLabel(mov.medioPago),
      Cliente: mov.cliente || '',
      Plan: mov.plan || '',
      Referencia: mov.referencia || '',
      'Saldo Efectivo': mov.saldoEfectivo,
      'Saldo Nequi': mov.saldoNequi,
      'Saldo Daviplata': mov.saldoDaviplata,
      'Saldo Total': mov.saldoTotal
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
      'Fecha',
      'Hora',
      'Tipo',
      'Concepto',
      'Monto',
      'Medio de Pago',
      'Cliente',
      'Plan',
      'Referencia',
      'Saldo Efectivo',
      'Saldo Nequi',
      'Saldo Daviplata',
      'Saldo Total'
      ]
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Libro Diario');

    const fechaInicio = formatDate(filtros.fechaInicio, 'yyyy-MM-dd');
    const fechaFin = formatDate(filtros.fechaFin, 'yyyy-MM-dd');
    const nombreArchivo = `libro_diario_${fechaInicio}_a_${fechaFin}.xlsx`;
    
    XLSX.writeFile(workbook, nombreArchivo);
    console.log('✅ Archivo exportado:', nombreArchivo);
  };

  const getTipoColor = (tipo: string) => {
    return tipo === 'ingreso' ? 'text-green-600' : 'text-red-600';
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === 'ingreso' ? '↗️' : '↘️';
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

      {/* Botones de vista */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={() => setMostrarResumen(true)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            mostrarResumen 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📊 Resumen General
        </button>
        <button
          onClick={() => setMostrarResumen(false)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            !mostrarResumen 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📋 Libro Diario
        </button>
      </div>

      {/* Contenido según vista seleccionada */}
      {mostrarResumen ? (
        <ResumenCapital
          capitalInicial={datosResumen.capitalInicial}
          inyeccionesCapital={datosResumen.inyeccionesCapital}
          serviciosPagados={datosResumen.serviciosPagados}
          serviciosPendientes={datosResumen.serviciosPendientes}
          retiros={datosResumen.retiros}
          gastosGenerales={datosResumen.gastosGenerales}
          mantenimientos={datosResumen.mantenimientos}
        />
      ) : (
        <div>
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
                    handleFiltroChange(tipo);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="hoy">Hoy</option>
                  <option value="ayer">Ayer</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicio
                </label>
                <input
                  type="datetime-local"
                  value={filtros.fechaInicio.toISOString().slice(0, 16)}
                  onChange={(e) => {
                    const fecha = new Date(e.target.value);
                    setFiltros(prev => ({ ...prev, fechaInicio: fecha }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Fin
                </label>
                <input
                  type="datetime-local"
                  value={filtros.fechaFin.toISOString().slice(0, 16)}
                  onChange={(e) => {
                    const fecha = new Date(e.target.value);
                    setFiltros(prev => ({ ...prev, fechaFin: fecha }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Resumen de saldos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center">
                <BanknotesIcon className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Efectivo</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(saldos.efectivo)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center">
                <DevicePhoneMobileIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Nequi</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(saldos.nequi)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center">
                <CreditCardIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Daviplata</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(saldos.daviplata)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-8 w-8 text-gray-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(saldos.efectivo + saldos.nequi + saldos.daviplata)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de movimientos */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Libro Diario</h3>
              <ChartBarIcon className="h-5 w-5 text-gray-500" />
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Cargando movimientos...</span>
              </div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-8">
                <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay movimientos</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No se encontraron movimientos para el período seleccionado.
                </p>
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Medio
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
                    {movimientos.map((mov) => {
                      const medioInfo = getMedioPagoInfo(mov.medioPago);
                      return (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{formatDate(mov.fecha, 'dd/MM/yyyy')}</div>
                            <div className="text-gray-500">{mov.hora}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTipoColor(mov.tipo)}`}>
                            {getTipoIcon(mov.tipo)} {mov.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="max-w-xs truncate" title={mov.concepto}>
                            {mov.concepto}
                          </div>
                          {mov.referencia && (
                            <div className="text-xs text-gray-500 mt-1 truncate" title={mov.referencia}>
                              {mov.referencia}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <span className={getTipoColor(mov.tipo)}>
                            {mov.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(mov.monto)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                            <div className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${medioInfo.badgeClass}`}>
                              {medioInfo.icon}
                              <span className="ml-1">{medioInfo.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {mov.cliente && (
                            <div>
                              <div className="font-medium">{mov.cliente}</div>
                              {mov.plan && (
                                <div className="text-xs text-gray-500">{mov.plan}</div>
                              )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
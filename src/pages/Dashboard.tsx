import React, { useState, useEffect } from 'react';
import { 
  ClipboardDocumentListIcon, 
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ArrowPathIcon,
  WalletIcon
} from '@heroicons/react/24/outline';
import { Pedido, PagoRealizado } from '../types';
import { pedidoService, configService, planService, gastoService, lavadoraService } from '../services/firebaseService';
import { capitalService } from '../services/capitalService';
import { obtenerTodosLosMantenimientos } from '../services/mantenimientoService';
import { movimientosSaldosService, MovimientoSaldo, MovimientosSaldosService } from '../services/movimientosSaldosService';
import { formatCurrency } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import ModalModificacionesServicio from '../components/ModalModificacionesServicio';
import ModalPagos from '../components/ModalPagos';
import ModalRecogidaOperativa from '../components/ModalRecogidaOperativa';
import ModalEntregaOperativa from '../components/ModalEntregaOperativa';
import ModalHistorialSaldos from '../components/ModalHistorialSaldos';
import ModalWhatsApp from '../components/ModalWhatsApp';
import { recogidaOperativaService } from '../services/recogidaOperativaService';
import { entregaOperativaService } from '../services/entregaOperativaService';
import PedidosPendientes from '../components/PedidosPendientes';

const Dashboard: React.FC = () => {
  const { firebaseUser } = useAuth();

  // Estados básicos
  const [loading, setLoading] = useState(true);
  const [ingresosReales, setIngresosReales] = useState<number>(0);
  const [totalPedidos, setTotalPedidos] = useState<number>(0);
  const [totalGastos, setTotalGastos] = useState<number>(0);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<number>(0);
  const [capitalInicial, setCapitalInicial] = useState<number>(0);
  const [inyeccionesCapital, setInyeccionesCapital] = useState<number>(0);
  const [ingresosServicios, setIngresosServicios] = useState<number>(0);
  const [gastosGenerales, setGastosGenerales] = useState<number>(0);
  const [gastosMantenimiento, setGastosMantenimiento] = useState<number>(0);
  const [retirosCapital, setRetirosCapital] = useState<number>(0);
  const [saldosPorMedioDePago, setSaldosPorMedioDePago] = useState({
      efectivo: { ingresos: 0, gastos: 0, saldo: 0 },
      nequi: { ingresos: 0, gastos: 0, saldo: 0 },
    daviplata: { ingresos: 0, gastos: 0, saldo: 0 },
  });

  // Estados de pedidos
  const [pedidosPendientesEntregar, setPedidosPendientesEntregar] = useState<Pedido[]>([]);
  const [pedidosPendientesRecoger, setPedidosPendientesRecoger] = useState<Pedido[]>([]);
  const [pedidosCompletadosConSaldo, setPedidosCompletadosConSaldo] = useState<Pedido[]>([]);

  // Estados de modales
  const [mostrarModalModificaciones, setMostrarModalModificaciones] = useState<boolean>(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [mostrarModalPagos, setMostrarModalPagos] = useState<boolean>(false);
  const [pedidoParaPago, setPedidoParaPago] = useState<Pedido | null>(null);
  const [mostrarModalRecogidaOperativa, setMostrarModalRecogidaOperativa] = useState<boolean>(false);
  const [pedidoParaRecogida, setPedidoParaRecogida] = useState<Pedido | null>(null);
  const [mostrarModalEntregaOperativa, setMostrarModalEntregaOperativa] = useState<boolean>(false);
  const [pedidoParaEntrega, setPedidoParaEntrega] = useState<Pedido | null>(null);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState<boolean>(false);
  const [pedidoParaWhatsApp, setPedidoParaWhatsApp] = useState<Pedido | null>(null);
  const [fotoEvidenciaWhatsApp, setFotoEvidenciaWhatsApp] = useState<string | null>(null);
  
  // Estados para modal de historial de saldos
  const [mostrarModalHistorialSaldos, setMostrarModalHistorialSaldos] = useState<boolean>(false);
  const [tipoSaldoSeleccionado, setTipoSaldoSeleccionado] = useState<'efectivo' | 'nequi' | 'daviplata'>('efectivo');
  const [movimientosSaldos, setMovimientosSaldos] = useState<MovimientoSaldo[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState<boolean>(false);

  // Estados de configuración
  const [configuracion, setConfiguracion] = useState<any>(null);
  const [planes, setPlanes] = useState<any[]>([]);
  const [lavadoras, setLavadoras] = useState<any[]>([]);

  // Función para cargar datos simplificados
  const cargarDatosSimplificados = async () => {
    try {
      console.log('🔄 Cargando datos simplificados...');
      
      // Obtener datos básicos
      const [pedidosData, configuracionData, planesData, capitalInicialData, movimientosCapitalData, gastosData, mantenimientosData, lavadorasData] = await Promise.all([
        pedidoService.getAllPedidos(),
        configService.getConfiguracion(),
        planService.getActivePlans(),
        capitalService.getCapitalInicial(),
        capitalService.getMovimientosCapital(),
        gastoService.getGastosDelRango(new Date(2024, 0, 1), new Date()),
        obtenerTodosLosMantenimientos(),
        lavadoraService.getAllLavadoras()
      ]);
      
      setConfiguracion(configuracionData);
      setPlanes(planesData);
      setLavadoras(lavadorasData);
      
      // Debug: verificar estado de lavadoras
      console.log('🔍 Debug Dashboard - Estados de lavadoras:', lavadorasData.map(l => ({
        codigoQR: l.codigoQR,
        estado: l.estado
      })));

      // Debug específico para G-02
      const g02 = lavadorasData.find(l => l.codigoQR === 'G-02');
      console.log('🔍 Debug Dashboard - G-02 específica:', g02 ? {
        codigoQR: g02.codigoQR,
        estado: g02.estado,
        id: g02.id
      } : 'NO ENCONTRADA');
      
      // Procesar pedidos básico
      const pedidosPendientes = pedidosData.filter(p => p.status === 'pendiente');
      const pedidosEntregados = pedidosData.filter(p => p.status === 'entregado');
      const completadosConSaldo = pedidosData.filter(p => {
        if (p.status !== 'recogido') return false;
        const totalPagado = p.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        const saldoPendiente = Math.max(0, (p.total || 0) - totalPagado);
        return saldoPendiente > 0;
      });
      
      setPedidosPendientesEntregar(pedidosPendientes);
      setPedidosPendientesRecoger(pedidosEntregados);
      setPedidosCompletadosConSaldo(completadosConSaldo);
      
      // Calcular datos financieros básicos
      // Ingresos de servicios (pagos de pedidos)
      const ingresosServicios = pedidosData.reduce((sum, pedido) => {
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        return sum + totalPagado;
      }, 0);
      
      // Capital inicial
      const capitalInicial = capitalInicialData ? 
        (capitalInicialData.efectivo + capitalInicialData.nequi + capitalInicialData.daviplata) : 0;
      
      // Inyecciones de capital
      const inyeccionesCapital = movimientosCapitalData
        .filter(mov => mov.tipo === 'inyeccion')
        .reduce((sum, mov) => sum + (mov.efectivo + mov.nequi + mov.daviplata), 0);
      
      // Calcular gastos totales
      const gastosGenerales = gastosData.reduce((sum, gasto) => sum + gasto.amount, 0);
      
      // Calcular gastos de mantenimiento
      console.log('🔧 Debug Dashboard - Mantenimientos cargados:', mantenimientosData.length);
      console.log('🔧 Debug Dashboard - Datos de mantenimientos:', mantenimientosData.map(m => ({
        id: m.id,
        costoReparacion: m.costoReparacion,
        medioPago: m.medioPago,
        createdAt: m.createdAt
      })));
      
      const gastosMantenimiento = mantenimientosData.reduce((sum, mantenimiento) => sum + (mantenimiento.costoReparacion || 0), 0);
      console.log('🔧 Debug Dashboard - Total gastos mantenimiento calculado:', gastosMantenimiento);
      
      // Retiros de capital
      const retirosCapital = movimientosCapitalData
        .filter(mov => mov.tipo === 'retiro')
        .reduce((sum, mov) => sum + (mov.efectivo + mov.nequi + mov.daviplata), 0);
      
      // Total gastos = Gastos Generales + Mantenimientos + Retiros de Capital
      const totalGastos = gastosGenerales + gastosMantenimiento + retirosCapital;
      
      // Ingresos reales = Servicios + Capital Inicial + Inyecciones
      const ingresosReales = ingresosServicios + capitalInicial + inyeccionesCapital;
      
      console.log('💰 Desglose de Ingresos Reales:', {
        ingresosServicios: ingresosServicios,
        capitalInicial: capitalInicial,
        inyeccionesCapital: inyeccionesCapital,
        ingresosReales: ingresosReales
      });
      
      console.log('💸 Desglose de Gastos:', {
        gastosGenerales: gastosGenerales,
        gastosMantenimiento: gastosMantenimiento,
        retirosCapital: retirosCapital,
        totalGastos: totalGastos
      });

      const cuentasPorCobrar = pedidosData.reduce((sum, pedido) => {
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        const saldoPendiente = Math.max(0, (pedido.total || 0) - totalPagado);
        return sum + saldoPendiente;
      }, 0);
      
      setIngresosReales(ingresosReales);
      setTotalPedidos(pedidosData.length);
      setTotalGastos(totalGastos);
      setCuentasPorCobrar(cuentasPorCobrar);
      setCapitalInicial(capitalInicial);
      setInyeccionesCapital(inyeccionesCapital);
      setIngresosServicios(ingresosServicios);
      setGastosGenerales(gastosGenerales);
      setGastosMantenimiento(gastosMantenimiento);
      setRetirosCapital(retirosCapital);
      
      // Calcular saldos por medio de pago (incluyendo gastos)
      const saldosCalculados = {
        efectivo: { ingresos: capitalInicialData?.efectivo || 0, gastos: 0, saldo: capitalInicialData?.efectivo || 0 },
        nequi: { ingresos: capitalInicialData?.nequi || 0, gastos: 0, saldo: capitalInicialData?.nequi || 0 },
        daviplata: { ingresos: capitalInicialData?.daviplata || 0, gastos: 0, saldo: capitalInicialData?.daviplata || 0 }
      };
      
      // Procesar pagos reales
      pedidosData.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          pedido.pagosRealizados.forEach(pago => {
            const medioPago = pago.medioPago || 'efectivo';
            if (medioPago === 'efectivo') {
                saldosCalculados.efectivo.ingresos += pago.monto;
            } else if (medioPago === 'nequi') {
                saldosCalculados.nequi.ingresos += pago.monto;
            } else if (medioPago === 'daviplata') {
                saldosCalculados.daviplata.ingresos += pago.monto;
            }
          });
        }
      });
      
      // Procesar gastos generales
      gastosData.forEach(gasto => {
        const medioPago = gasto.medioPago || 'efectivo';
        if (medioPago === 'efectivo') {
          saldosCalculados.efectivo.gastos += gasto.amount;
        } else if (medioPago === 'nequi') {
          saldosCalculados.nequi.gastos += gasto.amount;
        } else if (medioPago === 'daviplata') {
          saldosCalculados.daviplata.gastos += gasto.amount;
        }
      });
      
      // Procesar gastos de mantenimiento
      console.log('🔧 Debug Dashboard - Procesando mantenimientos para saldos...');
      mantenimientosData.forEach(mantenimiento => {
        const medioPago = mantenimiento.medioPago || 'efectivo';
        const costo = mantenimiento.costoReparacion || 0;
        console.log('🔧 Procesando mantenimiento:', mantenimiento.id, 'costo:', costo, 'medioPago:', medioPago);
        
        if (medioPago === 'efectivo') {
          saldosCalculados.efectivo.gastos += costo;
        } else if (medioPago === 'nequi') {
          saldosCalculados.nequi.gastos += costo;
        } else if (medioPago === 'daviplata') {
          saldosCalculados.daviplata.gastos += costo;
        }
      });
      console.log('🔧 Debug Dashboard - Saldos después de procesar mantenimientos:', saldosCalculados);
      
      // Procesar movimientos de capital
      movimientosCapitalData.forEach(mov => {
        if (mov.tipo === 'inyeccion') {
          saldosCalculados.efectivo.ingresos += mov.efectivo;
          saldosCalculados.nequi.ingresos += mov.nequi;
          saldosCalculados.daviplata.ingresos += mov.daviplata;
        } else if (mov.tipo === 'retiro') {
          saldosCalculados.efectivo.gastos += mov.efectivo;
          saldosCalculados.nequi.gastos += mov.nequi;
          saldosCalculados.daviplata.gastos += mov.daviplata;
        }
      });
      
      // Calcular saldos finales
      saldosCalculados.efectivo.saldo = saldosCalculados.efectivo.ingresos - saldosCalculados.efectivo.gastos;
      saldosCalculados.nequi.saldo = saldosCalculados.nequi.ingresos - saldosCalculados.nequi.gastos;
      saldosCalculados.daviplata.saldo = saldosCalculados.daviplata.ingresos - saldosCalculados.daviplata.gastos;
      
      setSaldosPorMedioDePago(saldosCalculados);
      
      
      console.log('✅ Datos simplificados cargados correctamente');
      
      } catch (error) {
      console.error('❌ Error al cargar datos simplificados:', error);
      } finally {
        setLoading(false);
      }
    };

  // useEffect principal
  useEffect(() => {
    cargarDatosSimplificados();
  }, []);

  // Escuchar eventos de mantenimiento para recargar datos
  useEffect(() => {
    const handleMantenimientoRealizado = () => {
      console.log('🔄 Dashboard - Mantenimiento realizado, recargando datos...');
      cargarDatosSimplificados();
    };

    window.addEventListener('mantenimientoRealizado', handleMantenimientoRealizado);
    
    return () => {
      window.removeEventListener('mantenimientoRealizado', handleMantenimientoRealizado);
    };
  }, []);

  // Funciones de manejo de eventos
  const handleModificacionesServicio = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setMostrarModalModificaciones(true);
  };

  const handleModificacionExitosa = async () => {
    setMostrarModalModificaciones(false);
    setPedidoSeleccionado(null);
    await cargarDatosSimplificados();
  };

  const handleRegistrarPago = (pedido: Pedido) => {
    setPedidoParaPago(pedido);
    setMostrarModalPagos(true);
  };

  const handlePagoRealizado = async () => {
    try {
      setMostrarModalPagos(false);
      setPedidoParaPago(null);
      await cargarDatosSimplificados();
    } catch (error) {
      console.error('Dashboard - Error al registrar pago:', error);
      alert('Error al registrar pago: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleMarcarEntregado = (pedido: Pedido) => {
    setPedidoParaEntrega(pedido);
    setMostrarModalEntregaOperativa(true);
  };

  const handleMarcarRecogido = (pedido: Pedido) => {
    setPedidoParaRecogida(pedido);
    setMostrarModalRecogidaOperativa(true);
  };

  const handleEntregaOperativa = async (entregaData: any) => {
    if (!pedidoParaEntrega) return;

    try {
      const result = await entregaOperativaService.procesarEntregaOperativa(
        pedidoParaEntrega,
        entregaData,
        lavadoras
      );
      
      console.log('Dashboard - Entrega operativa exitosa');
      
      // Cerrar modal de entrega operativa
      setMostrarModalEntregaOperativa(false);
      
      // Abrir modal de WhatsApp directamente con la foto de evidencia
      setPedidoParaWhatsApp(pedidoParaEntrega);
      setFotoEvidenciaWhatsApp(entregaData.fotoInstalacion || null);
      setMostrarModalWhatsApp(true);
      
      // Limpiar estado
      setPedidoParaEntrega(null);
      
      // Recargar datos
      await cargarDatosSimplificados();
    } catch (error: any) {
      console.error('Error al procesar la entrega operativa:', error);
      alert(error.message || 'Error al procesar la entrega');
    }
  };

  const handleRecogidaOperativa = async (recogidaData: any) => {
    if (!pedidoParaRecogida) return;

    try {
      await recogidaOperativaService.procesarRecogidaOperativa(
        pedidoParaRecogida.id,
        recogidaData
      );
      alert('Servicio marcado como recogido exitosamente');
      setMostrarModalRecogidaOperativa(false);
      setPedidoParaRecogida(null);
      await cargarDatosSimplificados();
    } catch (error: any) {
      console.error('Error al procesar la recogida operativa:', error);
      alert(error.message || 'Error al procesar la recogida');
    }
  };

  const handleAbrirHistorialSaldos = async (tipo: 'efectivo' | 'nequi' | 'daviplata') => {
    console.log('🔍 Abriendo historial de saldos para:', tipo);
    setTipoSaldoSeleccionado(tipo);
    setMostrarModalHistorialSaldos(true);
    
    // Cargar movimientos para el tipo de saldo seleccionado
    setCargandoMovimientos(true);
    try {
      console.log('📊 Cargando movimientos desde Firebase...');
      const movimientos = await MovimientosSaldosService.obtenerMovimientosPorMedioPago(tipo);
      console.log('✅ Movimientos cargados:', movimientos.length, movimientos);
      setMovimientosSaldos(movimientos);
    } catch (error) {
      console.error('❌ Error al cargar movimientos:', error);
      setMovimientosSaldos([]);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
      <div>
          <h1 className="text-3xl font-bold text-primary-800">Dashboard</h1>
          <p className="text-gray-600">Resumen histórico completo - Todos los datos registrados</p>
        </div>
        <button
          onClick={cargarDatosSimplificados}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Recargar
        </button>
      </div>

      {/* Tarjetas de Resumen Financiero - Diseño Compacto */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {/* Capital */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-purple-100 p-2 rounded-full mb-2">
            <WalletIcon className="h-5 w-5 text-purple-600" />
              </div>
          <p className="text-gray-500 text-xs font-medium">Capital</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(capitalInicial + inyeccionesCapital)}</p>
              </div>

        {/* Servicios */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-green-100 p-2 rounded-full mb-2">
            <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
            </div>
          <p className="text-gray-500 text-xs font-medium">Servicios</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(ingresosServicios)}</p>
      </div>

        {/* Total Pedidos */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-blue-100 p-2 rounded-full mb-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-gray-500 text-xs font-medium">Total Pedidos</p>
          <p className="text-lg font-semibold text-gray-900">{totalPedidos}</p>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-red-100 p-2 rounded-full mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              </div>
          <p className="text-gray-500 text-xs font-medium">Gastos</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(gastosGenerales)}</p>
              </div>

        {/* Mantenimientos */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-orange-100 p-2 rounded-full mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
            </div>
          <p className="text-gray-500 text-xs font-medium">Mantenimientos</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(gastosMantenimiento)}</p>
              </div>

        {/* Retiros */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-yellow-100 p-2 rounded-full mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
            </div>
          <p className="text-gray-500 text-xs font-medium">Retiros</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(retirosCapital)}</p>
          </div>

        {/* Cuentas por Cobrar */}
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center">
          <div className="flex-shrink-0 bg-indigo-100 p-2 rounded-full mb-2">
            <ChartBarIcon className="h-5 w-5 text-indigo-600" />
              </div>
          <p className="text-gray-500 text-xs font-medium">Cuentas por Cobrar</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(cuentasPorCobrar)}</p>
            </div>
          </div>

      {/* Saldos por Medio de Pago */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <WalletIcon className="h-6 w-6 mr-2 text-primary-600" />
          Saldos por Medio de Pago
          <span className="ml-4 text-sm text-gray-500">* Incluye gastos de mantenimiento</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            className="bg-green-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => handleAbrirHistorialSaldos('efectivo')}
          >
            <div>
              <p className="text-green-700 font-medium">Efectivo</p>
              <p className="text-sm text-gray-600">Ingresos: {formatCurrency(saldosPorMedioDePago.efectivo.ingresos)}</p>
              <p className="text-sm text-gray-600">Gastos: {formatCurrency(saldosPorMedioDePago.efectivo.gastos)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-800">{formatCurrency(saldosPorMedioDePago.efectivo.saldo)}</p>
              <span className="text-xs text-green-600">Saldo positivo</span>
            </div>
          </div>
          <div 
            className="bg-purple-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={() => handleAbrirHistorialSaldos('nequi')}
          >
            <div>
              <p className="text-purple-700 font-medium">Nequi</p>
              <p className="text-sm text-gray-600">Ingresos: {formatCurrency(saldosPorMedioDePago.nequi.ingresos)}</p>
              <p className="text-sm text-gray-600">Gastos: {formatCurrency(saldosPorMedioDePago.nequi.gastos)}</p>
        </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-800">{formatCurrency(saldosPorMedioDePago.nequi.saldo)}</p>
              <span className="text-xs text-purple-600">Saldo positivo</span>
        </div>
      </div>
          <div 
            className="bg-indigo-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-indigo-100 transition-colors"
            onClick={() => handleAbrirHistorialSaldos('daviplata')}
          >
            <div>
              <p className="text-indigo-700 font-medium">Daviplata</p>
              <p className="text-sm text-gray-600">Ingresos: {formatCurrency(saldosPorMedioDePago.daviplata.ingresos)}</p>
              <p className="text-sm text-gray-600">Gastos: {formatCurrency(saldosPorMedioDePago.daviplata.gastos)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-800">{formatCurrency(saldosPorMedioDePago.daviplata.saldo)}</p>
              <span className="text-xs text-indigo-600">Saldo positivo</span>
        </div>
          </div>
        </div>
            </div>


      {/* Pedidos Pendientes */}
      <PedidosPendientes
        pedidosPendientesEntregar={pedidosPendientesEntregar}
        pedidosPendientesRecoger={pedidosPendientesRecoger}
        pedidosCompletadosConSaldo={pedidosCompletadosConSaldo}
        onMarcarEntregado={(pedidoId: string) => {
          const pedido = pedidosPendientesEntregar.find(p => p.id === pedidoId);
          if (pedido) handleMarcarEntregado(pedido);
        }}
        onMarcarRecogido={(pedidoId: string) => {
          const pedido = pedidosPendientesRecoger.find(p => p.id === pedidoId);
          if (pedido) handleMarcarRecogido(pedido);
        }}
        onModificarServicio={handleModificacionesServicio}
        onRegistrarPago={handleRegistrarPago}
      />

      {/* Modals */}
      {pedidoSeleccionado && (
        <ModalModificacionesServicio
          pedido={pedidoSeleccionado}
          onClose={() => setMostrarModalModificaciones(false)}
          planes={planes}
          isOpen={mostrarModalModificaciones}
          onModificacionAplicada={handleModificacionExitosa}
        />
      )}

      {pedidoParaPago && (
        <ModalPagos
          pedido={pedidoParaPago}
          onClose={() => setMostrarModalPagos(false)}
          onPagoRealizado={handlePagoRealizado}
          isOpen={mostrarModalPagos}
        />
      )}

      {pedidoParaRecogida && (
        <ModalRecogidaOperativa
          pedido={pedidoParaRecogida}
          onClose={() => setMostrarModalRecogidaOperativa(false)}
          onConfirm={handleRecogidaOperativa}
          isOpen={mostrarModalRecogidaOperativa}
        />
      )}

      {pedidoParaEntrega && (
        <ModalEntregaOperativa
          pedido={pedidoParaEntrega}
          onClose={() => setMostrarModalEntregaOperativa(false)}
          onConfirm={handleEntregaOperativa}
          isOpen={mostrarModalEntregaOperativa}
          lavadoras={lavadoras}
        />
      )}

      {/* Modal de WhatsApp */}
      {mostrarModalWhatsApp && pedidoParaWhatsApp && (
        <ModalWhatsApp
          isOpen={mostrarModalWhatsApp}
          onClose={() => {
            setMostrarModalWhatsApp(false);
            setPedidoParaWhatsApp(null);
            setFotoEvidenciaWhatsApp(null);
          }}
          pedido={pedidoParaWhatsApp}
          fotoEvidencia={fotoEvidenciaWhatsApp || undefined}
        />
      )}

      {/* Modal de Historial de Saldos */}
      <ModalHistorialSaldos
        isOpen={mostrarModalHistorialSaldos}
        onClose={() => setMostrarModalHistorialSaldos(false)}
        tipoSaldo={tipoSaldoSeleccionado}
        saldoActual={saldosPorMedioDePago[tipoSaldoSeleccionado].saldo}
        movimientos={movimientosSaldos}
        cargando={cargandoMovimientos}
      />
    </div>
  );
};

export default Dashboard;
import React, { useState, useEffect } from 'react';
import { 
  ClipboardDocumentListIcon, 
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ArrowPathIcon,
  WalletIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { Pedido, PagoRealizado } from '../types';
import { pedidoService, configService, planService } from '../services/firebaseService';
import { formatCurrency } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import ModalModificacionesServicio from '../components/ModalModificacionesServicio';
import ModalPagos from '../components/ModalPagos';
import ModalRecogidaOperativa from '../components/ModalRecogidaOperativa';
import { recogidaOperativaService } from '../services/recogidaOperativaService';
import PedidosPendientes from '../components/PedidosPendientes';

const Dashboard: React.FC = () => {
  const { firebaseUser } = useAuth();

  // Estados básicos
  const [loading, setLoading] = useState(true);
  const [ingresosReales, setIngresosReales] = useState<number>(0);
  const [totalPedidos, setTotalPedidos] = useState<number>(0);
  const [totalGastos, setTotalGastos] = useState<number>(0);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<number>(0);
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

  // Estados de configuración
  const [configuracion, setConfiguracion] = useState<any>(null);
  const [planes, setPlanes] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);

  // Función para cargar datos simplificados
  const cargarDatosSimplificados = async () => {
    try {
      console.log('🔄 Cargando datos simplificados...');
      
      // Obtener datos básicos
      const [pedidosData, configuracionData, planesData] = await Promise.all([
        pedidoService.getAllPedidos(),
        configService.getConfiguracion(),
        planService.getActivePlans()
      ]);
      
      setConfiguracion(configuracionData);
      setPlanes(planesData);
      
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
      const ingresosReales = pedidosData.reduce((sum, pedido) => {
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        return sum + totalPagado;
      }, 0);

      const cuentasPorCobrar = pedidosData.reduce((sum, pedido) => {
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        const saldoPendiente = Math.max(0, (pedido.total || 0) - totalPagado);
        return sum + saldoPendiente;
      }, 0);
      
      setIngresosReales(ingresosReales);
      setTotalPedidos(pedidosData.length);
      setCuentasPorCobrar(cuentasPorCobrar);
      
      // Calcular saldos por medio de pago (simplificado)
      const saldosCalculados = {
        efectivo: { ingresos: 500000, gastos: 0, saldo: 500000 },
        nequi: { ingresos: 500000, gastos: 0, saldo: 500000 },
        daviplata: { ingresos: 500000, gastos: 0, saldo: 500000 }
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
      
      // Calcular saldos finales
      saldosCalculados.efectivo.saldo = saldosCalculados.efectivo.ingresos - saldosCalculados.efectivo.gastos;
      saldosCalculados.nequi.saldo = saldosCalculados.nequi.ingresos - saldosCalculados.nequi.gastos;
      saldosCalculados.daviplata.saldo = saldosCalculados.daviplata.ingresos - saldosCalculados.daviplata.gastos;
      
      setSaldosPorMedioDePago(saldosCalculados);
      
      // Preparar pagos para la sección "Pagos Recibidos"
      const allPagos: any[] = [];
      pedidosData.forEach(pedido => {
        pedido.pagosRealizados?.forEach(pago => {
          allPagos.push({
            ...pago,
            clienteName: pedido.cliente.name,
            pedidoId: pedido.id,
          });
        });
      });
      setPagos(allPagos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()));
      
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
      alert('Pago registrado exitosamente');
    } catch (error) {
      console.error('Dashboard - Error al registrar pago:', error);
      alert('Error al registrar pago: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleMarcarRecogido = (pedido: Pedido) => {
    setPedidoParaRecogida(pedido);
    setMostrarModalRecogidaOperativa(true);
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

      {/* Tarjetas de Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 flex items-center space-x-4">
          <div className="flex-shrink-0 bg-green-100 p-3 rounded-full">
            <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              </div>
          <div>
            <p className="text-gray-500 text-sm">Ingresos Reales</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(ingresosReales)}</p>
              </div>
      </div>

        <div className="bg-white rounded-lg shadow-md p-6 flex items-center space-x-4">
          <div className="flex-shrink-0 bg-blue-100 p-3 rounded-full">
            <ClipboardDocumentListIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-gray-500 text-sm">Total Pedidos</p>
            <p className="text-2xl font-semibold text-gray-900">{totalPedidos}</p>
        </div>
              </div>

        <div className="bg-white rounded-lg shadow-md p-6 flex items-center space-x-4">
          <div className="flex-shrink-0 bg-yellow-100 p-3 rounded-full">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
          <div>
            <p className="text-gray-500 text-sm">Total Gastos</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalGastos)}</p>
            </div>
          </div>

        <div className="bg-white rounded-lg shadow-md p-6 flex items-center space-x-4">
          <div className="flex-shrink-0 bg-blue-100 p-3 rounded-full">
            <ChartBarIcon className="h-6 w-6 text-blue-600" />
              </div>
          <div>
            <p className="text-gray-500 text-sm">Cuentas por Cobrar</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(cuentasPorCobrar)}</p>
              </div>
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
          <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between">
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
          <div className="bg-purple-50 p-4 rounded-lg flex items-center justify-between">
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
          <div className="bg-indigo-50 p-4 rounded-lg flex items-center justify-between">
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

      {/* Pagos Recibidos */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <BanknotesIcon className="h-6 w-6 mr-2 text-yellow-600" />
          Pagos Recibidos
        </h2>
        <div className="space-y-4">
          {pagos.length === 0 ? (
            <p className="text-gray-500">No hay pagos registrados.</p>
          ) : (
            pagos.map((pago, index) => (
              <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-center space-x-3">
                  <span
                    className={`h-3 w-3 rounded-full ${pago.medioPago === 'efectivo' ? 'bg-green-500' : pago.medioPago === 'nequi' ? 'bg-blue-500' : 'bg-purple-500'}`}
                  ></span>
                  <p className="text-gray-700 font-medium capitalize">{pago.medioPago} {pago.isPartial ? 'Abono' : ''}</p>
                  <p className="text-sm text-gray-500">{pago.clienteName}</p>
                  </div>
                <p className="text-gray-900 font-semibold">{formatCurrency(pago.monto)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pedidos Pendientes */}
      <PedidosPendientes
        pedidosPendientesEntregar={pedidosPendientesEntregar}
        pedidosPendientesRecoger={pedidosPendientesRecoger}
        pedidosCompletadosConSaldo={pedidosCompletadosConSaldo}
        onMarcarEntregado={() => {}}
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
    </div>
  );
};

export default Dashboard;
import React, { useState, useEffect } from 'react';
import { 
  ClipboardDocumentListIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  FunnelIcon,
  XMarkIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, getCurrentDateColombia } from '../utils/dateUtils';
import { pedidoService, reporteService, gastoService, clienteService, lavadoraService, configService, planService } from '../services/firebaseService';
import { obtenerHistorialMantenimiento } from '../services/mantenimientoService';
import { capitalService } from '../services/capitalService';
import { entregaOperativaService } from '../services/entregaOperativaService';
import { recogidaOperativaService } from '../services/recogidaOperativaService';
import { modificacionesService } from '../services/modificacionesService';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Pedido, ReporteDiario, Lavadora, Configuracion, Plan } from '../types';
import PedidosPendientes from '../components/PedidosPendientes';
import ModalEntregaOperativa from '../components/ModalEntregaOperativa';
import ModalFacturacion from '../components/ModalFacturacion';
import ModalLiquidacion from '../components/ModalLiquidacion';
import ModalWhatsApp from '../components/ModalWhatsApp';
import ModalModificacionesServicio from '../components/ModalModificacionesServicio';
import ModalPagos from '../components/ModalPagos';
import ResumenFinalServicio from '../components/ResumenFinalServicio';

const Dashboard: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [reporteDiario, setReporteDiario] = useState<ReporteDiario | null>(null);
  const [pedidosPendientes, setPedidosPendientes] = useState<Pedido[]>([]);
  const [pedidosPendientesEntregar, setPedidosPendientesEntregar] = useState<Pedido[]>([]);
  const [pedidosPendientesRecoger, setPedidosPendientesRecoger] = useState<Pedido[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [ingresosPorPlan, setIngresosPorPlan] = useState<{ [key: string]: { name: string; amount: number; count: number } }>({});
  const [loading, setLoading] = useState(true);
  
  // Estados para modales de validación y facturación
  const [mostrarModalEntregaOperativa, setMostrarModalEntregaOperativa] = useState(false);
  const [mostrarModalFacturacion, setMostrarModalFacturacion] = useState(false);
  const [mostrarModalLiquidacion, setMostrarModalLiquidacion] = useState(false);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [pedidoAValidar, setPedidoAValidar] = useState<Pedido | null>(null);
  const [pedidoAFacturar, setPedidoAFacturar] = useState<Pedido | null>(null);
  const [pedidoParaWhatsApp, setPedidoParaWhatsApp] = useState<Pedido | null>(null);
  const [fotoEvidenciaWhatsApp, setFotoEvidenciaWhatsApp] = useState<string | null>(null);
  
  // Estados para modales de modificaciones dinámicas
  const [mostrarModalModificaciones, setMostrarModalModificaciones] = useState(false);
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [mostrarResumenFinal, setMostrarResumenFinal] = useState(false);
  const [pedidoParaModificar, setPedidoParaModificar] = useState<Pedido | null>(null);
  
  const [lavadoras, setLavadoras] = useState<Lavadora[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  
  // Estados para filtro de fechas del resumen financiero
  const [filtroFinanciero, setFiltroFinanciero] = useState({
    tipo: 'hoy' as 'hoy' | 'ayer' | 'personalizado',
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia()
  });
  
  // Estados para datos financieros filtrados
  const [datosFinancieros, setDatosFinancieros] = useState({
    ingresos: 0,
    gastos: 0,
    gastosGenerales: 0,
    gastosMantenimiento: 0,
    neto: 0,
    ingresosPorPlan: {} as { [key: string]: { name: string; amount: number; count: number } },
    pedidosCompletados: 0,
    cuentasPorCobrar: 0,
    cuentasPorCobrarPorCliente: {} as { [key: string]: any },
    saldosPorMedio: {
      efectivo: { ingresos: 0, gastos: 0, saldo: 0 },
      nequi: { ingresos: 0, gastos: 0, saldo: 0 },
      daviplata: { ingresos: 0, gastos: 0, saldo: 0 }
    }
  });

  // Estados para saldos por medio de pago
  const [saldosPorMedio, setSaldosPorMedio] = useState({
    efectivo: { ingresos: 0, gastos: 0, saldo: 0 },
    nequi: { ingresos: 0, gastos: 0, saldo: 0 },
    daviplata: { ingresos: 0, gastos: 0, saldo: 0 }
  });

  // Estados para sección de pagos
  const [filtroPagos, setFiltroPagos] = useState({
    tipo: 'hoy' as 'hoy' | 'ayer' | 'personalizado',
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia()
  });
  const [pagosRecibidos, setPagosRecibidos] = useState<any[]>([]);
  const [resumenPagos, setResumenPagos] = useState({
    total: 0,
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
    cantidad: 0
  });

  // Función para obtener pagos recibidos
  const obtenerPagosRecibidos = async (filtro: typeof filtroPagos) => {
    try {
      let fechaInicio: Date;
      let fechaFin: Date;

      if (filtro.tipo === 'hoy') {
        fechaInicio = (() => {
          const hoy = getCurrentDateColombia();
          hoy.setHours(0, 0, 0, 0);
          return hoy;
        })();
        fechaFin = (() => {
          const hoy = getCurrentDateColombia();
          hoy.setHours(23, 59, 59, 999);
          return hoy;
        })();
      } else if (filtro.tipo === 'ayer') {
        const ayer = new Date(getCurrentDateColombia());
        ayer.setDate(ayer.getDate() - 1);
        ayer.setHours(0, 0, 0, 0);
        fechaInicio = ayer;
        ayer.setHours(23, 59, 59, 999);
        fechaFin = ayer;
      } else {
        fechaInicio = filtro.fechaInicio;
        fechaFin = filtro.fechaFin;
      }

      // Normalizar fechas para comparación
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);

      const pedidos = await pedidoService.getAllPedidos();
      console.log('🔍 Dashboard - Filtros de pagos:', {
        tipo: filtro.tipo,
        fechaInicio: fechaInicio.toISOString(),
        fechaFin: fechaFin.toISOString(),
        fechaInicioLocal: fechaInicio.toLocaleString('es-CO'),
        fechaFinLocal: fechaFin.toLocaleString('es-CO')
      });
      console.log('📊 Dashboard - Total pedidos:', pedidos.length);
      
      const todosLosPagos: any[] = [];

      // Recopilar todos los pagos de los pedidos
      pedidos.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          pedido.pagosRealizados.forEach(pago => {
            // Manejar correctamente los timestamps de Firebase
            let fechaPago: Date;
            if (pago.fecha instanceof Date) {
              fechaPago = pago.fecha;
            } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
              fechaPago = (pago.fecha as any).toDate();
            } else {
              fechaPago = new Date(pago.fecha);
            }
            
            if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
              todosLosPagos.push({
                ...pago,
                pedidoId: pedido.id,
                clienteName: pedido.cliente.name,
                planName: pedido.plan.name,
                servicioId: pedido.id.slice(-6)
              });
            }
          });
        }
      });

      // Ordenar por fecha (más recientes primero)
      todosLosPagos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      console.log('✅ Dashboard - Pagos encontrados:', todosLosPagos.length);
      console.log('📋 Dashboard - Pagos:', todosLosPagos.map(p => ({
        cliente: p.clienteName,
        monto: p.monto,
        fecha: p.fecha,
        medioPago: p.medioPago
      })));

      // Calcular resumen
      const resumen = {
        total: todosLosPagos.reduce((sum, pago) => sum + pago.monto, 0),
        efectivo: todosLosPagos.filter(p => p.medioPago === 'efectivo').reduce((sum, pago) => sum + pago.monto, 0),
        nequi: todosLosPagos.filter(p => p.medioPago === 'nequi').reduce((sum, pago) => sum + pago.monto, 0),
        daviplata: todosLosPagos.filter(p => p.medioPago === 'daviplata').reduce((sum, pago) => sum + pago.monto, 0),
        cantidad: todosLosPagos.length
      };

      setPagosRecibidos(todosLosPagos);
      setResumenPagos(resumen);
    } catch (error) {
      console.error('Error al obtener pagos recibidos:', error);
    }
  };

  // Función para calcular datos financieros basados en el filtro
  const calcularDatosFinancieros = async (filtro: typeof filtroFinanciero) => {
    try {
      let fechaInicio: Date;
      let fechaFin: Date;

      // Determinar fechas según el tipo de filtro
      if (filtro.tipo === 'hoy') {
        const hoy = getCurrentDateColombia();
        fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
      } else if (filtro.tipo === 'ayer') {
        const ayer = new Date(getCurrentDateColombia());
        ayer.setDate(ayer.getDate() - 1);
        fechaInicio = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());
        fechaFin = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59);
      } else {
        fechaInicio = filtro.fechaInicio;
        fechaFin = filtro.fechaFin;
      }

      // Debug: Verificar fechas
      console.log('🔍 Debug Filtro Financiero:');
      console.log('Tipo de filtro:', filtro.tipo);
      console.log('Fecha inicio:', fechaInicio.toISOString());
      console.log('Fecha fin:', fechaFin.toISOString());

      // Obtener pedidos del rango de fechas
      const todosLosPedidos = await pedidoService.getAllPedidos();
      console.log('Total pedidos:', todosLosPedidos.length);
      
      // Usar TODOS los pedidos para procesar pagos (no filtrar por fecha de entrega)
      // Los pagos se filtrarán por fecha de pago, no por fecha de entrega
      const pedidosFiltrados = todosLosPedidos;
      
      console.log('Total pedidos para procesar:', pedidosFiltrados.length);

      // Obtener gastos del rango de fechas
      const todosLosGastos = await gastoService.getGastosDelRango(fechaInicio, fechaFin);
      const totalGastosGenerales = todosLosGastos.reduce((sum, gasto) => sum + gasto.amount, 0);
      
      // Obtener capital inicial y movimientos de capital
      const [capitalInicialData, todosLosMovimientosCapital] = await Promise.all([
        capitalService.getCapitalInicial(),
        capitalService.getMovimientosCapital()
      ]);
      
      const movimientosCapitalFiltrados = todosLosMovimientosCapital.filter(movimiento => {
        const fechaMovimiento = movimiento.fecha;
        return fechaMovimiento >= fechaInicio && fechaMovimiento <= fechaFin;
      });
      
      // Obtener gastos de mantenimiento de lavadoras del rango de fechas
      // Obtener todos los mantenimientos directamente de la colección
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
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      });
      const mantenimientosFiltrados = todosLosMantenimientos.filter(mantenimiento => {
        // Usar fechaInicio o createdAt para determinar cuándo se hizo efectivo el gasto
        const fechaMantenimiento = mantenimiento.fechaInicio || mantenimiento.createdAt;
        return fechaMantenimiento >= fechaInicio && fechaMantenimiento <= fechaFin;
      });
      const totalGastosMantenimiento = mantenimientosFiltrados.reduce((sum, mantenimiento) => sum + (mantenimiento.costoReparacion || 0), 0);
      
      console.log('🔧 Gastos de mantenimiento - Debug:');
      console.log('📊 Total mantenimientos encontrados:', todosLosMantenimientos.length);
      console.log('📅 Mantenimientos filtrados:', mantenimientosFiltrados.length);
      console.log('💰 Total gastos mantenimiento:', totalGastosMantenimiento);
      console.log('📋 Todos los mantenimientos (detalles):', todosLosMantenimientos.map(m => ({
        id: m.id,
        costo: m.costoReparacion,
        fechaFin: m.fechaFin,
        fechaInicio: m.fechaInicio,
        descripcion: m.descripcion,
        tieneFechaFin: !!m.fechaFin
      })));
      console.log('📅 Filtro de fechas:', {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        tipo: 'Mantenimientos por fechaInicio/createdAt (gastos efectivos desde creación)'
      });
      
      const totalGastos = totalGastosGenerales + totalGastosMantenimiento;

      // Calcular ingresos reales como saldo final neto (no suma bruta)
      // Los ingresos reales serán el saldo total final calculado después de procesar todos los movimientos
      let ingresosReales = 0; // Se calculará después de procesar todos los movimientos

      // Calcular cuentas por cobrar (saldos pendientes de todos los servicios)
      const cuentasPorCobrar = pedidosFiltrados.reduce((sum, pedido) => {
        return sum + (pedido.saldoPendiente || 0);
      }, 0);

      // Calcular ingresos por medio de pago
      const ingresosPorMedioPago = {
        efectivo: 0,
        nequi: 0,
        daviplata: 0
      };

      pedidosFiltrados.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          pedido.pagosRealizados.forEach(pago => {
            // Verificar que el pago esté en el rango de fechas
            let fechaPago: Date;
            if (pago.fecha instanceof Date) {
              fechaPago = pago.fecha;
            } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
              fechaPago = (pago.fecha as any).toDate();
            } else {
              fechaPago = new Date(pago.fecha);
            }
            
            if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
              if (pago.medioPago === 'efectivo') {
                ingresosPorMedioPago.efectivo += pago.monto;
              } else if (pago.medioPago === 'nequi') {
                ingresosPorMedioPago.nequi += pago.monto;
              } else if (pago.medioPago === 'daviplata') {
                ingresosPorMedioPago.daviplata += pago.monto;
              }
            }
          });
        }
      });

      // Calcular cuentas por cobrar por cliente
      const cuentasPorCobrarPorCliente: { [clienteId: string]: { 
        clienteName: string; 
        totalSaldo: number; 
        servicios: number;
        serviciosDetalle: Array<{servicioId: string; saldo: number; plan: string}>;
      } } = {};

      pedidosFiltrados.forEach(pedido => {
        // Calcular saldo pendiente restando los pagos ya realizados
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
        const saldoPendiente = Math.max(0, (pedido.total || 0) - totalPagado);
        if (saldoPendiente > 0) {
          const clienteId = pedido.clienteId;
          if (!cuentasPorCobrarPorCliente[clienteId]) {
            cuentasPorCobrarPorCliente[clienteId] = {
              clienteName: pedido.cliente.name,
              totalSaldo: 0,
              servicios: 0,
              serviciosDetalle: []
            };
          }
          
          cuentasPorCobrarPorCliente[clienteId].totalSaldo += saldoPendiente;
          cuentasPorCobrarPorCliente[clienteId].servicios += 1;
          cuentasPorCobrarPorCliente[clienteId].serviciosDetalle.push({
            servicioId: pedido.id.slice(-6),
            saldo: saldoPendiente,
            plan: pedido.plan.name
          });
        }
      });

      // Calcular ingresos por plan basado en pagos realizados
      const ingresosPorPlanCalculado: { [key: string]: { name: string; amount: number; count: number } } = {};
      
      pedidosFiltrados.forEach(pedido => {
        // Solo considerar pedidos que tienen pagos realizados
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          const totalPagado = pedido.pagosRealizados.reduce((sum, pago) => sum + pago.monto, 0);
          const planId = pedido.plan.id;
          const planName = pedido.plan.name;
          
          if (!ingresosPorPlanCalculado[planId]) {
            ingresosPorPlanCalculado[planId] = {
              name: planName,
              amount: 0,
              count: 0
            };
          }
          
          ingresosPorPlanCalculado[planId].amount += totalPagado;
          ingresosPorPlanCalculado[planId].count += 1;
        }
      });

      // Calcular saldos por medio de pago
      const saldosCalculados = {
        efectivo: { ingresos: 0, gastos: 0, saldo: 0 },
        nequi: { ingresos: 0, gastos: 0, saldo: 0 },
        daviplata: { ingresos: 0, gastos: 0, saldo: 0 }
      };

      console.log('📊 Debug saldos - Pedidos filtrados:', pedidosFiltrados.length);
      console.log('📊 Debug saldos - Gastos totales:', todosLosGastos.length);
      console.log('📊 Debug saldos - Movimientos capital:', movimientosCapitalFiltrados.length);
      console.log('📊 Debug saldos - Capital inicial:', capitalInicialData ? 'Existe' : 'No existe');

      // Calcular ingresos por medio de pago (basado en pagos reales)
      let pagosProcesados = 0;
      pedidosFiltrados.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          pedido.pagosRealizados.forEach(pago => {
            // Verificar que el pago esté en el rango de fechas
            let fechaPago: Date;
            if (pago.fecha instanceof Date) {
              fechaPago = pago.fecha;
            } else if (pago.fecha && typeof pago.fecha === 'object' && 'toDate' in pago.fecha) {
              fechaPago = (pago.fecha as any).toDate();
            } else {
              fechaPago = new Date(pago.fecha);
            }
            
            if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
              pagosProcesados++;
              console.log('💰 Procesando pago:', pago.medioPago, pago.monto);
              if (pago.medioPago === 'efectivo') {
                saldosCalculados.efectivo.ingresos += pago.monto;
              } else if (pago.medioPago === 'nequi') {
                saldosCalculados.nequi.ingresos += pago.monto;
              } else if (pago.medioPago === 'daviplata') {
                saldosCalculados.daviplata.ingresos += pago.monto;
              }
            }
          });
        }
      });
      console.log('📊 Pagos procesados para saldos:', pagosProcesados);

      // Calcular gastos por medio de pago
      let gastosProcesados = 0;
      todosLosGastos.forEach(gasto => {
        gastosProcesados++;
        console.log('💸 Procesando gasto:', gasto.medioPago, gasto.amount);
        if (gasto.medioPago === 'efectivo') {
          saldosCalculados.efectivo.gastos += gasto.amount;
        } else if (gasto.medioPago === 'nequi') {
          saldosCalculados.nequi.gastos += gasto.amount;
        } else if (gasto.medioPago === 'daviplata') {
          saldosCalculados.daviplata.gastos += gasto.amount;
        }
      });
      console.log('📊 Gastos procesados para saldos:', gastosProcesados);

      // Procesar movimientos de capital
      let movimientosCapitalProcesados = 0;
      movimientosCapitalFiltrados.forEach(movimiento => {
        movimientosCapitalProcesados++;
        console.log('💰 Procesando movimiento capital:', movimiento.tipo, movimiento.efectivo, movimiento.nequi, movimiento.daviplata);
        
        if (movimiento.tipo === 'inyeccion') {
          // Las inyecciones aumentan los ingresos
          saldosCalculados.efectivo.ingresos += movimiento.efectivo;
          saldosCalculados.nequi.ingresos += movimiento.nequi;
          saldosCalculados.daviplata.ingresos += movimiento.daviplata;
        } else if (movimiento.tipo === 'retiro') {
          // Los retiros aumentan los gastos
          saldosCalculados.efectivo.gastos += movimiento.efectivo;
          saldosCalculados.nequi.gastos += movimiento.nequi;
          saldosCalculados.daviplata.gastos += movimiento.daviplata;
        }
      });
      console.log('📊 Movimientos capital procesados:', movimientosCapitalProcesados);

      // Procesar capital inicial (si existe)
      if (capitalInicialData) {
        console.log('💰 Procesando capital inicial:', capitalInicialData.efectivo, capitalInicialData.nequi, capitalInicialData.daviplata);
        saldosCalculados.efectivo.ingresos += capitalInicialData.efectivo;
        saldosCalculados.nequi.ingresos += capitalInicialData.nequi;
        saldosCalculados.daviplata.ingresos += capitalInicialData.daviplata;
      }

      // Procesar gastos de mantenimiento usando el medio de pago real de cada mantenimiento
      mantenimientosFiltrados.forEach(mantenimiento => {
        const medioPago = (mantenimiento as any).medioPago || 'efectivo';
        const costo = mantenimiento.costoReparacion || 0;
        
        console.log('🔧 Procesando gasto mantenimiento:', medioPago, costo);
        
        if (medioPago === 'efectivo') {
          saldosCalculados.efectivo.gastos += costo;
        } else if (medioPago === 'nequi') {
          saldosCalculados.nequi.gastos += costo;
        } else if (medioPago === 'daviplata') {
          saldosCalculados.daviplata.gastos += costo;
        }
      });

      // Procesar pagos de pedidos (pagosRealizados)
      let pagosPedidosProcesados = 0;
      todosLosPedidos.forEach(pedido => {
        if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
          console.log('🔍 Pedido con pagos:', pedido.id, pedido.cliente.name, pedido.pagosRealizados);
          pedido.pagosRealizados.forEach((pago, index) => {
            pagosPedidosProcesados++;
            console.log('💰 Procesando pago de pedido:', {
              index,
              pedidoId: pedido.id,
              cliente: pedido.cliente.name,
              pagoCompleto: pago,
              medioPago: pago.medioPago,
              monto: pago.monto,
              fecha: pago.fecha,
              tipoMedioPago: typeof pago.medioPago,
              esUndefined: pago.medioPago === undefined,
              esNull: pago.medioPago === null
            });
            
            // Usar fallback si medioPago es undefined
            const medioPagoReal = pago.medioPago || 'efectivo';
            console.log('🔧 Usando medio de pago:', medioPagoReal);
            
            if (medioPagoReal === 'efectivo') {
              saldosCalculados.efectivo.ingresos += pago.monto;
            } else if (medioPagoReal === 'nequi') {
              saldosCalculados.nequi.ingresos += pago.monto;
            } else if (medioPagoReal === 'daviplata') {
              saldosCalculados.daviplata.ingresos += pago.monto;
            }
          });
        }
      });
      console.log('📊 Pagos de pedidos procesados:', pagosPedidosProcesados);

      // Calcular saldos
      Object.keys(saldosCalculados).forEach(medio => {
        const medioKey = medio as keyof typeof saldosCalculados;
        saldosCalculados[medioKey].saldo = saldosCalculados[medioKey].ingresos - saldosCalculados[medioKey].gastos;
      });

      // Calcular ingresos reales como saldo total final
      ingresosReales = saldosCalculados.efectivo.saldo + saldosCalculados.nequi.saldo + saldosCalculados.daviplata.saldo;

      console.log('🔍 Saldos calculados:', saldosCalculados);
      console.log('💰 Ingresos reales (saldo final):', ingresosReales);
      setSaldosPorMedio(saldosCalculados);

      const resultado = {
        // Ingresos reales (solo pagos recibidos)
        ingresos: ingresosReales,
        ingresosPorMedioPago,
        
        // Gastos reales
        gastos: totalGastos,
        gastosGenerales: totalGastosGenerales,
        gastosMantenimiento: totalGastosMantenimiento,
        
        // Cuentas por cobrar
        cuentasPorCobrar,
        cuentasPorCobrarPorCliente,
        
        // Saldos por medio de pago
        saldosPorMedio: saldosCalculados,
        
        // Cálculo del neto
        neto: ingresosReales - totalGastos,
        
        // Datos adicionales
        ingresosPorPlan: ingresosPorPlanCalculado,
        pedidosCompletados: pedidosFiltrados.filter(p => p.status === 'recogido').length
      };

      console.log('Resultado final:', resultado);
      console.log('📊 Debug ingresosPorPlan:', ingresosPorPlanCalculado);
      console.log('📊 Debug keys ingresosPorPlan:', Object.keys(ingresosPorPlanCalculado));
      return resultado;
    } catch (error) {
      console.error('Error al calcular datos financieros:', error);
      return {
        ingresos: 0,
        gastos: 0,
        gastosGenerales: 0,
        gastosMantenimiento: 0,
        neto: 0,
        ingresosPorPlan: {},
        pedidosCompletados: 0,
        cuentasPorCobrar: 0,
        cuentasPorCobrarPorCliente: {},
        saldosPorMedio: {
          efectivo: { ingresos: 0, gastos: 0, saldo: 0 },
          nequi: { ingresos: 0, gastos: 0, saldo: 0 },
          daviplata: { ingresos: 0, gastos: 0, saldo: 0 }
        }
      };
    }
  };

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const hoy = getCurrentDateColombia();
        
        // Obtener todos los pedidos históricos
        const todosLosPedidos = await pedidoService.getAllPedidos();
        
        // Obtener configuración y planes
        const [configuracionData, planesData] = await Promise.all([
          configService.getConfiguracion(),
          planService.getActivePlans()
        ]);
        
        setConfiguracion(configuracionData);
        setPlanes(planesData);
        
        // Obtener todos los gastos históricos
        const fechaInicio = new Date(2024, 0, 1); // Desde enero 2024
        const fechaFin = new Date();
        const todosLosGastos = await gastoService.getGastosDelRango(fechaInicio, fechaFin);
        const totalGastos = todosLosGastos.reduce((sum, gasto) => sum + gasto.amount, 0);
        
        // Obtener total de clientes
        const todosLosClientes = await clienteService.getAllClientes();
        const totalClientesCount = todosLosClientes.length;
        
        // Calcular estadísticas históricas
        const ingresos = todosLosPedidos
          .filter(p => p.status === 'recogido')
          .reduce((sum, p) => sum + (p.total || 0), 0);
        
        const pedidosCompletados = todosLosPedidos.filter(p => p.status === 'recogido').length;
        
        // Calcular ingresos por método de pago
        const ingresosPorMetodo = {
          efectivo: 0,
          nequi: 0,
          daviplata: 0
        };
        
        // Calcular ingresos por plan
        const ingresosPorPlan: { [key: string]: { name: string; amount: number; count: number } } = {};
        
        todosLosPedidos
          .filter(p => p.status === 'recogido')
          .forEach(pedido => {
            const total = pedido.total || 0;
            
            // Ingresos por método de pago
            if (pedido.paymentMethod?.type === 'efectivo') {
              ingresosPorMetodo.efectivo += total;
            } else if (pedido.paymentMethod?.type === 'nequi') {
              ingresosPorMetodo.nequi += total;
            } else if (pedido.paymentMethod?.type === 'daviplata') {
              ingresosPorMetodo.daviplata += total;
            }
            
            // Ingresos por plan
            const planId = pedido.plan.id;
            const planName = pedido.plan.name;
            
            if (!ingresosPorPlan[planId]) {
              ingresosPorPlan[planId] = {
                name: planName,
                amount: 0,
                count: 0
              };
            }
            
            ingresosPorPlan[planId].amount += total;
            ingresosPorPlan[planId].count += 1;
          });
        
        // Crear reporte personalizado con datos históricos
        const reportePersonalizado: ReporteDiario = {
          fecha: hoy,
          pedidos: todosLosPedidos.length,
          pedidosCompletados,
          ingresos,
          gastos: totalGastos,
          neto: ingresos - totalGastos,
          ingresosPorMetodo
        };
        
        // Separar pedidos por estado
        const pendientesRecoger = todosLosPedidos.filter(p => p.status === 'entregado');
        const pendientesEntregar = todosLosPedidos.filter(p => p.status === 'pendiente');
        
        // Ordenar pedidos pendientes de entregar por prioridad y fecha
        pendientesEntregar.sort((a, b) => {
          // Primero por prioridad (prioritarios primero)
          if (a.isPrioritario && !b.isPrioritario) return -1;
          if (!a.isPrioritario && b.isPrioritario) return 1;
          
          // Luego por fecha de entrega
          const fechaA = a.fechaEntrega?.getTime() || 0;
          const fechaB = b.fechaEntrega?.getTime() || 0;
          return fechaA - fechaB;
        });
        
        // Ordenar pedidos pendientes de recoger por recogida prioritaria y fecha
        pendientesRecoger.sort((a, b) => {
          // Primero por recogida prioritaria (prioritarios primero)
          if (a.recogidaPrioritaria && !b.recogidaPrioritaria) return -1;
          if (!a.recogidaPrioritaria && b.recogidaPrioritaria) return 1;
          
          // Luego por fecha de recogida calculada
          const fechaA = a.fechaRecogidaCalculada?.getTime() || 0;
          const fechaB = b.fechaRecogidaCalculada?.getTime() || 0;
          return fechaA - fechaB;
        });
        
        setReporteDiario(reportePersonalizado);
        setPedidosPendientes(pendientesRecoger); // Mantener para compatibilidad
        setPedidosPendientesEntregar(pendientesEntregar);
        setPedidosPendientesRecoger(pendientesRecoger);
        setTotalClientes(totalClientesCount);
        setIngresosPorPlan(ingresosPorPlan);
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
    cargarLavadoras();
    cargarConfiguracion();
  }, []);

  // Listener para detectar cambios en pagos y recargar dashboard
  useEffect(() => {
    console.log('🎧 Registrando listener pagoRealizado en Dashboard...');
    
    const handlePagoRealizado = async () => {
      console.log('🔄 Pago realizado detectado, recargando dashboard...');
      // Pequeño delay para asegurar que los datos se hayan actualizado
      setTimeout(async () => {
        console.log('🔄 Ejecutando recargarDashboard...');
        await recargarDashboard();
        console.log('✅ Dashboard recargado después de pago');
      }, 500);
    };

    // Escuchar eventos personalizados de pago realizado
    window.addEventListener('pagoRealizado', handlePagoRealizado);
    console.log('✅ Listener pagoRealizado registrado');
    
    return () => {
      console.log('🗑️ Removiendo listener pagoRealizado');
      window.removeEventListener('pagoRealizado', handlePagoRealizado);
    };
  }, []);

  // Función para cargar lavadoras
  const cargarLavadoras = async () => {
    try {
      const lavadorasData = await lavadoraService.getAllLavadoras();
      setLavadoras(lavadorasData);
    } catch (error) {
      console.error('Error al cargar lavadoras:', error);
    }
  };

  // Función para cargar configuración
  const cargarConfiguracion = async () => {
    try {
      const configData = await configService.getConfiguracion();
      setConfiguracion(configData);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  // Cargar datos financieros cuando cambie el filtro
  useEffect(() => {
    const cargarDatosFinancieros = async () => {
      const datos = await calcularDatosFinancieros(filtroFinanciero);
      setDatosFinancieros(datos);
    };
    
    cargarDatosFinancieros();
  }, [filtroFinanciero]);

  // Cargar pagos cuando cambie el filtro de pagos
  useEffect(() => {
    const cargarPagos = async () => {
      await obtenerPagosRecibidos(filtroPagos);
    };
    
    cargarPagos();
  }, [filtroPagos]);

  // Función para recargar datos del dashboard
  const recargarDashboard = async () => {
    try {
      const hoy = getCurrentDateColombia();
      
      // Obtener todos los pedidos históricos
      const todosLosPedidos = await pedidoService.getAllPedidos();
      
      // Obtener todos los gastos históricos
      const fechaInicio = new Date(2024, 0, 1); // Desde enero 2024
      const fechaFin = new Date();
      const todosLosGastos = await gastoService.getGastosDelRango(fechaInicio, fechaFin);
      
      // Calcular datos financieros actualizados
      const datosFinancieros = await calcularDatosFinancieros(filtroFinanciero);
      setDatosFinancieros(datosFinancieros);
      
      // Recargar pagos
      await obtenerPagosRecibidos(filtroPagos);
      
      console.log('Dashboard recargado exitosamente');
    } catch (error) {
      console.error('Error al recargar dashboard:', error);
    }
  };

  // Funciones para manejar validación QR y facturación
  // Función para procesar entrega operativa (solo QR + foto + cambio estado)
  const handleEntregaOperativa = async (entregaData: any) => {
    if (!pedidoAValidar) return;

    const result = await entregaOperativaService.procesarEntregaOperativa(
      pedidoAValidar,
      entregaData,
      lavadoras,
      {
        onSuccess: (pedidoActualizado) => {
          console.log('Dashboard - Entrega operativa exitosa');
          
          // Cerrar modal de entrega operativa
          setMostrarModalEntregaOperativa(false);
          
          // Abrir modal de WhatsApp directamente con la foto de evidencia
          setPedidoParaWhatsApp(pedidoActualizado);
          setFotoEvidenciaWhatsApp(entregaData.fotoInstalacion || null);
          setMostrarModalWhatsApp(true);
          
          setPedidoAValidar(null);
          
          // Recargar datos
          const cargarDatos = async () => {
            try {
              const hoy = getCurrentDateColombia();
              
              const [pedidosData, configuracionData] = await Promise.all([
                pedidoService.getAllPedidos(),
                configService.getConfiguracion()
              ]);
              
              // Los pedidos se procesan en el useEffect principal
              setConfiguracion(configuracionData);
            } catch (error) {
              console.error('Error al cargar datos:', error);
            }
          };
          cargarDatos();
          cargarLavadoras();
        },
        onError: (error) => {
          alert(error);
        }
      }
    );

    if (!result.success) {
      alert(result.message);
    }
  };

  // Función para procesar recogida operativa (solo liberar lavadora + cambio estado)
  const handleRecogidaOperativa = async (recogidaData: any) => {
    if (!pedidoAValidar) return;

    const result = await recogidaOperativaService.procesarRecogidaOperativa(
      pedidoAValidar,
      recogidaData,
      {
        onSuccess: (pedidoActualizado) => {
          console.log('Dashboard - Recogida operativa exitosa');
          
          // Cerrar modal de entrega operativa
          setMostrarModalEntregaOperativa(false);
          
          // Mostrar resumen final del servicio
          setPedidoParaModificar(pedidoActualizado);
          setMostrarResumenFinal(true);
          
          setPedidoAValidar(null);
          
          // Recargar datos
          const cargarDatos = async () => {
            try {
              const hoy = getCurrentDateColombia();
              
              const [pedidosData, configuracionData] = await Promise.all([
                pedidoService.getAllPedidos(),
                configService.getConfiguracion()
              ]);
              
              // Los pedidos se procesan en el useEffect principal
              setConfiguracion(configuracionData);
            } catch (error) {
              console.error('Error al cargar datos:', error);
            }
          };
          cargarDatos();
          cargarLavadoras();
        },
        onError: (error) => {
          alert(error);
        }
      }
    );

    if (!result.success) {
      alert(result.message);
    }
  };

  // Función para recargar datos del dashboard
  const recargarDatosDashboard = async () => {
    try {
      const hoy = getCurrentDateColombia();
      
      const [pedidosData, configuracionData, planesData] = await Promise.all([
        pedidoService.getAllPedidos(),
        configService.getConfiguracion(),
        planService.getActivePlans()
      ]);
      
      setConfiguracion(configuracionData);
      setPlanes(planesData);
      
      // Procesar pedidos (lógica del useEffect principal)
      const pedidos = pedidosData || [];
      const pedidosPendientes = pedidos.filter(p => p.status === 'pendiente');
      const pedidosEntregados = pedidos.filter(p => p.status === 'entregado');
      const pedidosRecogidos = pedidos.filter(p => p.status === 'recogido');
      
      setPedidosPendientesEntregar(pedidosPendientes);
      setPedidosPendientesRecoger(pedidosEntregados);
      
      // Calcular datos financieros
      await calcularDatosFinancieros(filtroFinanciero);
    } catch (error) {
      console.error('Error al recargar datos del dashboard:', error);
    }
  };

  // Funciones para manejar modificaciones dinámicas
  // Función para manejar modificaciones del servicio
  const handleModificacionesServicio = async () => {
    if (!pedidoParaModificar) return;
    
    try {
      await recargarDatosDashboard();
      alert('Modificaciones aplicadas exitosamente');
    } catch (error) {
      console.error('Dashboard - Error al aplicar modificaciones:', error);
      alert('Error al aplicar modificaciones: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  // Función para manejar pagos
  const handleRegistrarPago = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setMostrarModalPagos(true);
  };

  const handlePagoRealizado = async () => {
    try {
      await recargarDatosDashboard();
      alert('Pago registrado exitosamente');
    } catch (error) {
      console.error('Dashboard - Error al registrar pago:', error);
      alert('Error al registrar pago: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };



  const handleFacturacion = async (facturacionData: any) => {
    if (!pedidoAFacturar) return;

    try {
      const updateData: any = {
        status: 'entregado',
        fechaEntrega: new Date(),
        cobrosAdicionales: facturacionData.cobrosAdicionales || [],
        horasAdicionales: facturacionData.horasAdicionales || 0,
        paymentMethod: facturacionData.paymentMethod,
        observacionesPago: facturacionData.observacionesPago,
        updatedAt: new Date()
      };

      // Calcular totales
      const subtotal = pedidoAFacturar.subtotal || 0;
      const totalCobrosAdicionales = (facturacionData.cobrosAdicionales || []).reduce((sum: number, cobro: any) => sum + cobro.amount, 0);
      const totalHorasAdicionales = (facturacionData.horasAdicionales || 0) * (configuracion?.horaAdicional || 2000);
      const total = subtotal + totalCobrosAdicionales + totalHorasAdicionales;

      updateData.totalCobrosAdicionales = totalCobrosAdicionales;
      updateData.total = total;

      // Determinar estado de pago
      if (pedidoAFacturar.estadoPago === 'pagado_anticipado') {
        updateData.estadoPago = 'pagado_anticipado';
      } else {
        updateData.estadoPago = 'pagado_entrega';
      }

      await pedidoService.updatePedido(pedidoAFacturar.id, updateData);
      
      setMostrarModalFacturacion(false);
      setPedidoAFacturar(null);
      const cargarDatos = async () => {
        try {
          const hoy = getCurrentDateColombia();
          
          const [pedidosData, configuracionData] = await Promise.all([
            pedidoService.getAllPedidos(),
            configService.getConfiguracion()
          ]);
          
          // Los pedidos se procesan en el useEffect principal
          setConfiguracion(configuracionData);
        } catch (error) {
          console.error('Error al cargar datos:', error);
        }
      };
      cargarDatos();
      
    } catch (error) {
      console.error('Error al procesar facturación:', error);
      alert('Error al procesar la facturación');
    }
  };

  const handleLiquidacion = async (liquidacionData: any) => {
    if (!pedidoAFacturar) return;

    try {
      const updateData: any = {
        status: 'recogido',
        fechaRecogida: new Date(),
        descuentos: liquidacionData.descuentos || [],
        reembolsos: liquidacionData.reembolsos || [],
        horasAdicionales: liquidacionData.horasAdicionales || 0,
        paymentMethod: liquidacionData.paymentMethod,
        observacionesPago: liquidacionData.observacionesPago,
        updatedAt: new Date()
      };

      // Calcular totales finales
      const subtotal = pedidoAFacturar.subtotal || 0;
      const totalCobrosAdicionales = pedidoAFacturar.totalCobrosAdicionales || 0;
      const totalHorasAdicionales = (liquidacionData.horasAdicionales || 0) * (configuracion?.horaAdicional || 2000);
      const totalDescuentos = (liquidacionData.descuentos || []).reduce((sum: number, descuento: any) => sum + descuento.amount, 0);
      const totalReembolsos = (liquidacionData.reembolsos || []).reduce((sum: number, reembolso: any) => sum + reembolso.amount, 0);
      const total = subtotal + totalCobrosAdicionales + totalHorasAdicionales - totalDescuentos - totalReembolsos;

      updateData.totalDescuentos = totalDescuentos;
      updateData.totalReembolsos = totalReembolsos;
      updateData.total = total;

      // Determinar estado de pago final
      if (pedidoAFacturar.estadoPago === 'pagado_anticipado' && totalReembolsos > 0) {
        updateData.estadoPago = 'pagado_anticipado'; // Con reembolsos
      } else if (pedidoAFacturar.estadoPago === 'pagado_anticipado') {
        updateData.estadoPago = 'pagado_anticipado';
      } else {
        updateData.estadoPago = 'pagado_recogida';
      }

      await pedidoService.updatePedido(pedidoAFacturar.id, updateData);

      // Liberar la lavadora si está asignada
      if (pedidoAFacturar.lavadoraAsignada) {
        await lavadoraService.updateLavadora(pedidoAFacturar.lavadoraAsignada.lavadoraId, {
          estado: 'disponible'
        });
      }
      
      setMostrarModalLiquidacion(false);
      setPedidoAFacturar(null);
      const cargarDatos = async () => {
        try {
          const hoy = getCurrentDateColombia();
          
          const [pedidosData, configuracionData] = await Promise.all([
            pedidoService.getAllPedidos(),
            configService.getConfiguracion()
          ]);
          
          // Los pedidos se procesan en el useEffect principal
          setConfiguracion(configuracionData);
        } catch (error) {
          console.error('Error al cargar datos:', error);
        }
      };
      cargarDatos();
      cargarLavadoras();
      
    } catch (error) {
      console.error('Error al procesar liquidación:', error);
      alert('Error al procesar la liquidación');
    }
  };

  // Funciones para manejar cambios de estado de pedidos (nuevo flujo)
  const handleMarcarEntregado = async (pedidoId: string) => {
    const pedido = pedidosPendientesEntregar.find(p => p.id === pedidoId);
    if (pedido) {
      setPedidoAValidar(pedido);
      setMostrarModalEntregaOperativa(true);
    }
  };

  const handleMarcarRecogido = async (pedidoId: string) => {
    const pedido = pedidosPendientesRecoger.find(p => p.id === pedidoId);
    if (pedido) {
      setPedidoAFacturar(pedido);
      setMostrarModalLiquidacion(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Ingresos Reales',
      value: formatCurrency(datosFinancieros?.ingresos || 0),
      icon: CurrencyDollarIcon,
      color: 'text-success-600',
      bgColor: 'bg-gradient-to-br from-success-100 to-success-200',
      borderColor: 'border-success-300',
      link: '/reportes'
    },
    {
      name: 'Total Pedidos',
      value: reporteDiario?.pedidos || 0,
      icon: ClipboardDocumentListIcon,
      color: 'text-primary-600',
      bgColor: 'bg-gradient-to-br from-primary-100 to-primary-200',
      borderColor: 'border-primary-300',
      link: '/pedidos'
    },
    {
      name: 'Total Gastos',
      value: formatCurrency(datosFinancieros?.gastos || 0),
      icon: ExclamationTriangleIcon,
      color: 'text-warning-600',
      bgColor: 'bg-gradient-to-br from-warning-100 to-warning-200',
      borderColor: 'border-warning-300',
      link: '/gastos'
    },
    {
      name: 'Cuentas por Cobrar',
      value: formatCurrency(datosFinancieros?.cuentasPorCobrar || 0),
      icon: ChartBarIcon,
      color: 'text-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-100 to-blue-200',
      borderColor: 'border-blue-300',
      link: '/pedidos'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Resumen histórico completo - Todos los datos registrados
        </p>
        </div>
        <button
          onClick={recargarDashboard}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          title="Recargar datos del dashboard"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Recargar</span>
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <a 
            key={stat.name} 
            href={stat.link}
            className="card-colored border-l-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer" 
            style={{borderLeftColor: stat.color.replace('text-', '#')}}
          >
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-4 rounded-xl ${stat.bgColor} border ${stat.borderColor} shadow-md`}>
                <stat.icon className={`h-7 w-7 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </a>
        ))}
      </div>


      {/* Saldos por Medio de Pago */}
        <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">💳 Saldos por Medio de Pago</h3>
          <div className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
            * Incluye gastos de mantenimiento
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Efectivo */}
          <div className={`p-4 rounded-lg border-2 ${
            (datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0) >= 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
            <div className="flex items-center">
                <div className={`p-2 rounded-lg ${
                  (datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <span className="text-2xl">💵</span>
              </div>
              <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    (datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0) >= 0 ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Efectivo
                  </p>
                  <p className="text-xs text-gray-600">
                    Ingresos: {formatCurrency(datosFinancieros?.saldosPorMedio?.efectivo?.ingresos || 0)}
                  </p>
                  <p className="text-xs text-gray-600">
                    Gastos: {formatCurrency(datosFinancieros?.saldosPorMedio?.efectivo?.gastos || 0)}
                  </p>
              </div>
            </div>
            <div className="text-right">
                <p className={`text-lg font-bold ${
                  (datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0) >= 0 ? 'text-green-900' : 'text-red-900'
                }`}>
                  {formatCurrency(datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0)}
                </p>
                <p className={`text-xs ${
                  (datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(datosFinancieros?.saldosPorMedio?.efectivo?.saldo || 0) >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
                </p>
              </div>
            </div>
          </div>

          {/* Nequi */}
          <div className={`p-4 rounded-lg border-2 ${
            (datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0) >= 0 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
            <div className="flex items-center">
                <div className={`p-2 rounded-lg ${
                  (datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0) >= 0 ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  <span className="text-2xl">📱</span>
              </div>
              <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    (datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0) >= 0 ? 'text-blue-800' : 'text-red-800'
                  }`}>
                    Nequi
                  </p>
                  <p className="text-xs text-gray-600">
                    Ingresos: {formatCurrency(datosFinancieros?.saldosPorMedio?.nequi?.ingresos || 0)}
                  </p>
                  <p className="text-xs text-gray-600">
                    Gastos: {formatCurrency(datosFinancieros?.saldosPorMedio?.nequi?.gastos || 0)}
                  </p>
              </div>
            </div>
            <div className="text-right">
                <p className={`text-lg font-bold ${
                  (datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0) >= 0 ? 'text-blue-900' : 'text-red-900'
                }`}>
                  {formatCurrency(datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0)}
                </p>
                <p className={`text-xs ${
                  (datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {(datosFinancieros?.saldosPorMedio?.nequi?.saldo || 0) >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
                </p>
              </div>
            </div>
          </div>

          {/* Daviplata */}
          <div className={`p-4 rounded-lg border-2 ${
            (datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0) >= 0 
              ? 'bg-purple-50 border-purple-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
            <div className="flex items-center">
                <div className={`p-2 rounded-lg ${
                  (datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0) >= 0 ? 'bg-purple-100' : 'bg-red-100'
                }`}>
                  <span className="text-2xl">📱</span>
              </div>
              <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    (datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0) >= 0 ? 'text-purple-800' : 'text-red-800'
                  }`}>
                    Daviplata
                  </p>
                  <p className="text-xs text-gray-600">
                    Ingresos: {formatCurrency(datosFinancieros?.saldosPorMedio?.daviplata?.ingresos || 0)}
                  </p>
                  <p className="text-xs text-gray-600">
                    Gastos: {formatCurrency(datosFinancieros?.saldosPorMedio?.daviplata?.gastos || 0)}
                  </p>
              </div>
            </div>
            <div className="text-right">
                <p className={`text-lg font-bold ${
                  (datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0) >= 0 ? 'text-purple-900' : 'text-red-900'
                }`}>
                  {formatCurrency(datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0)}
                </p>
                <p className={`text-xs ${
                  (datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0) >= 0 ? 'text-purple-600' : 'text-red-600'
                }`}>
                  {(datosFinancieros?.saldosPorMedio?.daviplata?.saldo || 0) >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>



      {/* Sección de Pagos Recibidos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">💰 Pagos Recibidos</h3>
          
          {/* Controles de filtro para pagos */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-4 w-4 text-gray-500" />
              <select
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                value={filtroPagos.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as 'hoy' | 'ayer' | 'personalizado';
                  if (tipo === 'personalizado') {
                    setFiltroPagos(prev => ({ ...prev, tipo }));
                  } else {
                    setFiltroPagos(prev => ({ ...prev, tipo }));
                  }
                }}
              >
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="personalizado">Rango Personalizado</option>
              </select>
            </div>
            
            {filtroPagos.tipo === 'personalizado' && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                  value={filtroPagos.fechaInicio.toISOString().split('T')[0]}
                  onChange={(e) => setFiltroPagos(prev => ({ 
                    ...prev, 
                    fechaInicio: new Date(e.target.value) 
                  }))}
                />
                <span className="text-gray-500">a</span>
                <input
                  type="date"
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                  value={filtroPagos.fechaFin.toISOString().split('T')[0]}
                  onChange={(e) => setFiltroPagos(prev => ({ 
                    ...prev, 
                    fechaFin: new Date(e.target.value) 
                  }))}
                />
        </div>
      )}
          </div>
        </div>


        {/* Lista de pagos */}
        <div className="space-y-3">
          {pagosRecibidos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💳</div>
              <p>No se encontraron pagos para el período seleccionado</p>
            </div>
          ) : (
            pagosRecibidos.map((pago, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    pago.medioPago === 'efectivo' ? 'bg-green-500' :
                    pago.medioPago === 'nequi' ? 'bg-blue-500' :
                    'bg-purple-500'
                  }`}></div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      pago.medioPago === 'efectivo' ? 'bg-green-100 text-green-800' :
                      pago.medioPago === 'nequi' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {pago.medioPago === 'efectivo' ? '💵 Efectivo' :
                       pago.medioPago === 'nequi' ? '📱 Nequi' :
                       '📱 Daviplata'}
                    </span>
                    {pago.isPartial && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Abono
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg text-gray-900">
                    {formatCurrency(pago.monto)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sección de Pedidos Pendientes */}
      <PedidosPendientes
        pedidosPendientesEntregar={pedidosPendientesEntregar}
        pedidosPendientesRecoger={pedidosPendientesRecoger}
        onMarcarEntregado={handleMarcarEntregado}
        onMarcarRecogido={handleMarcarRecogido}
        onModificarServicio={(pedido) => {
          setPedidoParaModificar(pedido);
          setMostrarModalModificaciones(true);
        }}
        onRegistrarPago={handleRegistrarPago}
      />

      {/* Resumen financiero */}
        <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Resumen Financiero</h3>
          
          {/* Controles de filtro */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-4 w-4 text-gray-500" />
              <select
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                value={filtroFinanciero.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as 'hoy' | 'ayer' | 'personalizado';
                  setFiltroFinanciero(prev => ({
                    ...prev,
                    tipo,
                    fechaInicio: tipo === 'hoy' ? getCurrentDateColombia() : 
                                 tipo === 'ayer' ? (() => {
                                   const ayer = new Date(getCurrentDateColombia());
                                   ayer.setDate(ayer.getDate() - 1);
                                   return ayer;
                                 })() : prev.fechaInicio,
                    fechaFin: tipo === 'hoy' ? getCurrentDateColombia() : 
                              tipo === 'ayer' ? (() => {
                                const ayer = new Date(getCurrentDateColombia());
                                ayer.setDate(ayer.getDate() - 1);
                                return ayer;
                              })() : prev.fechaFin
                  }));
                }}
              >
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            
            {filtroFinanciero.tipo === 'personalizado' && (
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <input
                  type="date"
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                  value={filtroFinanciero.fechaInicio.toISOString().split('T')[0]}
                  onChange={(e) => setFiltroFinanciero(prev => ({
                    ...prev,
                    fechaInicio: new Date(e.target.value)
                  }))}
                />
                <span className="text-gray-500">a</span>
                <input
                  type="date"
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                  value={filtroFinanciero.fechaFin.toISOString().split('T')[0]}
                  onChange={(e) => setFiltroFinanciero(prev => ({
                    ...prev,
                    fechaFin: new Date(e.target.value)
                  }))}
                />
              </div>
            )}
          </div>
        </div>
          <dl className="space-y-3">
            <div className="flex justify-between">
            <dt className="text-sm text-gray-500">Ingresos Totales:</dt>
              <dd className="text-sm font-medium text-success-600">
              {formatCurrency(datosFinancieros.ingresos)}
            </dd>
          </div>
          
          {/* Desglose por plan */}
          {Object.keys(datosFinancieros.ingresosPorPlan).length > 0 ? (
            <div className="ml-4 space-y-2 border-l-2 border-gray-200 pl-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-600">Por Plan:</div>
                <div className="text-xs text-blue-600 font-medium">
                  Total: {Object.values(datosFinancieros.ingresosPorPlan).reduce((sum, plan) => sum + plan.count, 0)} servicios
                </div>
              </div>
              {Object.entries(datosFinancieros.ingresosPorPlan)
                .sort(([,a], [,b]) => b.amount - a.amount) // Ordenar por monto descendente
                .map(([planId, planData]) => (
                  <div key={planId} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <dt className="text-xs text-gray-500">{planData.name}:</dt>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {planData.count} servicios
                      </span>
                    </div>
                    <dd className="text-xs font-medium text-success-600">
                      {formatCurrency(planData.amount)}
                    </dd>
                  </div>
                ))}
            </div>
          ) : (
            <div className="ml-4 text-xs text-gray-400 italic">
              No hay servicios completados en este período
            </div>
          )}
          
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Gastos Totales:</dt>
              <dd className="text-sm font-medium text-danger-600">
              {formatCurrency(datosFinancieros.gastos)}
              </dd>
            </div>
            
            {/* Desglose de gastos */}
            {(datosFinancieros.gastosGenerales > 0 || datosFinancieros.gastosMantenimiento > 0) && (
              <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-4">
                {datosFinancieros.gastosGenerales > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-xs text-gray-500">Gastos Generales:</dt>
                    <dd className="text-xs font-medium text-orange-600">
                      {formatCurrency(datosFinancieros.gastosGenerales)}
                    </dd>
                  </div>
                )}
                {datosFinancieros.gastosMantenimiento > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-xs text-gray-500">Mantenimiento Lavadoras:</dt>
                    <dd className="text-xs font-medium text-red-600">
                      {formatCurrency(datosFinancieros.gastosMantenimiento)}
                    </dd>
                  </div>
                )}
              </div>
            )}
            
            <div className="border-t pt-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-900">Neto:</dt>
                <dd className={`text-sm font-bold ${
                datosFinancieros.neto >= 0 ? 'text-success-600' : 'text-danger-600'
                }`}>
                {formatCurrency(datosFinancieros.neto)}
                </dd>
              </div>
            </div>
            
            {/* Cuentas por cobrar - Información adicional */}
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Cuentas por Cobrar:</dt>
                <dd className="text-sm font-medium text-blue-600">
                  {formatCurrency(datosFinancieros.cuentasPorCobrar || 0)}
                </dd>
              </div>
              
              {/* Desglose de cuentas por cobrar por cliente */}
              {datosFinancieros.cuentasPorCobrarPorCliente && Object.keys(datosFinancieros.cuentasPorCobrarPorCliente).length > 0 && (
                <div className="ml-4 space-y-1 border-l-2 border-blue-200 pl-4 mt-2">
                  <div className="text-xs font-medium text-gray-600 mb-2">Por Cliente:</div>
                  {Object.entries(datosFinancieros.cuentasPorCobrarPorCliente)
                    .sort(([,a], [,b]) => (b as any).totalSaldo - (a as any).totalSaldo) // Ordenar por saldo descendente
                    .map(([clienteId, clienteData]) => (
                      <div key={clienteId} className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <dt className="text-xs text-gray-500">{(clienteData as any).clienteName}:</dt>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {(clienteData as any).servicios} servicios
                          </span>
                        </div>
                        <dd className="text-xs font-medium text-blue-600">
                          {formatCurrency((clienteData as any).totalSaldo)}
                        </dd>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </dl>
        </div>

      {/* Modal de entrega operativa */}
      {mostrarModalEntregaOperativa && pedidoAValidar && (
        <ModalEntregaOperativa
          isOpen={mostrarModalEntregaOperativa}
          onClose={() => {
            setMostrarModalEntregaOperativa(false);
            setPedidoAValidar(null);
          }}
          onConfirm={handleEntregaOperativa}
          pedido={pedidoAValidar}
          lavadoras={lavadoras}
        />
      )}

      {mostrarModalFacturacion && pedidoAFacturar && (
        <ModalFacturacion
          isOpen={mostrarModalFacturacion}
          onClose={() => {
            setMostrarModalFacturacion(false);
            setPedidoAFacturar(null);
          }}
          onConfirm={handleFacturacion}
          pedido={pedidoAFacturar}
          precioHoraAdicional={configuracion?.horaAdicional || 2000}
        />
      )}

      {mostrarModalLiquidacion && pedidoAFacturar && (
        <ModalLiquidacion
          isOpen={mostrarModalLiquidacion}
          onClose={() => {
            setMostrarModalLiquidacion(false);
            setPedidoAFacturar(null);
          }}
          onConfirm={handleLiquidacion}
          pedido={pedidoAFacturar}
          precioHoraAdicional={configuracion?.horaAdicional || 2000}
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

      {/* Modal de modificaciones unificado */}
      {mostrarModalModificaciones && pedidoParaModificar && (
        <ModalModificacionesServicio
          isOpen={mostrarModalModificaciones}
          onClose={() => {
            setMostrarModalModificaciones(false);
            setPedidoParaModificar(null);
          }}
          pedido={pedidoParaModificar}
          planes={planes}
          onModificacionAplicada={handleModificacionesServicio}
        />
      )}

      {/* Modal de Pagos */}
      {pedidoSeleccionado && (
        <ModalPagos
          isOpen={mostrarModalPagos}
          onClose={() => {
            setMostrarModalPagos(false);
            setPedidoSeleccionado(null);
          }}
          pedido={pedidoSeleccionado}
          onPagoRealizado={handlePagoRealizado}
        />
      )}

      {/* Resumen final del servicio */}
      {mostrarResumenFinal && pedidoParaModificar && (
        <ResumenFinalServicio
          pedido={pedidoParaModificar}
          onClose={() => {
            setMostrarResumenFinal(false);
            setPedidoParaModificar(null);
          }}
        />
      )}

    </div>
  );
};

export default Dashboard;


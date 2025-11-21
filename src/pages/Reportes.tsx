import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  CalendarIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { pedidoService, gastoService, planService, clienteService } from '../services/firebaseService';
import { modificacionesService } from '../services/modificacionesService';
import { Pedido, Gasto, Plan, Cliente } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

interface FiltrosReporte {
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  planId: string;
  clienteId: string;
  tipoReporte: 'diario' | 'semanal' | 'mensual' | 'personalizado';
}

const Reportes: React.FC = () => {
  const fechaHoyBase = getCurrentDateColombia();
  const fechaHoy = new Date(fechaHoyBase);
  fechaHoy.setHours(0, 0, 0, 0);
  
  const [filtros, setFiltros] = useState<FiltrosReporte>({
    fechaInicio: new Date(fechaHoy),
    fechaFin: new Date(fechaHoy),
    estado: 'todos',
    planId: 'todos',
    clienteId: 'todos',
    tipoReporte: 'diario'
  });

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [analisisPlanes, setAnalisisPlanes] = useState<any[]>([]);
  const [totalModificaciones, setTotalModificaciones] = useState({
    horasExtras: 0,
    cobrosAdicionales: 0,
    descuentos: 0,
    total: 0
  });

  /**
   * Formatea una fecha a 'YYYY-MM-DD' en zona horaria local para inputs type=\"date\"
   * evitando el desfase al usar toISOString() (UTC).
   */
  const formatDateInputLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Obtiene el plan \"efectivo\" de un pedido: el plan que debe usarse hoy para reportes.
   * - Prioriza planId (campo confiable)
   * - Luego pedido.plan?.id
   * - Como último recurso, intenta mapear por nombre de plan contra la lista de planes activos.
   */
  const getPlanIdEfectivo = (pedido: Pedido): string | null => {
    if (pedido.planId) return pedido.planId;
    if (pedido.plan?.id) return pedido.plan.id;

    if (pedido.plan?.name && planes.length > 0) {
      const nombrePedido = pedido.plan.name.trim().toUpperCase();
      const planCoincidente = planes.find(p => p.name.trim().toUpperCase() === nombrePedido);
      if (planCoincidente) {
        return planCoincidente.id;
      }
    }

    return null;
  };

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    cargarReporte();
  }, [filtros]);

  const cargarDatosIniciales = async () => {
    try {
      const [planesData, clientesData] = await Promise.all([
        planService.getActivePlans(),
        clienteService.searchClientes('')
      ]);
      setPlanes(planesData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    }
  };

  const cargarReporte = async () => {
    setLoading(true);
    // Limpiar análisis de planes al inicio para evitar mostrar datos previos
    setAnalisisPlanes([]);
    console.log('🔄 Iniciando carga de reporte...');
    try {
      // Cargar todos los pedidos y filtrar por fecha localmente (más confiable)
      console.log('📋 Cargando todos los pedidos...');
      const todosLosPedidosRaw = await pedidoService.getAllPedidos();
      console.log('📊 Total de pedidos cargados:', todosLosPedidosRaw.length);
      
      // Filtrar por rango de fechas
      const fechaInicio = new Date(filtros.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(filtros.fechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      
      console.log('📅 Filtros de fecha recibidos:', {
        fechaInicioRaw: filtros.fechaInicio,
        fechaFinRaw: filtros.fechaFin,
        fechaInicioNormalizada: fechaInicio.toISOString(),
        fechaFinNormalizada: fechaFin.toISOString()
      });
      
      console.log('📅 Filtrando por rango de fechas:', fechaInicio.toISOString(), 'a', fechaFin.toISOString());
      
      const pedidosUnicos = todosLosPedidosRaw.filter(pedido => {
        // Convertir fecha del pedido correctamente
        let fechaPedido: Date;
        if (pedido.fechaAsignacion instanceof Date) {
          fechaPedido = pedido.fechaAsignacion;
        } else if ((pedido.fechaAsignacion as any)?.toDate) {
          fechaPedido = (pedido.fechaAsignacion as any).toDate();
        } else {
          fechaPedido = new Date(pedido.fechaAsignacion);
        }
        
        // Normalizar fecha del pedido a inicio del día para comparar solo por fecha
        const fechaPedidoNormalizada = new Date(fechaPedido);
        fechaPedidoNormalizada.setHours(0, 0, 0, 0);
        
        const dentroDelRango = fechaPedidoNormalizada >= fechaInicio && fechaPedidoNormalizada <= fechaFin;
        
        return dentroDelRango;
      });
      
      console.log('📊 Pedidos dentro del rango de fechas:', pedidosUnicos.length);
      
      // Log de los primeros pedidos para verificar fechas y planes
      if (pedidosUnicos.length > 0) {
        console.log('📋 Primeros 5 pedidos filtrados por fecha:', pedidosUnicos.slice(0, 5).map(p => {
          let fechaPedido: Date;
          if (p.fechaAsignacion instanceof Date) {
            fechaPedido = p.fechaAsignacion;
          } else if ((p.fechaAsignacion as any)?.toDate) {
            fechaPedido = (p.fechaAsignacion as any).toDate();
          } else {
            fechaPedido = new Date(p.fechaAsignacion);
          }
          return {
            id: p.id,
            cliente: p.cliente?.name,
            fechaAsignacion: fechaPedido.toISOString(),
            planId: p.planId,
            planIdFromPlan: p.plan?.id,
            planName: p.plan?.name
          };
        }));
      }
      
      // Partimos de los pedidos dentro del rango de fechas
      let todosLosPedidos = pedidosUnicos;

      console.log('🔍 Filtros aplicados:', {
        estado: filtros.estado,
        planId: filtros.planId,
        clienteId: filtros.clienteId,
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin
      });

      // Aplicar filtros (estado, plan, cliente) de forma consistente con la página de Pedidos
      if (filtros.estado !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.status === filtros.estado);
        console.log('🔍 Filtrado por estado:', filtros.estado, '- Pedidos restantes:', todosLosPedidos.length);
      }
      if (filtros.planId !== 'todos') {
        const selectedPlan = planes.find(p => p.id === filtros.planId);
        const nombrePlanSeleccionado = selectedPlan?.name?.trim().toUpperCase() || null;

        console.log('🔍 Filtrando por plan (usando plan efectivo y nombre):', {
          planId: filtros.planId,
          planName: selectedPlan?.name
        });

        todosLosPedidos = todosLosPedidos.filter(p => {
          const planIdEfectivo = getPlanIdEfectivo(p);
          const coincidePorId = planIdEfectivo === filtros.planId;

          // Fallback por nombre, para pedidos antiguos o con datos inconsistentes
          let coincidePorNombre = false;
          if (nombrePlanSeleccionado) {
            const planDesdeListado = planIdEfectivo
              ? planes.find(pl => pl.id === planIdEfectivo)
              : undefined;
            const nombreDesdeListado = planDesdeListado?.name?.trim().toUpperCase();
            const nombreDesdePedido = p.plan?.name?.trim().toUpperCase();

            coincidePorNombre =
              nombreDesdeListado === nombrePlanSeleccionado ||
              nombreDesdePedido === nombrePlanSeleccionado;
          }

          return coincidePorId || coincidePorNombre;
        });
        console.log('🔍 Pedidos restantes después de filtro de plan:', todosLosPedidos.length);
      }
      if (filtros.clienteId !== 'todos') {
        todosLosPedidos = todosLosPedidos.filter(p => p.clienteId === filtros.clienteId);
        console.log('🔍 Filtrado por cliente:', filtros.clienteId, '- Pedidos restantes:', todosLosPedidos.length);
      }

      setPedidos(todosLosPedidos);
      console.log('✅ Pedidos establecidos en estado');

      // Calcular análisis de planes y modificaciones en base a los pedidos YA filtrados
      console.log('🔄 Iniciando cálculo de análisis de planes (sobre pedidos filtrados)...');
      await calcularAnalisisPlanes(todosLosPedidos);
      console.log('✅ Análisis de planes completado');

      // Cargar gastos del rango de fechas
      console.log('🔄 Cargando gastos...');
      const gastosPromises = [];
      const fechaActualGastos = new Date(filtros.fechaInicio);
      // Normalizar fecha de inicio a medianoche
      fechaActualGastos.setHours(0, 0, 0, 0);
      const fechaFinGastos = new Date(filtros.fechaFin);
      // Normalizar fecha fin a medianoche
      fechaFinGastos.setHours(0, 0, 0, 0);
      
      while (fechaActualGastos <= fechaFinGastos) {
        gastosPromises.push(gastoService.getGastosDelDia(new Date(fechaActualGastos)));
        fechaActualGastos.setDate(fechaActualGastos.getDate() + 1);
      }
      
      const gastosArrays = await Promise.all(gastosPromises);
      const todosLosGastos = gastosArrays.flat();
      setGastos(todosLosGastos);
      console.log('✅ Gastos cargados:', todosLosGastos.length);

    } catch (error) {
      console.error('❌ Error al cargar reporte:', error);
    } finally {
      setLoading(false);
      console.log('✅ Carga de reporte completada');
    }
  };

  const calcularAnalisisPlanes = async (pedidosFiltrados: Pedido[]) => {
    try {
      console.log('🔄 Calculando análisis de planes para', pedidosFiltrados.length, 'pedidos (ya filtrados por fecha/plan/cliente/estado)');
      
      // Filtrar pedidos válidos (no eliminados, no cancelados) y únicos
      const pedidosValidos = pedidosFiltrados.filter(p => !p.eliminado && p.status !== 'cancelado');
      const pedidosUnicos = pedidosValidos.reduce((acc, pedido) => {
        if (!acc.find(p => p.id === pedido.id)) {
          acc.push(pedido);
        }
        return acc;
      }, [] as Pedido[]);

      console.log('📊 Pedidos válidos para análisis (sin eliminados/cancelados):', pedidosUnicos.length);

      // Agrupar pedidos por plan \"lógico\" (por nombre), para evitar duplicar PLAN 1 con ids distintos
      const planesMap = new Map<string, any>();

      for (const pedido of pedidosUnicos) {
        // Usar el plan \"efectivo\" del pedido (id actual si existe)
        const planIdEfectivo = getPlanIdEfectivo(pedido);

        if (!planIdEfectivo && !pedido.plan?.name) {
          console.warn('⚠️ Pedido sin planId:', pedido.id, pedido);
          continue;
        }

        // Buscar el plan actual desde la lista de planes disponibles (más confiable que pedido.plan)
        const planActual = planIdEfectivo ? planes.find(p => p.id === planIdEfectivo) : undefined;
        const planName = planActual?.name || pedido.plan?.name || 'Plan desconocido';
        const planPrice = planActual?.price || pedido.plan?.price || 0;
        const planNameFinal = planName;
        const planPriceFinal = planPrice;

        // Detectar si el pedido tuvo cambio de plan (modificación) usando modificacionesServicio
        const fueModificado =
          Array.isArray(pedido.modificacionesServicio) &&
          pedido.modificacionesServicio.some((mod: any) => mod.tipo === 'cambioPlan' || mod.cambioPlan);

        // Log detallado de cada pedido procesado
        console.log('📋 Procesando pedido para análisis:', {
          pedidoId: pedido.id,
          cliente: pedido.cliente?.name,
          planId: planIdEfectivo,
          planName: planNameFinal,
          planPrice: planPriceFinal,
          planActualEncontrado: !!planActual,
          planNameDelPedido: pedido.plan?.name,
          fueModificado
        });

        // Usar el nombre normalizado como clave lógica para agrupar todos los PLAN 1 juntos,
        // incluso si tienen distintos ids en la base de datos.
        const planKey = planNameFinal.trim().toUpperCase();

        if (!planesMap.has(planKey)) {
          planesMap.set(planKey, {
            planKey,
            planId: planIdEfectivo || planKey, // id representativo
            planName: planNameFinal,
            planPrice: planPriceFinal,
            cantidad: 0,
            valorTotal: 0,
            modificados: 0
          });
          console.log('✅ Nuevo plan agregado al análisis:', planKey, planNameFinal);
        }

        const planData = planesMap.get(planKey);
        planData.cantidad += 1;
        planData.valorTotal += planPriceFinal;
        if (fueModificado) {
          planData.modificados += 1;
        }
      }
      
      // Convertir a array y ordenar por cantidad
      let analisisPlanesArray = Array.from(planesMap.values())
        .sort((a, b) => b.cantidad - a.cantidad);
      
      console.log('📊 Análisis de planes calculado:', analisisPlanesArray);
      console.log('📊 Detalle de planes:', analisisPlanesArray.map(p => ({
        planId: p.planId,
        planName: p.planName,
        cantidad: p.cantidad,
        valorTotal: p.valorTotal
      })));
      setAnalisisPlanes(analisisPlanesArray);
      
      // Calcular totales de modificaciones de forma eficiente
      let totalHorasExtras = 0;
      let totalCobrosAdicionales = 0;
      let totalDescuentos = 0;
      
      console.log('🔄 Calculando modificaciones...');
      
      // Obtener todas las modificaciones en paralelo para pedidos únicos
      const modificacionesPromises = pedidosUnicos.map(async (pedido) => {
        try {
          return await modificacionesService.obtenerModificacionPorPedido(pedido.id);
        } catch (error) {
          console.error('Error obteniendo modificación para pedido', pedido.id, error);
          return null;
        }
      });
      
      const modificaciones = await Promise.all(modificacionesPromises);
      console.log('📊 Modificaciones obtenidas:', modificaciones.filter((m: any) => m !== null).length);
      
      // Procesar modificaciones usando los totales ya calculados
      modificaciones.forEach((modificacion: any) => {
        if (modificacion) {
          // Usar los totales ya calculados en la modificación
          totalHorasExtras += modificacion.totalHorasExtras || 0;
          totalCobrosAdicionales += modificacion.totalCobrosAdicionales || 0;
          totalDescuentos += modificacion.totalDescuentos || 0;
        }
      });
      
      console.log('💰 Totales calculados:', {
        horasExtras: totalHorasExtras,
        cobrosAdicionales: totalCobrosAdicionales,
        descuentos: totalDescuentos,
        total: totalHorasExtras + totalCobrosAdicionales - totalDescuentos
      });
      
      setTotalModificaciones({
        horasExtras: totalHorasExtras,
        cobrosAdicionales: totalCobrosAdicionales,
        descuentos: totalDescuentos,
        total: totalHorasExtras + totalCobrosAdicionales - totalDescuentos
      });
      
      console.log('✅ Análisis de planes completado');
      
    } catch (error) {
      console.error('❌ Error al calcular análisis de planes:', error);
      // Establecer valores por defecto en caso de error
      setAnalisisPlanes([]);
      setTotalModificaciones({
        horasExtras: 0,
        cobrosAdicionales: 0,
        descuentos: 0,
        total: 0
      });
    }
  };

  const calcularEstadisticas = () => {
    // Calcular ingresos reales (solo lo que se ha pagado)
    let ingresos = 0;
    let totalPendiente = 0;
    
    const ingresosPorMetodo = {
      efectivo: 0,
      nequi: 0,
      daviplata: 0
    };
    
    const gastosPorMetodo = {
      efectivo: 0,
      nequi: 0,
      daviplata: 0
    };
    
    // Filtrar pedidos eliminados y cancelados del cálculo de pendiente
    const pedidosValidos = pedidos.filter(p => !p.eliminado && p.status !== 'cancelado');
    
    pedidosValidos.forEach(pedido => {
      const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + (pago.monto || 0), 0) || 0;
      const totalPedido = pedido.total || 0;
      const saldoPendiente = Math.max(0, totalPedido - totalPagado);
      
      console.log('📊 Pedido:', pedido.id, {
        cliente: pedido.cliente.name,
        totalPedido,
        totalPagado,
        saldoPendiente,
        pagosRealizados: pedido.pagosRealizados?.length || 0
      });
      
      ingresos += totalPagado;
      totalPendiente += saldoPendiente;
      
      // Calcular ingresos por método de pago basado en pagos reales
      if (pedido.pagosRealizados) {
        pedido.pagosRealizados.forEach(pago => {
          const monto = pago.monto || 0;
          if (pago.medioPago === 'efectivo') {
            ingresosPorMetodo.efectivo += monto;
          } else if (pago.medioPago === 'nequi') {
            ingresosPorMetodo.nequi += monto;
          } else if (pago.medioPago === 'daviplata') {
            ingresosPorMetodo.daviplata += monto;
          }
        });
      }
    });
    
    // Calcular gastos por método de pago
    gastos.forEach(gasto => {
      const medioPago = gasto.medioPago || 'efectivo';
      const monto = gasto.amount || 0;
      if (medioPago === 'efectivo') {
        gastosPorMetodo.efectivo += monto;
      } else if (medioPago === 'nequi') {
        gastosPorMetodo.nequi += monto;
      } else if (medioPago === 'daviplata') {
        gastosPorMetodo.daviplata += monto;
      }
    });
    
    // Calcular saldos por método de pago (ingresos - gastos)
    const saldosPorMetodo = {
      efectivo: ingresosPorMetodo.efectivo - gastosPorMetodo.efectivo,
      nequi: ingresosPorMetodo.nequi - gastosPorMetodo.nequi,
      daviplata: ingresosPorMetodo.daviplata - gastosPorMetodo.daviplata
    };
    
    console.log('💰 Totales calculados:', {
      ingresos,
      totalPendiente,
      ingresosPorMetodo,
      gastosPorMetodo,
      saldosPorMetodo
    });
    
    const gastosTotal = gastos.reduce((sum, g) => sum + g.amount, 0);
    const neto = ingresos - gastosTotal;
    
    const pedidosPorEstado = {
      pendiente: pedidosValidos.filter(p => p.status === 'pendiente').length,
      entregado: pedidosValidos.filter(p => p.status === 'entregado').length,
      recogido: pedidosValidos.filter(p => p.status === 'recogido').length,
      cancelado: pedidos.filter(p => p.status === 'cancelado').length
    };

    // Eliminar duplicados antes de calcular planes y clientes frecuentes
    const pedidosUnicos = pedidosValidos.reduce((acc, pedido) => {
      if (!acc.find(p => p.id === pedido.id)) {
        acc.push(pedido);
      }
      return acc;
    }, [] as Pedido[]);

    const planesPopulares = pedidosUnicos.reduce((acc, pedido) => {
      const planName = pedido.plan.name;
      acc[planName] = (acc[planName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const clientesFrecuentes = pedidosUnicos.reduce((acc, pedido) => {
      const clienteName = pedido.cliente.name;
      acc[clienteName] = (acc[clienteName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      ingresos,
      totalPendiente,
      gastos: gastosTotal,
      neto,
      totalPedidos: pedidosUnicos.length,
      pedidosPorEstado,
      ingresosPorMetodo,
      gastosPorMetodo,
      saldosPorMetodo,
      planesPopulares,
      clientesFrecuentes,
      promedioPorPedido: pedidosUnicos.length > 0 ? ingresos / pedidosUnicos.length : 0
    };
  };

  const generarTablaCruzada = () => {
    // Filtrar pedidos válidos y únicos
    const pedidosValidos = pedidos.filter(p => !p.eliminado && p.status !== 'cancelado');
    const pedidosUnicos = pedidosValidos.reduce((acc, pedido) => {
      if (!acc.find(p => p.id === pedido.id)) {
        acc.push(pedido);
      }
      return acc;
    }, [] as Pedido[]);

    // Obtener todos los planes únicos usando planId (más confiable) y buscar el plan actual desde la lista
    const planIdsUnicos = new Set<string>();
    pedidosUnicos.forEach(p => {
      const planId = p.planId || p.plan?.id;
      if (planId) {
        planIdsUnicos.add(planId);
      }
    });

    const planesUnicos = Array.from(planIdsUnicos)
      .map(planId => {
        // Buscar el plan actual desde la lista de planes (más confiable)
        const planActual = planes.find(p => p.id === planId);
        if (planActual) {
          return {
            id: planActual.id,
            name: planActual.name,
            price: planActual.price
          };
        }
        // Fallback: buscar en los pedidos
        const pedido = pedidosUnicos.find(p => (p.planId || p.plan?.id) === planId);
        return {
          id: planId,
          name: pedido?.plan?.name || 'Plan Desconocido',
          price: pedido?.plan?.price || 0
        };
      })
      .sort((a, b) => a.price - b.price);

    // Generar rango de fechas
    const fechas = [];
    const fechaActual = new Date(filtros.fechaInicio);
    fechaActual.setHours(0, 0, 0, 0);
    const fechaFin = new Date(filtros.fechaFin);
    fechaFin.setHours(0, 0, 0, 0);

    while (fechaActual <= fechaFin) {
      fechas.push(new Date(fechaActual));
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    // Crear estructura de datos
    const tablaCruzada = fechas.map(fecha => {
      const pedidosDelDia = pedidosUnicos.filter(p => {
        // Usar fechaAsignacion en lugar de createdAt (fecha real del pedido)
        let fechaPedido: Date;
        if (p.fechaAsignacion instanceof Date) {
          fechaPedido = p.fechaAsignacion;
        } else if ((p.fechaAsignacion as any)?.toDate) {
          fechaPedido = (p.fechaAsignacion as any).toDate();
        } else {
          fechaPedido = new Date(p.fechaAsignacion || p.createdAt);
        }
        fechaPedido.setHours(0, 0, 0, 0);
        return fechaPedido.getTime() === fecha.getTime();
      });

      const datosPorPlan = planesUnicos.map(plan => {
        // Usar planId en lugar de plan.id para mayor confiabilidad
        const pedidosDelPlan = pedidosDelDia.filter(p => {
          const planIdDelPedido = p.planId || p.plan?.id;
          return planIdDelPedido === plan.id;
        });
        
        let servicios = pedidosDelPlan.length;
        // Usar el plan actual desde la lista de planes para calcular el valor base
        let valorBase = pedidosDelPlan.reduce((sum, p) => {
          const planIdDelPedido = p.planId || p.plan?.id;
          const planActual = planes.find(pl => pl.id === planIdDelPedido);
          const precioPlan = planActual?.price || p.plan?.price || 0;
          return sum + precioPlan;
        }, 0);
        let extras = 0;
        let pagado = 0;
        let pendiente = 0;

        // Calcular extras, pagado y pendiente para cada pedido
        pedidosDelPlan.forEach(pedido => {
          // Calcular modificaciones (extras) - usar el nuevo sistema de modificaciones
          if (pedido.modificacionesServicio && pedido.modificacionesServicio.length > 0) {
            const totalModificaciones = pedido.modificacionesServicio.reduce((sum, mod) => {
              const totalHorasExtras = mod.horasExtras?.reduce((hSum, h) => hSum + h.total, 0) || 0;
              const totalCobrosAdicionales = mod.cobrosAdicionales?.reduce((cSum, c) => cSum + c.monto, 0) || 0;
              const totalDescuentos = mod.descuentos?.reduce((dSum, d) => dSum + d.monto, 0) || 0;
              return sum + totalHorasExtras + totalCobrosAdicionales - totalDescuentos;
            }, 0);
            extras += totalModificaciones;
          }

          // Calcular pagado y pendiente
          const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + (pago.monto || 0), 0) || 0;
          const totalPedido = (pedido.total || 0) + (pedido.modificacionesServicio?.reduce((sum, mod) => {
            const totalHorasExtras = mod.horasExtras?.reduce((hSum, h) => hSum + h.total, 0) || 0;
            const totalCobrosAdicionales = mod.cobrosAdicionales?.reduce((cSum, c) => cSum + c.monto, 0) || 0;
            const totalDescuentos = mod.descuentos?.reduce((dSum, d) => dSum + d.monto, 0) || 0;
            return sum + totalHorasExtras + totalCobrosAdicionales - totalDescuentos;
          }, 0) || 0);
          
          pagado += totalPagado;
          pendiente += Math.max(0, totalPedido - totalPagado);
        });

        return {
          planId: plan.id,
          planName: plan.name,
          planPrice: plan.price,
          servicios,
          valorBase,
          extras,
          total: valorBase + extras,
          pagado,
          pendiente
        };
      });

      // Calcular totales del día
      const totalDia = datosPorPlan.reduce((acc, plan) => ({
        servicios: acc.servicios + plan.servicios,
        valorBase: acc.valorBase + plan.valorBase,
        extras: acc.extras + plan.extras,
        total: acc.total + plan.total,
        pagado: acc.pagado + plan.pagado,
        pendiente: acc.pendiente + plan.pendiente
      }), { servicios: 0, valorBase: 0, extras: 0, total: 0, pagado: 0, pendiente: 0 });

      return {
        fecha: new Date(fecha),
        datosPorPlan,
        totalDia
      };
    });

    // Calcular totales por plan (columnas)
    const totalesPorPlan = planesUnicos.map(plan => {
      const totalPlan = tablaCruzada.reduce((acc, dia) => {
        const planData = dia.datosPorPlan.find(p => p.planId === plan.id);
        if (planData) {
          return {
            servicios: acc.servicios + planData.servicios,
            valorBase: acc.valorBase + planData.valorBase,
            extras: acc.extras + planData.extras,
            total: acc.total + planData.total,
            pagado: acc.pagado + planData.pagado,
            pendiente: acc.pendiente + planData.pendiente
          };
        }
        return acc;
      }, { servicios: 0, valorBase: 0, extras: 0, total: 0, pagado: 0, pendiente: 0 });

      return {
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.price,
        ...totalPlan
      };
    });

    // Calcular total general
    const totalGeneral = totalesPorPlan.reduce((acc, plan) => ({
      servicios: acc.servicios + plan.servicios,
      valorBase: acc.valorBase + plan.valorBase,
      extras: acc.extras + plan.extras,
      total: acc.total + plan.total,
      pagado: acc.pagado + plan.pagado,
      pendiente: acc.pendiente + plan.pendiente
    }), { servicios: 0, valorBase: 0, extras: 0, total: 0, pagado: 0, pendiente: 0 });

    return {
      fechas,
      planesUnicos,
      tablaCruzada,
      totalesPorPlan,
      totalGeneral
    };
  };

  const exportarReporte = () => {
    const stats = calcularEstadisticas();
    const fechaInicioStr = formatDate(filtros.fechaInicio, 'dd/MM/yyyy');
    const fechaFinStr = formatDate(filtros.fechaFin, 'dd/MM/yyyy');
    
    console.log('📊 Exportando reporte a Excel...');
    console.log('📊 Estadísticas:', stats);
    
    // Crear un nuevo workbook
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Resumen General
    const resumenData = [
      ['REPORTE DE PEDIDOS'],
      [''],
      ['Período', `${fechaInicioStr} - ${fechaFinStr}`],
      ['Fecha de generación', formatDate(new Date(), 'dd/MM/yyyy HH:mm')],
      [''],
      ['RESUMEN FINANCIERO'],
      ['Ingresos Cobrados', stats.ingresos],
      ['Total Pendiente', stats.totalPendiente],
      ['Gastos', stats.gastos],
      ['Neto', stats.neto],
      ['Promedio por pedido', stats.promedioPorPedido],
      [''],
      ['SALDOS POR MÉTODO DE PAGO'],
      ['Efectivo', stats.saldosPorMetodo.efectivo],
      ['Nequi', stats.saldosPorMetodo.nequi],
      ['Daviplata', stats.saldosPorMetodo.daviplata],
      [''],
      ['INGRESOS POR MÉTODO DE PAGO'],
      ['Efectivo', stats.ingresosPorMetodo.efectivo],
      ['Nequi', stats.ingresosPorMetodo.nequi],
      ['Daviplata', stats.ingresosPorMetodo.daviplata],
      [''],
      ['GASTOS POR MÉTODO DE PAGO'],
      ['Efectivo', stats.gastosPorMetodo.efectivo],
      ['Nequi', stats.gastosPorMetodo.nequi],
      ['Daviplata', stats.gastosPorMetodo.daviplata],
      [''],
      ['RESUMEN OPERACIONAL'],
      ['Total pedidos', stats.totalPedidos],
      ['Pendientes', stats.pedidosPorEstado.pendiente],
      ['Entregados', stats.pedidosPorEstado.entregado],
      ['Recogidos', stats.pedidosPorEstado.recogido],
      ['Cancelados', stats.pedidosPorEstado.cancelado]
    ];
    
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    
    // Configurar ancho de columnas
    wsResumen['!cols'] = [
      { wch: 25 }, // Columna A
      { wch: 20 }  // Columna B
    ];
    
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen General');
    
    // Hoja 2: Análisis de Planes
    const planesData = [
      ['PLAN', 'CANTIDAD', 'VALOR TOTAL', 'PRECIO UNITARIO', 'SERVICIOS MODIFICADOS'],
      ...analisisPlanes.map(plan => [
        plan.planName,
        plan.cantidad,
        plan.valorTotal,
        plan.planPrice,
        plan.modificados || 0
      ])
    ];
    
    const wsPlanes = XLSX.utils.aoa_to_sheet(planesData);
    wsPlanes['!cols'] = [
      { wch: 20 }, // Plan
      { wch: 12 }, // Cantidad
      { wch: 15 }, // Valor Total
      { wch: 15 }, // Precio Unitario
      { wch: 20 }  // Servicios Modificados
    ];
    
    XLSX.utils.book_append_sheet(wb, wsPlanes, 'Análisis de Planes');
    
    // Hoja 3: Clientes con Saldo Pendiente
    // Filtrar pedidos válidos (sin duplicados, eliminados ni cancelados)
    const pedidosValidosParaExportacion = pedidos
      .filter(p => !p.eliminado && p.status !== 'cancelado')
      .reduce((acc, pedido) => {
        if (!acc.find(p => p.id === pedido.id)) {
          acc.push(pedido);
        }
        return acc;
      }, [] as Pedido[]);
    
    const clientesConSaldo = Object.entries(stats.clientesFrecuentes)
      .map(([clienteName, cantidad]) => {
        const pedidosCliente = pedidosValidosParaExportacion.filter(p => p.cliente.name === clienteName);
        const serviciosTotales = pedidosCliente.reduce((sum, p) => sum + (p.total || 0), 0);
        const abonosRealizados = pedidosCliente.reduce((sum, p) => {
          return sum + (p.pagosRealizados?.reduce((sumPago, pago) => sumPago + (pago.monto || 0), 0) || 0);
        }, 0);
        const saldoPendiente = Math.max(0, serviciosTotales - abonosRealizados);
        
        return {
          cliente: clienteName,
          servicios: cantidad,
          serviciosTotales,
          abonosRealizados,
          saldoPendiente,
          telefono: pedidosCliente[0]?.cliente.phone || ''
        };
      })
      .filter(cliente => cliente.saldoPendiente > 0)
      .sort((a, b) => b.saldoPendiente - a.saldoPendiente);
    
    const clientesData = [
      ['CLIENTE', 'TELÉFONO', 'SERVICIOS', 'TOTAL SERVICIOS', 'ABONOS REALIZADOS', 'SALDO PENDIENTE'],
      ...clientesConSaldo.map(cliente => [
        cliente.cliente,
        cliente.telefono,
        cliente.servicios,
        cliente.serviciosTotales,
        cliente.abonosRealizados,
        cliente.saldoPendiente
      ])
    ];
    
    const wsClientes = XLSX.utils.aoa_to_sheet(clientesData);
    wsClientes['!cols'] = [
      { wch: 25 }, // Cliente
      { wch: 15 }, // Teléfono
      { wch: 12 }, // Servicios
      { wch: 15 }, // Total Servicios
      { wch: 15 }, // Abonos
      { wch: 15 }  // Saldo Pendiente
    ];
    
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes con Saldo');
    
    // Hoja 4: Detalle de Pedidos
    const pedidosData = [
      ['FECHA', 'CLIENTE', 'PLAN', 'ESTADO', 'TOTAL', 'PAGADO', 'PENDIENTE', 'MÉTODO PAGO'],
      ...pedidos.map(pedido => {
        const totalPagado = pedido.pagosRealizados?.reduce((sum, pago) => sum + (pago.monto || 0), 0) || 0;
        const totalPedido = pedido.total || 0;
        const saldoPendiente = totalPedido - totalPagado;
        const metodoPago = pedido.pagosRealizados?.map(p => p.medioPago).join(', ') || 'Sin pago';
        
        return [
          formatDate(pedido.fechaAsignacion, 'dd/MM/yyyy'),
          pedido.cliente.name,
          pedido.plan.name,
          pedido.status,
          totalPedido,
          totalPagado,
          saldoPendiente,
          metodoPago
        ];
      })
    ];
    
    const wsPedidos = XLSX.utils.aoa_to_sheet(pedidosData);
    wsPedidos['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 25 }, // Cliente
      { wch: 15 }, // Plan
      { wch: 12 }, // Estado
      { wch: 12 }, // Total
      { wch: 12 }, // Pagado
      { wch: 12 }, // Pendiente
      { wch: 15 }  // Método Pago
    ];
    
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Detalle de Pedidos');
    
    // Hoja 5: Modificaciones
    const modificacionesData = [
      ['CONCEPTO', 'VALOR'],
      ['Horas Extras', totalModificaciones.horasExtras],
      ['Cobros Adicionales', totalModificaciones.cobrosAdicionales],
      ['Descuentos', totalModificaciones.descuentos],
      ['TOTAL MODIFICACIONES', totalModificaciones.total]
    ];
    
    const wsModificaciones = XLSX.utils.aoa_to_sheet(modificacionesData);
    wsModificaciones['!cols'] = [
      { wch: 20 }, // Concepto
      { wch: 15 }  // Valor
    ];
    
    XLSX.utils.book_append_sheet(wb, wsModificaciones, 'Modificaciones');
    
    // Generar y descargar el archivo
    const nombreArchivo = `reporte_${fechaInicioStr.replace(/\//g, '-')}_a_${fechaFinStr.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    console.log('✅ Reporte exportado exitosamente:', nombreArchivo);
  };

  const exportarTablaCruzada = () => {
    const tablaData = generarTablaCruzada();
    const fechaInicioStr = formatDate(filtros.fechaInicio, 'dd/MM/yyyy');
    const fechaFinStr = formatDate(filtros.fechaFin, 'dd/MM/yyyy');
    
    console.log('📊 Exportando tabla cruzada a Excel...');
    console.log('📊 Datos de tabla cruzada:', tablaData);
    
    // Crear un nuevo workbook
    const wb = XLSX.utils.book_new();
    
    // Preparar datos para Excel
    const excelData = [];
    
    // Encabezados principales: Fecha | PLAN 1 | PLAN 2 | ... | TOTAL
    const encabezados = ['Fecha'];
    tablaData.planesUnicos.forEach(plan => {
      encabezados.push(plan.name); // Nombre del plan como encabezado principal
    });
    encabezados.push('TOTAL');
    
    excelData.push(encabezados);
    
    // Sub-encabezados: Fecha | PLAN 1 (Servicios, Valor Base, Extras, Total) | PLAN 2 (...) | TOTAL (...)
    const subEncabezados = [''];
    tablaData.planesUnicos.forEach(plan => {
      subEncabezados.push('Servicios');
      subEncabezados.push('Valor Base');
      subEncabezados.push('Extras');
      subEncabezados.push('Total');
    });
    subEncabezados.push('Servicios');
    subEncabezados.push('Valor Base');
    subEncabezados.push('Extras');
    subEncabezados.push('Total');
    
    excelData.push(subEncabezados);
    
    // Datos por día
    tablaData.tablaCruzada.forEach(dia => {
      const fila = [formatDate(dia.fecha, 'dd/MM/yyyy')];
      
      // Datos por plan
      tablaData.planesUnicos.forEach(plan => {
        const planData = dia.datosPorPlan.find(p => p.planId === plan.id);
        if (planData) {
          fila.push(planData.servicios.toString());
          fila.push(planData.valorBase.toString());
          fila.push(planData.extras.toString());
          fila.push(planData.total.toString());
        } else {
          fila.push('0', '0', '0', '0');
        }
      });
      
      // Total del día
      fila.push(dia.totalDia.servicios.toString());
      fila.push(dia.totalDia.valorBase.toString());
      fila.push(dia.totalDia.extras.toString());
      fila.push(dia.totalDia.total.toString());
      
      excelData.push(fila);
    });
    
    // Fila de totales por plan
    const filaTotales = ['TOTAL'];
    tablaData.totalesPorPlan.forEach(plan => {
      filaTotales.push(plan.servicios.toString());
      filaTotales.push(plan.valorBase.toString());
      filaTotales.push(plan.extras.toString());
      filaTotales.push(plan.total.toString());
    });
    
    // Total general
    filaTotales.push(tablaData.totalGeneral.servicios.toString());
    filaTotales.push(tablaData.totalGeneral.valorBase.toString());
    filaTotales.push(tablaData.totalGeneral.extras.toString());
    filaTotales.push(tablaData.totalGeneral.total.toString());
    
    excelData.push(filaTotales);
    
    // Fila de pagado por plan
    const filaPagado = ['PAGADO'];
    tablaData.totalesPorPlan.forEach(plan => {
      filaPagado.push('');
      filaPagado.push('');
      filaPagado.push('');
      filaPagado.push(plan.pagado.toString());
    });
    filaPagado.push('');
    filaPagado.push('');
    filaPagado.push('');
    filaPagado.push(tablaData.totalGeneral.pagado.toString());
    
    excelData.push(filaPagado);
    
    // Fila de pendiente por plan
    const filaPendiente = ['PENDIENTE'];
    tablaData.totalesPorPlan.forEach(plan => {
      filaPendiente.push('');
      filaPendiente.push('');
      filaPendiente.push('');
      filaPendiente.push(plan.pendiente.toString());
    });
    filaPendiente.push('');
    filaPendiente.push('');
    filaPendiente.push('');
    filaPendiente.push(tablaData.totalGeneral.pendiente.toString());
    
    excelData.push(filaPendiente);
    
    // Crear hoja de trabajo
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Ajustar ancho de columnas
    const colWidths = [{ wch: 12 }]; // Fecha
    tablaData.planesUnicos.forEach(() => {
      colWidths.push({ wch: 10 }); // Servicios
      colWidths.push({ wch: 12 }); // Valor Base
      colWidths.push({ wch: 12 }); // Extras
      colWidths.push({ wch: 12 }); // Total
    });
    colWidths.push({ wch: 10 }); // Total Servicios
    colWidths.push({ wch: 12 }); // Total Valor Base
    colWidths.push({ wch: 12 }); // Total Extras
    colWidths.push({ wch: 12 }); // Total Total
    
    ws['!cols'] = colWidths;
    
    // Agregar hoja al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Tabla Cruzada');
    
    // Generar y descargar el archivo
    const nombreArchivo = `tabla_cruzada_${fechaInicioStr.replace(/\//g, '-')}_a_${fechaFinStr.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    console.log('✅ Tabla cruzada exportada exitosamente:', nombreArchivo);
  };

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer' | 'semana' | 'mes') => {
    const hoyBase = getCurrentDateColombia();
    // Crear copias nuevas de las fechas para evitar mutaciones
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
        setFiltros(prev => ({ ...prev, fechaInicio: hoy, fechaFin: hoy, tipoReporte: 'diario' }));
        break;
      case 'ayer':
        setFiltros(prev => ({ ...prev, fechaInicio: ayer, fechaFin: ayer, tipoReporte: 'diario' }));
        break;
      case 'semana':
        setFiltros(prev => ({ ...prev, fechaInicio: inicioSemana, fechaFin: hoy, tipoReporte: 'semanal' }));
        break;
      case 'mes':
        setFiltros(prev => ({ ...prev, fechaInicio: inicioMes, fechaFin: hoy, tipoReporte: 'mensual' }));
        break;
    }
  };

  const stats = calcularEstadisticas();

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
            Reportes Avanzados
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Análisis detallado del negocio con filtros personalizables
          </p>
        </div>
        <div className="flex space-x-3">
        <button
          onClick={exportarReporte}
          className="btn-primary"
          disabled={pedidos.length === 0}
        >
          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Exportar Excel
          </button>
          <button
            onClick={exportarTablaCruzada}
            className="btn-secondary"
            disabled={pedidos.length === 0}
            title="Exportar tabla cruzada de servicios por día y plan"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Tabla Cruzada
        </button>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros Rápidos</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => aplicarFiltroRapido('hoy')}
            className="btn-secondary text-sm"
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarFiltroRapido('ayer')}
            className="btn-secondary text-sm"
          >
            Ayer
          </button>
          <button
            onClick={() => aplicarFiltroRapido('semana')}
            className="btn-secondary text-sm"
          >
            Esta Semana
          </button>
          <button
            onClick={() => aplicarFiltroRapido('mes')}
            className="btn-secondary text-sm"
          >
            Este Mes
          </button>
        </div>
      </div>

      {/* Filtros avanzados */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros Avanzados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              className="input-field"
              value={formatDateInputLocal(filtros.fechaInicio)}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-').map(Number);
                const nuevaFecha = new Date(year, (month || 1) - 1, day || 1);
                nuevaFecha.setHours(0, 0, 0, 0);
                setFiltros(prev => ({ 
                ...prev, 
                  fechaInicio: nuevaFecha,
                tipoReporte: 'personalizado'
                }))
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
              value={formatDateInputLocal(filtros.fechaFin)}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-').map(Number);
                const nuevaFecha = new Date(year, (month || 1) - 1, day || 1);
                nuevaFecha.setHours(0, 0, 0, 0);
                setFiltros(prev => ({ 
                ...prev, 
                  fechaFin: nuevaFecha,
                tipoReporte: 'personalizado'
                }))
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              className="input-field"
              value={filtros.estado}
              onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="entregado">Entregado</option>
              <option value="recogido">Recogido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan
            </label>
            <select
              className="input-field"
              value={filtros.planId}
              onChange={(e) => {
                const selectedPlanId = e.target.value;
                const selectedPlan = planes.find(p => p.id === selectedPlanId);
                console.log('🎯 Plan seleccionado:', {
                  planId: selectedPlanId,
                  planName: selectedPlan?.name,
                  allPlanes: planes.map(p => ({ id: p.id, name: p.name }))
                });
                setFiltros(prev => ({ ...prev, planId: selectedPlanId }));
              }}
            >
              <option value="todos">Todos los planes</option>
              {planes.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              className="input-field"
              value={filtros.clienteId}
              onChange={(e) => setFiltros(prev => ({ ...prev, clienteId: e.target.value }))}
            >
              <option value="todos">Todos los clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>{cliente.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                const fechaHoy = getCurrentDateColombia();
                fechaHoy.setHours(0, 0, 0, 0);
                setFiltros({
                  fechaInicio: fechaHoy,
                  fechaFin: fechaHoy,
                estado: 'todos',
                planId: 'todos',
                clienteId: 'todos',
                tipoReporte: 'diario'
                })
              }}
              className="btn-secondary w-full"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de resultados */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-colored border-l-4 border-success-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-success-100 to-success-200 border border-success-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ingresos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.ingresos)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-warning-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-warning-100 to-warning-200 border border-warning-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendiente</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalPendiente)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-danger-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-danger-100 to-danger-200 border border-danger-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-danger-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Gastos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.gastos)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-primary-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 border border-primary-300 shadow-md">
              <ChartBarIcon className="h-7 w-7 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Neto</p>
              <p className={`text-2xl font-bold ${stats.neto >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {formatCurrency(stats.neto)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-colored border-l-4 border-info-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-info-100 to-info-200 border border-info-300 shadow-md">
              <ClipboardDocumentListIcon className="h-7 w-7 text-info-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalPedidos}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ingresos por método de pago */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ingresos por Método de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Efectivo</p>
                <p className="text-xs text-green-600">Dinero en efectivo</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-900">
                {formatCurrency(stats.saldosPorMetodo.efectivo)}
              </p>
              <p className="text-xs text-green-600">
                Ingresos: {formatCurrency(stats.ingresosPorMetodo.efectivo)} | 
                Gastos: {formatCurrency(stats.gastosPorMetodo.efectivo)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Nequi</p>
                <p className="text-xs text-blue-600">Billetera digital Nequi</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-900">
                {formatCurrency(stats.saldosPorMetodo.nequi)}
              </p>
              <p className="text-xs text-blue-600">
                Ingresos: {formatCurrency(stats.ingresosPorMetodo.nequi)} | 
                Gastos: {formatCurrency(stats.gastosPorMetodo.nequi)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-800">Daviplata</p>
                <p className="text-xs text-purple-600">Billetera digital Daviplata</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-purple-900">
                {formatCurrency(stats.saldosPorMetodo.daviplata)}
              </p>
              <p className="text-xs text-purple-600">
                Ingresos: {formatCurrency(stats.ingresosPorMetodo.daviplata)} | 
                Gastos: {formatCurrency(stats.gastosPorMetodo.daviplata)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Análisis detallado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla de Clientes con Saldo Pendiente */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Clientes con Saldo Pendiente</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicios Totales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abonos Realizados
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(stats.clientesFrecuentes)
                  .map(([clienteName, cantidad]) => {
                    // Filtrar pedidos válidos para este cliente (sin duplicados, eliminados ni cancelados)
                    const pedidosCliente = pedidos
                      .filter(p => p.cliente.name === clienteName && !p.eliminado && p.status !== 'cancelado')
                      .reduce((acc, pedido) => {
                        // Eliminar duplicados por ID
                        if (!acc.find(p => p.id === pedido.id)) {
                          acc.push(pedido);
                        }
                        return acc;
                      }, [] as Pedido[]);
                    
                    // Calcular totales
                    const serviciosTotales = pedidosCliente.reduce((sum, p) => sum + (p.total || 0), 0);
                    const abonosRealizados = pedidosCliente.reduce((sum, p) => {
                      return sum + (p.pagosRealizados?.reduce((sumPago, pago) => sumPago + (pago.monto || 0), 0) || 0);
                    }, 0);
                    const saldoPendiente = Math.max(0, serviciosTotales - abonosRealizados);
                    
                    console.log('👤 Cliente:', clienteName, {
                      pedidos: pedidosCliente.length,
                      serviciosTotales,
                      abonosRealizados,
                      saldoPendiente
                    });
                    
                    // Solo mostrar si tiene saldo pendiente
                    if (saldoPendiente <= 0) return null;
                    
                    // Obtener teléfono del cliente (usar el primer pedido)
                    const telefonoCliente = pedidosCliente[0]?.cliente.phone || '';
                    
                    // Generar mensaje de WhatsApp
                    const ahora = new Date();
                    const hora = ahora.getHours();
                    let saludo = '';
                    if (hora < 12) {
                      saludo = 'Buenos días';
                    } else if (hora < 18) {
                      saludo = 'Buenas tardes';
                    } else {
                      saludo = 'Buenas noches';
                    }
                    
                    const mensaje = `${saludo}, Lavadoras GLOBAL, le recuerda que tiene un saldo pendiente de $${saldoPendiente.toLocaleString()}, muchas gracias`;
                    const whatsappUrl = `https://wa.me/${telefonoCliente.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(mensaje)}`;
                    
                    return (
                      <tr key={clienteName}>
                        <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary-600">
                                  {clienteName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{clienteName}</div>
                              <div className="text-sm text-gray-500">{telefonoCliente}</div>
                  </div>
                </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${serviciosTotales.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${abonosRealizados.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          ${saldoPendiente.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                          >
                            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                            </svg>
                            WhatsApp
                          </a>
                        </td>
                      </tr>
                    );
                  })
                  .filter(Boolean)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Análisis de Planes y Modificaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Análisis de Planes */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Análisis de Planes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analisisPlanes.map((plan) => (
                  <tr key={plan.planId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {plan.planName.charAt(plan.planName.length - 1)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{plan.planName}</div>
                          <div className="text-xs text-gray-500">
                            ${plan.planPrice.toLocaleString()} {plan.modificados > 0 && `• ${plan.modificados} modificado(s)`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {plan.cantidad} servicios
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${plan.valorTotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totales de Modificaciones */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Totales de Modificaciones</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Horas Extras</span>
              </div>
              <span className="text-lg font-semibold text-green-600">
                ${totalModificaciones.horasExtras.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Cobros Adicionales</span>
              </div>
              <span className="text-lg font-semibold text-blue-600">
                ${totalModificaciones.cobrosAdicionales.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-sm font-medium text-gray-900">Descuentos</span>
              </div>
              <span className="text-lg font-semibold text-red-600">
                -${totalModificaciones.descuentos.toLocaleString()}
              </span>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-900">Total Modificaciones</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  ${totalModificaciones.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detalle de servicios utilizados en los reportes */}
      <div className="card mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Detalle de Servicios (según filtros actuales)
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Esta tabla muestra exactamente los servicios que se están utilizando para el análisis de planes y los totales.
          Debe coincidir con lo que ves en la sección de Servicios usando el mismo rango de fechas y filtros.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pagado
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pendiente
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pedidos.map((pedido) => {
                const totalPagado = pedido.pagosRealizados?.reduce(
                  (sum, pago) => sum + (pago.monto || 0),
                  0
                ) || 0;
                const totalPedido = pedido.total || 0;
                const saldoPendiente = Math.max(0, totalPedido - totalPagado);

                // Determinar el plan a mostrar usando la misma lógica que el análisis
                const planIdEfectivo = getPlanIdEfectivo(pedido);
                const planActual = planIdEfectivo
                  ? planes.find((p) => p.id === planIdEfectivo)
                  : undefined;
                const nombrePlan =
                  planActual?.name || pedido.plan?.name || 'Plan desconocido';

                return (
                  <tr key={pedido.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(pedido.fechaAsignacion, 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      {pedido.cliente?.name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      {nombrePlan}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      {pedido.status}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(totalPedido)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(totalPagado)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(saldoPendiente)}
                    </td>
                  </tr>
                );
              })}
              {pedidos.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 text-center text-sm text-gray-500"
                  >
                    No hay servicios para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pedidos.length === 0 && !loading && (
        <div className="card text-center py-12">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay datos para los filtros seleccionados</p>
        </div>
      )}
    </div>
  );
};

export default Reportes;
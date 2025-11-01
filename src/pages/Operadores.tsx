import React, { useState, useEffect } from 'react';
import { 
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  HomeIcon,
  WrenchScrewdriverIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { pedidoService, gastoService } from '../services/firebaseService';
import { obtenerTodosLosMantenimientos } from '../services/mantenimientoService';
import { usuarioService } from '../services/usuarioService';
import { Pedido, Gasto, Mantenimiento, PagoRealizado, ModificacionServicio } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';

interface FiltrosOperadores {
  fechaInicio: Date;
  fechaFin: Date;
  tipoFiltro: 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';
}

type TipoAccion = 'todos' | 'creados' | 'entregados' | 'recogidos' | 'modificaciones' | 'pagos' | 'gastos' | 'mantenimientos';

interface ResumenOperador {
  usuario: string;
  ingresos: number;
  gastos: number;
  mantenimientos: number;
  saldo: number;
  totalPagos: number;
  totalGastos: number;
  totalMantenimientos: number;
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
  
  // Estado para el modal
  const [operadorSeleccionado, setOperadorSeleccionado] = useState<string | null>(null);
  const [tipoAccionSeleccionado, setTipoAccionSeleccionado] = useState<TipoAccion>('todos');
  const [filtrosModal, setFiltrosModal] = useState<FiltrosOperadores>({
    fechaInicio: new Date(fechaHoy),
    fechaFin: new Date(fechaHoy),
    tipoFiltro: 'hoy'
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar TODOS los pedidos para poder filtrar por operador
      const todosLosPedidos = await pedidoService.getAllPedidos();
      setPedidos(todosLosPedidos);

      // Cargar todos los gastos
      const fechaLimite = new Date();
      fechaLimite.setFullYear(fechaLimite.getFullYear() - 1); // Último año
      const todosLosGastos = await gastoService.getGastosDelRango(fechaLimite, new Date());
      setGastos(todosLosGastos);

      // Cargar todos los mantenimientos
      const todosLosMantenimientos = await obtenerTodosLosMantenimientos();
      setMantenimientos(todosLosMantenimientos);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular resumen de todos los operadores
  const calcularResumenesOperadores = (): ResumenOperador[] => {
    const fechaInicio = new Date(filtros.fechaInicio);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(filtros.fechaFin);
    fechaFin.setHours(23, 59, 59, 999);

    const resumenes = new Map<string, ResumenOperador>();

    // Procesar pagos
    pedidos.forEach(pedido => {
      if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
        pedido.pagosRealizados.forEach((pago: PagoRealizado) => {
          let fechaPago: Date;
          if (pago.fecha instanceof Date) {
            fechaPago = pago.fecha;
          } else if ((pago.fecha as any)?.toDate) {
            fechaPago = (pago.fecha as any).toDate();
          } else if (pago.fecha) {
            fechaPago = new Date(pago.fecha as any);
          } else {
            fechaPago = pedido.createdAt || new Date();
          }

          const fechaPagoNormalizada = new Date(fechaPago);
          fechaPagoNormalizada.setHours(0, 0, 0, 0);

          if (fechaPagoNormalizada >= fechaInicio && fechaPagoNormalizada <= fechaFin && pago.registradoPor) {
            if (!resumenes.has(pago.registradoPor)) {
              resumenes.set(pago.registradoPor, {
                usuario: pago.registradoPor,
                ingresos: 0,
                gastos: 0,
                mantenimientos: 0,
                saldo: 0,
                totalPagos: 0,
                totalGastos: 0,
                totalMantenimientos: 0
              });
            }
            const resumen = resumenes.get(pago.registradoPor)!;
            // Solo contar efectivo para el arqueo
            if (pago.medioPago === 'efectivo') {
              resumen.ingresos += pago.monto || 0;
            }
            resumen.totalPagos++;
          }
        });
      }
    });

    // Procesar gastos
    gastos.forEach(gasto => {
      if (gasto.registradoPor) {
        const fechaGasto = gasto.date;
        if (fechaGasto >= fechaInicio && fechaGasto <= fechaFin) {
          if (!resumenes.has(gasto.registradoPor)) {
            resumenes.set(gasto.registradoPor, {
              usuario: gasto.registradoPor,
              ingresos: 0,
              gastos: 0,
              mantenimientos: 0,
              saldo: 0,
              totalPagos: 0,
              totalGastos: 0,
              totalMantenimientos: 0
            });
          }
          const resumen = resumenes.get(gasto.registradoPor)!;
          // Solo contar efectivo para el arqueo
          if (gasto.medioPago === 'efectivo') {
            resumen.gastos += gasto.amount;
          }
          resumen.totalGastos++;
        }
      }
    });

    // Procesar mantenimientos
    mantenimientos.forEach(mant => {
      if (mant.registradoPor) {
        const fechaMant = mant.fechaInicio;
        if (fechaMant >= fechaInicio && fechaMant <= fechaFin) {
          if (!resumenes.has(mant.registradoPor)) {
            resumenes.set(mant.registradoPor, {
              usuario: mant.registradoPor,
              ingresos: 0,
              gastos: 0,
              mantenimientos: 0,
              saldo: 0,
              totalPagos: 0,
              totalGastos: 0,
              totalMantenimientos: 0
            });
          }
          const resumen = resumenes.get(mant.registradoPor)!;
          // Solo contar efectivo para el arqueo
          if (mant.medioPago === 'efectivo') {
            resumen.mantenimientos += mant.costoReparacion;
            resumen.gastos += mant.costoReparacion;
          }
          resumen.totalMantenimientos++;
        }
      }
    });

    // Calcular saldos
    const resumenesArray = Array.from(resumenes.values());
    resumenesArray.forEach(resumen => {
      resumen.saldo = resumen.ingresos - resumen.gastos;
    });

    // Ordenar por nombre
    resumenesArray.sort((a, b) => a.usuario.localeCompare(b.usuario));

    return resumenesArray;
  };

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer' | 'semana' | 'mes', esModal: boolean = false) => {
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

    const nuevosFiltros = {
      fechaInicio: hoy,
      fechaFin: hoy,
      tipoFiltro: tipo
    } as FiltrosOperadores;

    switch (tipo) {
      case 'hoy':
        nuevosFiltros.fechaInicio = hoy;
        nuevosFiltros.fechaFin = hoy;
        break;
      case 'ayer':
        nuevosFiltros.fechaInicio = ayer;
        nuevosFiltros.fechaFin = ayer;
        break;
      case 'semana':
        nuevosFiltros.fechaInicio = inicioSemana;
        nuevosFiltros.fechaFin = hoy;
        break;
      case 'mes':
        nuevosFiltros.fechaInicio = inicioMes;
        nuevosFiltros.fechaFin = hoy;
        break;
    }

    if (esModal) {
      setFiltrosModal(nuevosFiltros);
    } else {
      setFiltros(nuevosFiltros);
    }
  };

  const abrirModalOperador = (usuario: string) => {
    setOperadorSeleccionado(usuario);
    setTipoAccionSeleccionado('todos');
    aplicarFiltroRapido('hoy', true);
  };

  const cerrarModal = () => {
    setOperadorSeleccionado(null);
    setTipoAccionSeleccionado('todos');
  };

  const [nombresUsuarios, setNombresUsuarios] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Cargar nombres de usuarios únicos
    const cargarNombresUsuarios = async () => {
      const uidsUnicos = new Set<string>();
      pedidos.forEach(pedido => {
        if (pedido.createdBy) {
          uidsUnicos.add(pedido.createdBy);
        }
      });

      const nombresMap = new Map<string, string>();
      const promesasUsuarios = Array.from(uidsUnicos).map(async (uid) => {
        try {
          const usuario = await usuarioService.getUsuarioById(uid);
          if (usuario) {
            nombresMap.set(uid, usuario.name);
          }
        } catch (error) {
          console.error(`Error cargando usuario ${uid}:`, error);
        }
      });

      await Promise.all(promesasUsuarios);
      setNombresUsuarios(nombresMap);
    };

    if (pedidos.length > 0) {
      cargarNombresUsuarios();
    }
  }, [pedidos]);

  // Filtrar datos según el tipo de acción y operador seleccionado
  const filtrarDatosOperador = () => {
    if (!operadorSeleccionado) return { pedidos: [], gastos: [], mantenimientos: [], modificaciones: [], pagos: [] };

    const fechaInicio = new Date(filtrosModal.fechaInicio);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(filtrosModal.fechaFin);
    fechaFin.setHours(23, 59, 59, 999);

    let pedidosFiltrados: Pedido[] = [];
    let gastosFiltrados: Gasto[] = [];
    let mantenimientosFiltrados: Mantenimiento[] = [];
    let modificaciones: Array<{ pedido: Pedido; modificacion: ModificacionServicio }> = [];
    let pagosFiltrados: Array<{ pedido: Pedido; pago: PagoRealizado }> = [];

    // Filtrar según tipo de acción
    switch (tipoAccionSeleccionado) {
      case 'creados':
        pedidosFiltrados = pedidos.filter(pedido => {
          const nombreCreador = nombresUsuarios.get(pedido.createdBy);
          const fechaCreacion = pedido.fechaAsignacion;
          const fechaCreacionNormalizada = new Date(fechaCreacion);
          fechaCreacionNormalizada.setHours(0, 0, 0, 0);
          
          return nombreCreador === operadorSeleccionado &&
                 fechaCreacionNormalizada >= fechaInicio &&
                 fechaCreacionNormalizada <= fechaFin;
        });
        break;

      case 'entregados':
        pedidosFiltrados = pedidos.filter(pedido => 
          pedido.entregadoPor === operadorSeleccionado &&
          pedido.fechaEntrega &&
          pedido.fechaEntrega >= fechaInicio &&
          pedido.fechaEntrega <= fechaFin
        );
        break;

      case 'recogidos':
        pedidosFiltrados = pedidos.filter(pedido => 
          pedido.recogidoPor === operadorSeleccionado &&
          pedido.fechaRecogida &&
          pedido.fechaRecogida >= fechaInicio &&
          pedido.fechaRecogida <= fechaFin
        );
        break;

      case 'modificaciones':
        pedidos.forEach(pedido => {
          if (pedido.modificacionesServicio && pedido.modificacionesServicio.length > 0) {
            pedido.modificacionesServicio.forEach(mod => {
              const fechaMod = mod.fecha;
              if (mod.aplicadoPor === operadorSeleccionado &&
                  fechaMod >= fechaInicio &&
                  fechaMod <= fechaFin) {
                modificaciones.push({ pedido, modificacion: mod });
              }
            });
          }
        });
        break;

      case 'pagos':
        pedidos.forEach(pedido => {
          if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
            pedido.pagosRealizados.forEach(pago => {
              let fechaPago: Date;
              if (pago.fecha instanceof Date) {
                fechaPago = pago.fecha;
              } else if ((pago.fecha as any)?.toDate) {
                fechaPago = (pago.fecha as any).toDate();
              } else if (pago.fecha) {
                fechaPago = new Date(pago.fecha as any);
              } else {
                return;
              }

              const fechaPagoNormalizada = new Date(fechaPago);
              fechaPagoNormalizada.setHours(0, 0, 0, 0);

              if (pago.registradoPor === operadorSeleccionado &&
                  fechaPagoNormalizada >= fechaInicio &&
                  fechaPagoNormalizada <= fechaFin) {
                pagosFiltrados.push({ pedido, pago });
              }
            });
          }
        });
        break;

      case 'gastos':
        gastosFiltrados = gastos.filter(gasto =>
          gasto.registradoPor === operadorSeleccionado &&
          gasto.date >= fechaInicio &&
          gasto.date <= fechaFin
        );
        break;

      case 'mantenimientos':
        mantenimientosFiltrados = mantenimientos.filter(mant =>
          mant.registradoPor === operadorSeleccionado &&
          mant.fechaInicio >= fechaInicio &&
          mant.fechaInicio <= fechaFin
        );
        break;

      case 'todos':
      default:
        // Pedidos creados
        pedidos.forEach(pedido => {
          const nombreCreador = nombresUsuarios.get(pedido.createdBy);
          if (nombreCreador === operadorSeleccionado) {
            const fechaCreacion = new Date(pedido.fechaAsignacion);
            fechaCreacion.setHours(0, 0, 0, 0);
            if (fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin) {
              pedidosFiltrados.push(pedido);
            }
          }
          
          // Pedidos entregados
          if (pedido.entregadoPor === operadorSeleccionado && pedido.fechaEntrega) {
            const fechaEntrega = new Date(pedido.fechaEntrega);
            fechaEntrega.setHours(0, 0, 0, 0);
            if (fechaEntrega >= fechaInicio && fechaEntrega <= fechaFin) {
              if (!pedidosFiltrados.find(p => p.id === pedido.id)) {
                pedidosFiltrados.push(pedido);
              }
            }
          }
          
          // Pedidos recogidos
          if (pedido.recogidoPor === operadorSeleccionado && pedido.fechaRecogida) {
            const fechaRecogida = new Date(pedido.fechaRecogida);
            fechaRecogida.setHours(0, 0, 0, 0);
            if (fechaRecogida >= fechaInicio && fechaRecogida <= fechaFin) {
              if (!pedidosFiltrados.find(p => p.id === pedido.id)) {
                pedidosFiltrados.push(pedido);
              }
            }
          }

          // Modificaciones
          if (pedido.modificacionesServicio) {
            pedido.modificacionesServicio.forEach(mod => {
              if (mod.aplicadoPor === operadorSeleccionado) {
                const fechaMod = new Date(mod.fecha);
                fechaMod.setHours(0, 0, 0, 0);
                if (fechaMod >= fechaInicio && fechaMod <= fechaFin) {
                  modificaciones.push({ pedido, modificacion: mod });
                }
              }
            });
          }

          // Pagos
          if (pedido.pagosRealizados && pedido.pagosRealizados.length > 0) {
            pedido.pagosRealizados.forEach(pago => {
              let fechaPago: Date;
              if (pago.fecha instanceof Date) {
                fechaPago = pago.fecha;
              } else if ((pago.fecha as any)?.toDate) {
                fechaPago = (pago.fecha as any).toDate();
              } else if (pago.fecha) {
                fechaPago = new Date(pago.fecha as any);
              } else {
                return;
              }

              const fechaPagoNormalizada = new Date(fechaPago);
              fechaPagoNormalizada.setHours(0, 0, 0, 0);

              if (pago.registradoPor === operadorSeleccionado &&
                  fechaPagoNormalizada >= fechaInicio &&
                  fechaPagoNormalizada <= fechaFin) {
                pagosFiltrados.push({ pedido, pago });
              }
            });
          }
        });

        // Gastos
        gastosFiltrados = gastos.filter(gasto =>
          gasto.registradoPor === operadorSeleccionado &&
          gasto.date >= fechaInicio &&
          gasto.date <= fechaFin
        );

        // Mantenimientos
        mantenimientosFiltrados = mantenimientos.filter(mant =>
          mant.registradoPor === operadorSeleccionado &&
          mant.fechaInicio >= fechaInicio &&
          mant.fechaInicio <= fechaFin
        );
        break;
    }

    return { pedidos: pedidosFiltrados, gastos: gastosFiltrados, mantenimientos: mantenimientosFiltrados, modificaciones, pagos: pagosFiltrados };
  };

  const resumenesOperadores = calcularResumenesOperadores();
  const datosFiltrados = filtrarDatosOperador();

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

      {/* Cards de Operadores */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Operadores</h3>
        {resumenesOperadores.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No hay movimientos registrados por usuarios en el período seleccionado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumenesOperadores.map((resumen) => (
              <div
                key={resumen.usuario}
                onClick={() => abrirModalOperador(resumen.usuario)}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all cursor-pointer bg-white hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {resumen.usuario.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">{resumen.usuario}</h4>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Ingresos</div>
                    <div className="text-sm font-semibold text-green-600">
                      {formatCurrency(resumen.ingresos)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Gastos</div>
                    <div className="text-sm font-semibold text-red-600">
                      {formatCurrency(resumen.gastos)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Saldo</div>
                    <div className={`text-sm font-bold ${resumen.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(resumen.saldo)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  {resumen.totalPagos} pago(s) • {resumen.totalGastos} gasto(s) • {resumen.totalMantenimientos} mantenimiento(s)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalle del Operador */}
      {operadorSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {operadorSeleccionado.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{operadorSeleccionado}</h2>
                  <p className="text-sm text-gray-500">Detalle de actividades</p>
                </div>
              </div>
              <button
                onClick={cerrarModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Filtros del Modal */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              {/* Filtros rápidos */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filtros Rápidos</label>
                <div className="flex flex-wrap gap-2">
                  {(['hoy', 'ayer', 'semana', 'mes'] as const).map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => aplicarFiltroRapido(tipo, true)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        filtrosModal.tipoFiltro === tipo
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {tipo === 'hoy' ? 'Hoy' : tipo === 'ayer' ? 'Ayer' : tipo === 'semana' ? 'Esta Semana' : 'Este Mes'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtros de fecha */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={filtrosModal.fechaInicio.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const nuevaFecha = new Date(e.target.value);
                      nuevaFecha.setHours(0, 0, 0, 0);
                      setFiltrosModal(prev => ({ 
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
                    value={filtrosModal.fechaFin.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const nuevaFecha = new Date(e.target.value);
                      nuevaFecha.setHours(0, 0, 0, 0);
                      setFiltrosModal(prev => ({ 
                        ...prev, 
                        fechaFin: nuevaFecha,
                        tipoFiltro: 'personalizado'
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Selector de tipo de acción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Acción</label>
                <select
                  value={tipoAccionSeleccionado}
                  onChange={(e) => setTipoAccionSeleccionado(e.target.value as TipoAccion)}
                  className="input-field"
                >
                  <option value="todos">Todos</option>
                  <option value="creados">Pedidos Creados</option>
                  <option value="entregados">Pedidos Entregados</option>
                  <option value="recogidos">Pedidos Recogidos</option>
                  <option value="modificaciones">Modificaciones</option>
                  <option value="pagos">Pagos Recibidos</option>
                  <option value="gastos">Gastos Registrados</option>
                  <option value="mantenimientos">Mantenimientos Registrados</option>
                </select>
              </div>
            </div>

            {/* Resumen Financiero */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen Financiero</h3>
              {(() => {
                // Calcular totales según el tipo de acción seleccionado
                // Solo contar efectivo para el arqueo
                const totalIngresos = (datosFiltrados.pagos as any)?.reduce((sum: number, item: any) => {
                  return sum + (item.pago.medioPago === 'efectivo' ? item.pago.monto : 0);
                }, 0) || 0;
                
                // Calcular desglose por medio de pago
                const ingresoEfectivo = (datosFiltrados.pagos as any)?.reduce((sum: number, item: any) => {
                  return sum + (item.pago.medioPago === 'efectivo' ? item.pago.monto : 0);
                }, 0) || 0;
                const ingresoNequi = (datosFiltrados.pagos as any)?.reduce((sum: number, item: any) => {
                  return sum + (item.pago.medioPago === 'nequi' ? item.pago.monto : 0);
                }, 0) || 0;
                const ingresoDaviplata = (datosFiltrados.pagos as any)?.reduce((sum: number, item: any) => {
                  return sum + (item.pago.medioPago === 'daviplata' ? item.pago.monto : 0);
                }, 0) || 0;
                
                const totalGastos = datosFiltrados.gastos.reduce((sum, g) => sum + (g.medioPago === 'efectivo' ? g.amount : 0), 0);
                const totalMantenimientos = datosFiltrados.mantenimientos.reduce((sum, m) => sum + (m.medioPago === 'efectivo' ? m.costoReparacion : 0), 0);
                const totalGastosTotal = totalGastos + totalMantenimientos;
                const saldoFinal = totalIngresos - totalGastosTotal;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-5 border-2 border-green-300 shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 font-medium">Ingresos (Arqueo Efectivo)</div>
                        <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="text-3xl font-bold text-green-600">
                        {formatCurrency(totalIngresos)}
                      </div>
                      <div className="text-xs text-gray-500 mt-3 space-y-1">
                        <div>💰 Efectivo: {formatCurrency(ingresoEfectivo)}</div>
                        <div>📱 Nequi: {formatCurrency(ingresoNequi)}</div>
                        <div>💳 Daviplata: {formatCurrency(ingresoDaviplata)}</div>
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          Total: {formatCurrency(ingresoEfectivo + ingresoNequi + ingresoDaviplata)}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-5 border-2 border-red-300 shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 font-medium">Gastos</div>
                        <MinusCircleIcon className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="text-3xl font-bold text-red-600">
                        {formatCurrency(totalGastosTotal)}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {datosFiltrados.gastos.length} gasto(s) • {datosFiltrados.mantenimientos.length} mantenimiento(s)
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-5 border-2 border-blue-300 shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 font-medium">Saldo Final</div>
                        <ArrowRightIcon className={`h-5 w-5 ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className={`text-3xl font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(saldoFinal)}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Ingresos - Gastos
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Contenido según tipo de acción */}
            <div className="p-6">
              {tipoAccionSeleccionado === 'todos' && (
                <div className="space-y-6">
                  {/* Pedidos Creados */}
                  {pedidos.filter(p => {
                    const nombreCreador = nombresUsuarios.get(p.createdBy);
                    return nombreCreador === operadorSeleccionado;
                  }).filter(p => {
                    const fechaCreacion = new Date(p.fechaAsignacion);
                    fechaCreacion.setHours(0, 0, 0, 0);
                    const fechaInicio = new Date(filtrosModal.fechaInicio);
                    fechaInicio.setHours(0, 0, 0, 0);
                    const fechaFin = new Date(filtrosModal.fechaFin);
                    fechaFin.setHours(23, 59, 59, 999);
                    return fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin;
                  }).length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <ClipboardDocumentListIcon className="h-5 w-5 mr-2 text-indigo-500" />
                        Pedidos Creados ({pedidos.filter(p => {
                          const nombreCreador = nombresUsuarios.get(p.createdBy);
                          return nombreCreador === operadorSeleccionado;
                        }).filter(p => {
                          const fechaCreacion = new Date(p.fechaAsignacion);
                          fechaCreacion.setHours(0, 0, 0, 0);
                          const fechaInicio = new Date(filtrosModal.fechaInicio);
                          fechaInicio.setHours(0, 0, 0, 0);
                          const fechaFin = new Date(filtrosModal.fechaFin);
                          fechaFin.setHours(23, 59, 59, 999);
                          return fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin;
                        }).length})
                      </h4>
                      <div className="space-y-2">
                        {pedidos
                          .filter(p => {
                            const nombreCreador = nombresUsuarios.get(p.createdBy);
                            return nombreCreador === operadorSeleccionado;
                          })
                          .filter(p => {
                            const fechaCreacion = new Date(p.fechaAsignacion);
                            fechaCreacion.setHours(0, 0, 0, 0);
                            const fechaInicio = new Date(filtrosModal.fechaInicio);
                            fechaInicio.setHours(0, 0, 0, 0);
                            const fechaFin = new Date(filtrosModal.fechaFin);
                            fechaFin.setHours(23, 59, 59, 999);
                            return fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin;
                          })
                          .map(pedido => (
                            <div key={pedido.id} className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-900">{pedido.cliente.name}</div>
                                  <div className="text-sm text-gray-600">{pedido.plan.name} - {formatCurrency(pedido.total)}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatDate(pedido.fechaAsignacion, 'dd/MM/yyyy HH:mm')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                    Creado
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Pedidos Entregados */}
                  {datosFiltrados.pedidos.filter(p => p.entregadoPor === operadorSeleccionado && p.fechaEntrega).length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <TruckIcon className="h-5 w-5 mr-2 text-blue-500" />
                        Pedidos Entregados ({datosFiltrados.pedidos.filter(p => p.entregadoPor === operadorSeleccionado && p.fechaEntrega).length})
                      </h4>
                      <div className="space-y-2">
                        {datosFiltrados.pedidos
                          .filter(p => p.entregadoPor === operadorSeleccionado && p.fechaEntrega)
                          .map(pedido => (
                            <div key={pedido.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-900">{pedido.cliente.name}</div>
                                  <div className="text-sm text-gray-600">{pedido.plan.name} - {formatCurrency(pedido.total)}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatDate(pedido.fechaEntrega!, 'dd/MM/yyyy HH:mm')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                    Entregado
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Pedidos Recogidos */}
                  {datosFiltrados.pedidos.filter(p => p.recogidoPor === operadorSeleccionado && p.fechaRecogida).length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <HomeIcon className="h-5 w-5 mr-2 text-green-500" />
                        Pedidos Recogidos ({datosFiltrados.pedidos.filter(p => p.recogidoPor === operadorSeleccionado && p.fechaRecogida).length})
                      </h4>
                      <div className="space-y-2">
                        {datosFiltrados.pedidos
                          .filter(p => p.recogidoPor === operadorSeleccionado && p.fechaRecogida)
                          .map(pedido => (
                            <div key={pedido.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-900">{pedido.cliente.name}</div>
                                  <div className="text-sm text-gray-600">{pedido.plan.name} - {formatCurrency(pedido.total)}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatDate(pedido.fechaRecogida!, 'dd/MM/yyyy HH:mm')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                    Recogido
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Modificaciones */}
                  {datosFiltrados.modificaciones.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <WrenchScrewdriverIcon className="h-5 w-5 mr-2 text-purple-500" />
                        Modificaciones ({datosFiltrados.modificaciones.length})
                      </h4>
                      <div className="space-y-2">
                        {datosFiltrados.modificaciones.map((item, idx) => (
                          <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">{item.pedido.cliente.name}</div>
                                <div className="text-sm text-gray-600">
                                  {item.modificacion.horasExtras.length > 0 && `Horas extras: ${item.modificacion.totalHorasExtras} - `}
                                  {item.modificacion.cobrosAdicionales.length > 0 && `Cobros: ${item.modificacion.totalCobrosAdicionales} - `}
                                  {item.modificacion.descuentos.length > 0 && `Descuentos: ${item.modificacion.totalDescuentos} - `}
                                  Total: {formatCurrency(item.modificacion.totalModificaciones)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDate(item.modificacion.fecha, 'dd/MM/yyyy HH:mm')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pagos */}
                  {(datosFiltrados.pagos as any)?.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-500" />
                        Pagos Recibidos ({(datosFiltrados.pagos as any).length})
                      </h4>
                      <div className="space-y-2">
                        {(datosFiltrados.pagos as any).map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">{item.pedido.cliente.name}</div>
                                <div className="text-sm text-gray-600">
                                  {formatCurrency(item.pago.monto)} - {item.pago.medioPago}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDate(item.pago.fecha, 'dd/MM/yyyy HH:mm')}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  {item.pago.medioPago === 'efectivo' ? '💰' : item.pago.medioPago === 'nequi' ? '📱' : '💳'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gastos */}
                  {datosFiltrados.gastos.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <MinusCircleIcon className="h-5 w-5 mr-2 text-red-500" />
                        Gastos Registrados ({datosFiltrados.gastos.length})
                      </h4>
                      <div className="space-y-2">
                        {datosFiltrados.gastos.map(gasto => (
                          <div key={gasto.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {typeof gasto.concepto === 'object' ? gasto.concepto.name : gasto.concepto}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatCurrency(gasto.amount)} - {gasto.medioPago}
                                </div>
                                {gasto.description && (
                                  <div className="text-xs text-gray-500 mt-1">{gasto.description}</div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDate(gasto.date, 'dd/MM/yyyy HH:mm')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mantenimientos */}
                  {datosFiltrados.mantenimientos.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                        <WrenchScrewdriverIcon className="h-5 w-5 mr-2 text-orange-500" />
                        Mantenimientos Registrados ({datosFiltrados.mantenimientos.length})
                      </h4>
                      <div className="space-y-2">
                        {datosFiltrados.mantenimientos.map(mant => (
                          <div key={mant.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">Mantenimiento - {mant.tipoFalla}</div>
                                <div className="text-sm text-gray-600">
                                  {formatCurrency(mant.costoReparacion)} - {mant.medioPago}
                                </div>
                                {mant.descripcion && (
                                  <div className="text-xs text-gray-500 mt-1">{mant.descripcion}</div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDate(mant.fechaInicio, 'dd/MM/yyyy HH:mm')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pedidos.filter(p => {
                    const nombreCreador = nombresUsuarios.get(p.createdBy);
                    return nombreCreador === operadorSeleccionado;
                  }).filter(p => {
                    const fechaCreacion = new Date(p.fechaAsignacion);
                    fechaCreacion.setHours(0, 0, 0, 0);
                    const fechaInicio = new Date(filtrosModal.fechaInicio);
                    fechaInicio.setHours(0, 0, 0, 0);
                    const fechaFin = new Date(filtrosModal.fechaFin);
                    fechaFin.setHours(23, 59, 59, 999);
                    return fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin;
                  }).length === 0 &&
                   datosFiltrados.pedidos.filter(p => p.entregadoPor === operadorSeleccionado && p.fechaEntrega).length === 0 &&
                   datosFiltrados.pedidos.filter(p => p.recogidoPor === operadorSeleccionado && p.fechaRecogida).length === 0 &&
                   datosFiltrados.gastos.length === 0 && 
                   datosFiltrados.mantenimientos.length === 0 &&
                   datosFiltrados.modificaciones.length === 0 &&
                   !(datosFiltrados.pagos as any)?.length && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No hay actividades registradas para este operador en el período seleccionado</p>
                    </div>
                  )}
                </div>
              )}

              {tipoAccionSeleccionado === 'entregados' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pedidos Entregados</h3>
                  {datosFiltrados.pedidos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay pedidos entregados en el período seleccionado</p>
                  ) : (
                    <div className="space-y-2">
                      {datosFiltrados.pedidos.map(pedido => (
                        <div key={pedido.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-lg text-gray-900 mb-1">{pedido.cliente.name}</div>
                              <div className="text-sm text-gray-600 mb-2">
                                {pedido.cliente.phone}
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{pedido.plan.name}</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(pedido.total)}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                Entregado el {formatDate(pedido.fechaEntrega!, 'dd/MM/yyyy HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tipoAccionSeleccionado === 'recogidos' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pedidos Recogidos</h3>
                  {datosFiltrados.pedidos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay pedidos recogidos en el período seleccionado</p>
                  ) : (
                    <div className="space-y-2">
                      {datosFiltrados.pedidos.map(pedido => (
                        <div key={pedido.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-lg text-gray-900 mb-1">{pedido.cliente.name}</div>
                              <div className="text-sm text-gray-600 mb-2">
                                {pedido.cliente.phone}
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">{pedido.plan.name}</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(pedido.total)}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                Recogido el {formatDate(pedido.fechaRecogida!, 'dd/MM/yyyy HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tipoAccionSeleccionado === 'modificaciones' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Modificaciones Realizadas</h3>
                  {datosFiltrados.modificaciones.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay modificaciones en el período seleccionado</p>
                  ) : (
                    <div className="space-y-3">
                      {datosFiltrados.modificaciones.map((item, idx) => (
                        <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-medium text-lg text-gray-900">{item.pedido.cliente.name}</div>
                              <div className="text-sm text-gray-600">{formatDate(item.modificacion.fecha, 'dd/MM/yyyy HH:mm')}</div>
                            </div>
                            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                              Modificación
                            </span>
                          </div>
                          
                          {item.modificacion.horasExtras.length > 0 && (
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700 mb-1">Horas Extras:</div>
                              <div className="pl-4 space-y-1">
                                {item.modificacion.horasExtras.map((he, i) => (
                                  <div key={i} className="text-sm text-gray-600">
                                    {he.concepto} - {formatCurrency(he.total)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {item.modificacion.cobrosAdicionales.length > 0 && (
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700 mb-1">Cobros Adicionales:</div>
                              <div className="pl-4 space-y-1">
                                {item.modificacion.cobrosAdicionales.map((ca, i) => (
                                  <div key={i} className="text-sm text-gray-600">
                                    {ca.concepto} - {formatCurrency(ca.monto)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {item.modificacion.descuentos.length > 0 && (
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700 mb-1">Descuentos:</div>
                              <div className="pl-4 space-y-1">
                                {item.modificacion.descuentos.map((d, i) => (
                                  <div key={i} className="text-sm text-gray-600">
                                    {d.concepto} - {formatCurrency(d.monto)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {item.modificacion.cambioPlan && (
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700 mb-1">Cambio de Plan:</div>
                              <div className="pl-4 text-sm text-gray-600">
                                {item.modificacion.cambioPlan.planAnterior} → {item.modificacion.cambioPlan.planNuevo}
                                {item.modificacion.cambioPlan.diferencia !== 0 && (
                                  <span className={item.modificacion.cambioPlan.diferencia > 0 ? 'text-green-600' : 'text-red-600'}>
                                    {' '}({item.modificacion.cambioPlan.diferencia > 0 ? '+' : ''}{formatCurrency(item.modificacion.cambioPlan.diferencia)})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-900">Total Modificaciones:</span>
                              <span className="text-lg font-bold text-purple-600">
                                {formatCurrency(item.modificacion.totalModificaciones)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tipoAccionSeleccionado === 'pagos' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pagos Recibidos</h3>
                  {!(datosFiltrados.pagos as any)?.length ? (
                    <p className="text-gray-500 text-center py-8">No hay pagos en el período seleccionado</p>
                  ) : (
                    <div className="space-y-2">
                      {(datosFiltrados.pagos as any).map((item: any, idx: number) => (
                        <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-lg text-gray-900 mb-1">{item.pedido.cliente.name}</div>
                              <div className="text-sm text-gray-600 mb-2">
                                {item.pedido.cliente.phone}
                              </div>
                              <div className="flex items-center gap-4 text-sm mb-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{item.pedido.plan.name}</span>
                                <span className="font-semibold text-green-600">{formatCurrency(item.pago.monto)}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  item.pago.medioPago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                  item.pago.medioPago === 'nequi' ? 'bg-purple-100 text-purple-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {item.pago.medioPago === 'efectivo' ? '💰 Efectivo' :
                                   item.pago.medioPago === 'nequi' ? '📱 Nequi' :
                                   '💳 Daviplata'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Recibido el {formatDate(item.pago.fecha, 'dd/MM/yyyy HH:mm')}
                                {item.pago.referencia && ` • Ref: ${item.pago.referencia}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tipoAccionSeleccionado === 'gastos' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Gastos Registrados</h3>
                  {datosFiltrados.gastos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay gastos en el período seleccionado</p>
                  ) : (
                    <div className="space-y-2">
                      {datosFiltrados.gastos.map(gasto => (
                        <div key={gasto.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-lg text-gray-900 mb-1">
                                {typeof gasto.concepto === 'object' ? gasto.concepto.name : gasto.concepto}
                              </div>
                              {gasto.description && (
                                <div className="text-sm text-gray-600 mb-2">{gasto.description}</div>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <span className="font-semibold text-red-600">{formatCurrency(gasto.amount)}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  gasto.medioPago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                  gasto.medioPago === 'nequi' ? 'bg-purple-100 text-purple-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {gasto.medioPago === 'efectivo' ? '💰 Efectivo' :
                                   gasto.medioPago === 'nequi' ? '📱 Nequi' :
                                   '💳 Daviplata'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                Registrado el {formatDate(gasto.date, 'dd/MM/yyyy HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tipoAccionSeleccionado === 'mantenimientos' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Mantenimientos Registrados</h3>
                  {datosFiltrados.mantenimientos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay mantenimientos en el período seleccionado</p>
                  ) : (
                    <div className="space-y-2">
                      {datosFiltrados.mantenimientos.map(mant => (
                        <div key={mant.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-lg text-gray-900 mb-1">Mantenimiento - {mant.tipoFalla}</div>
                              {mant.descripcion && (
                                <div className="text-sm text-gray-600 mb-2">{mant.descripcion}</div>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <span className="font-semibold text-orange-600">{formatCurrency(mant.costoReparacion)}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  mant.medioPago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                  mant.medioPago === 'nequi' ? 'bg-purple-100 text-purple-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {mant.medioPago === 'efectivo' ? '💰 Efectivo' :
                                   mant.medioPago === 'nequi' ? '📱 Nequi' :
                                   '💳 Daviplata'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                Registrado el {formatDate(mant.fechaInicio, 'dd/MM/yyyy HH:mm')}
                                {mant.fechaFin && ` • Finalizado el ${formatDate(mant.fechaFin, 'dd/MM/yyyy HH:mm')}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operadores;

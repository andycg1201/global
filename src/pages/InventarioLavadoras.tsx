import React, { useState, useEffect } from 'react';
import { 
  CubeIcon,
  PlusIcon,
  QrCodeIcon,
  CameraIcon,
  MapPinIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchScrewdriverIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { lavadoraService } from '../services/firebaseService';
import { deleteField } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Lavadora, Mantenimiento } from '../types';
import { formatDate } from '../utils/dateUtils';
import QRGenerator from '../components/QRGenerator';
import { exportAllLavadorasToWord } from '../utils/exportToWord';
import { ModalMantenimiento } from '../components/ModalMantenimiento';
import { ModalHistorialMantenimiento } from '../components/ModalHistorialMantenimiento';
import { obtenerHistorialMantenimiento, obtenerMantenimientoPorId } from '../services/mantenimientoService';

const InventarioLavadoras: React.FC = () => {
  const { user } = useAuth();
  const [lavadoras, setLavadoras] = useState<Lavadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarQRGenerator, setMostrarQRGenerator] = useState(false);
  const [qrParaGenerar, setQrParaGenerar] = useState<{codigo: string, info?: any} | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  
  // Estados para mantenimiento
  const [mostrarModalMantenimiento, setMostrarModalMantenimiento] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [refreshHistorialTrigger, setRefreshHistorialTrigger] = useState(0);
  const [lavadoraSeleccionada, setLavadoraSeleccionada] = useState<Lavadora | null>(null);
  const [modoMantenimiento, setModoMantenimiento] = useState<'crear' | 'finalizar'>('crear');
  const [mantenimientoActual, setMantenimientoActual] = useState<Mantenimiento | undefined>();
  const [historialMantenimiento, setHistorialMantenimiento] = useState<Mantenimiento[]>([]);
  const [nuevaLavadora, setNuevaLavadora] = useState({
    marca: 'LG',
    modelo: '18kg',
    numeroSerie: '',
    estado: 'disponible' as const,
    ubicacion: 'bodega' as const
  });
  
  // Estados para análisis de rentabilidad
  const [mostrarAnalisisRentabilidad, setMostrarAnalisisRentabilidad] = useState(false);
  const [periodoAnalisis, setPeriodoAnalisis] = useState<'mensual' | 'trimestral' | 'anual'>('mensual');
  const [datosRentabilidad, setDatosRentabilidad] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);

  useEffect(() => {
    cargarLavadoras();
    cargarDatosRentabilidad();
  }, []);

  useEffect(() => {
    if (mostrarAnalisisRentabilidad) {
      calcularRentabilidad();
    }
  }, [mostrarAnalisisRentabilidad, periodoAnalisis, pedidos, mantenimientos, lavadoras]);

  const cargarLavadoras = async () => {
    try {
      setLoading(true);
      const lavadorasData = await lavadoraService.getAllLavadoras();
      setLavadoras(lavadorasData);
    } catch (error) {
      console.error('Error al cargar lavadoras:', error);
      alert('Error al cargar las lavadoras');
    } finally {
      setLoading(false);
    }
  };

  const cargarDatosRentabilidad = async () => {
    try {
      const [pedidosData, mantenimientosData] = await Promise.all([
        import('../services/firebaseService').then(service => service.pedidoService.getAllPedidos()),
        import('../services/mantenimientoService').then(async service => {
          // Obtener todos los mantenimientos directamente desde Firebase
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          
          try {
            const querySnapshot = await getDocs(collection(db, 'mantenimientos'));
            const mantenimientos: any[] = [];
            
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              mantenimientos.push({
                id: doc.id,
                lavadoraId: data.lavadoraId,
                tipoFalla: data.tipoFalla,
                descripcion: data.descripcion,
                costoReparacion: data.costoReparacion,
                servicioTecnico: data.servicioTecnico,
                fechaInicio: data.fechaInicio?.toDate() || new Date(),
                fechaEstimadaFin: data.fechaEstimadaFin?.toDate() || new Date(),
                fechaFin: data.fechaFin?.toDate() || null,
                estado: data.estado,
                observaciones: data.observaciones,
                createdBy: data.createdBy,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date()
              });
            });
            
            return mantenimientos;
          } catch (error) {
            console.error('Error obteniendo mantenimientos:', error);
            return [];
          }
        })
      ]);
      setPedidos(pedidosData);
      setMantenimientos(mantenimientosData);
    } catch (error) {
      console.error('Error al cargar datos para rentabilidad:', error);
    }
  };

  const calcularRentabilidad = () => {
    const datos = lavadoras.map(lavadora => {
      // Calcular ingresos (pedidos completados con esta lavadora)
      const pedidosCompletados = pedidos.filter(pedido => 
        pedido.status === 'recogido' && 
        pedido.lavadoraAsignada?.lavadoraId === lavadora.id
      );
      
      const ingresos = pedidosCompletados.reduce((sum, pedido) => sum + (pedido.total || 0), 0);
      
      // Calcular gastos (mantenimientos de esta lavadora)
      const mantenimientosLavadora = mantenimientos.filter(mant => 
        mant.lavadoraId === lavadora.id && (mant as any).estado === 'completado'
      );
      
      const gastos = mantenimientosLavadora.reduce((sum, mant) => sum + (mant.costoReparacion || 0), 0);
      
      // Calcular métricas
      const rentabilidad = ingresos - gastos;
      const roi = gastos > 0 ? ((rentabilidad / gastos) * 100) : 0;
      const frecuenciaDanos = mantenimientosLavadora.length;
      
      return {
        lavadora,
        ingresos,
        gastos,
        rentabilidad,
        roi,
        frecuenciaDanos,
        pedidosAtendidos: pedidosCompletados.length
      };
    });

    // Ordenar por rentabilidad descendente
    datos.sort((a, b) => b.rentabilidad - a.rentabilidad);
    setDatosRentabilidad(datos);
  };

  const handleCrearLavadorasIniciales = async () => {
    if (confirm('¿Crear las 15 lavadoras iniciales (G-01 a G-15)? Esto solo se puede hacer una vez.')) {
      try {
        setLoading(true);
        await lavadoraService.createInitialLavadoras(user?.id || '');
        cargarLavadoras();
        alert('15 lavadoras iniciales creadas exitosamente');
      } catch (error) {
        console.error('Error al crear lavadoras iniciales:', error);
        alert('Error al crear las lavadoras iniciales');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCrearLavadora = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await lavadoraService.createLavadora({
        ...nuevaLavadora,
        createdBy: user?.id || ''
      });
      
      setNuevaLavadora({
        marca: 'LG',
        modelo: '18kg',
        numeroSerie: '',
        estado: 'disponible',
        ubicacion: 'bodega'
      });
      setMostrarFormulario(false);
      cargarLavadoras();
      alert('Lavadora registrada exitosamente');
    } catch (error) {
      console.error('Error al crear lavadora:', error);
      alert('Error al registrar la lavadora');
    }
  };


  const handleGenerarQR = (lavadora: Lavadora) => {
    setQrParaGenerar({
      codigo: lavadora.codigoQR,
      info: {
        marca: lavadora.marca,
        modelo: lavadora.modelo,
        numeroSerie: lavadora.numeroSerie
      }
    });
    setMostrarQRGenerator(true);
  };

  const handleExportarTodos = async () => {
    if (lavadoras.length === 0) {
      alert('No hay lavadoras para exportar');
      return;
    }

    try {
      setLoading(true);
      await exportAllLavadorasToWord(lavadoras);
      alert('Documento Word generado exitosamente');
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al generar el documento Word');
    } finally {
      setLoading(false);
    }
  };

  // Funciones para mantenimiento
  const handleIniciarMantenimiento = async (lavadora: Lavadora) => {
    try {
      // Para crear un nuevo mantenimiento, no necesitamos cargar el historial
      setLavadoraSeleccionada(lavadora);
      setMantenimientoActual(undefined);
      setModoMantenimiento('crear');
      setMostrarModalMantenimiento(true);
    } catch (error) {
      console.error('Error al iniciar mantenimiento:', error);
      alert('Error al iniciar el mantenimiento');
    }
  };

  const handleFinalizarMantenimiento = async (lavadora: Lavadora) => {
    try {
      // Verificar que la lavadora tenga información de mantenimiento actual
      if (!lavadora.mantenimientoActual || !lavadora.mantenimientoActual.mantenimientoId) {
        alert('No hay mantenimiento activo para esta lavadora');
        return;
      }

      // Cargar la información completa del mantenimiento desde Firebase usando el ID específico
      const mantenimientoActivo = await obtenerMantenimientoPorId(lavadora.mantenimientoActual.mantenimientoId);
      
      if (!mantenimientoActivo) {
        // Si no se encuentra el mantenimiento (por ejemplo, después de Reset Todo),
        // simplemente marcar la lavadora como disponible sin abrir el modal
        console.log('Mantenimiento no encontrado, marcando lavadora como disponible directamente');
        await lavadoraService.updateLavadora(lavadora.id, {
          estado: 'disponible',
          mantenimientoActual: deleteField() as any
        });
        cargarLavadoras();
        alert('Lavadora marcada como disponible (mantenimiento no encontrado)');
        return;
      }
      
      setLavadoraSeleccionada(lavadora);
      setMantenimientoActual(mantenimientoActivo);
      setModoMantenimiento('finalizar');
      setMostrarModalMantenimiento(true);
    } catch (error) {
      console.error('Error al finalizar mantenimiento:', error);
      alert('Error al finalizar el mantenimiento. Intenta nuevamente.');
    }
  };

  const handleMantenimientoSuccess = () => {
    cargarLavadoras(); // Recargar lavadoras para actualizar estados
    // Forzar actualización del historial si está abierto
    if (mostrarModalHistorial) {
      setRefreshHistorialTrigger(prev => prev + 1);
    }
  };

  const handleMarcarFueraServicio = async (lavadora: Lavadora) => {
    if (!confirm(`¿Estás seguro de que quieres marcar la lavadora ${lavadora.codigoQR} como fuera de servicio?`)) {
      return;
    }

    try {
      setLoading(true);
      await lavadoraService.updateLavadora(lavadora.id, {
        estado: 'fuera_servicio'
      });
      cargarLavadoras();
      alert('Lavadora marcada como fuera de servicio');
    } catch (error) {
      console.error('Error al marcar lavadora como fuera de servicio:', error);
      alert('Error al actualizar el estado de la lavadora');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarDisponible = async (lavadora: Lavadora) => {
    if (!confirm(`¿Estás seguro de que quieres marcar la lavadora ${lavadora.codigoQR} como disponible?`)) {
      return;
    }

    try {
      setLoading(true);
      await lavadoraService.updateLavadora(lavadora.id, {
        estado: 'disponible'
      });
      cargarLavadoras();
      alert('Lavadora marcada como disponible');
    } catch (error) {
      console.error('Error al marcar lavadora como disponible:', error);
      alert('Error al actualizar el estado de la lavadora');
    } finally {
      setLoading(false);
    }
  };

  const handleVerHistorial = (lavadora: Lavadora) => {
    setLavadoraSeleccionada(lavadora);
    setMostrarModalHistorial(true);
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'alquilada':
        return <UserIcon className="h-5 w-5 text-blue-500" />;
      case 'mantenimiento':
        return <WrenchScrewdriverIcon className="h-5 w-5 text-yellow-500" />;
      case 'retirada':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'fuera_servicio':
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-100 text-green-800';
      case 'alquilada':
        return 'bg-blue-100 text-blue-800';
      case 'mantenimiento':
        return 'bg-yellow-100 text-yellow-800';
      case 'retirada':
        return 'bg-red-100 text-red-800';
      case 'fuera_servicio':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUbicacionIcon = (ubicacion: string) => {
    switch (ubicacion) {
      case 'bodega':
        return <MapPinIcon className="h-4 w-4" />;
      case 'cliente':
        return <UserIcon className="h-4 w-4" />;
      case 'taller':
        return <WrenchScrewdriverIcon className="h-4 w-4" />;
      default:
        return <MapPinIcon className="h-4 w-4" />;
    }
  };

  const lavadorasFiltradas = lavadoras
    .filter(lavadora => filtroEstado === 'todos' || lavadora.estado === filtroEstado)
    .sort((a, b) => {
      // Extraer el número del código QR (G-01, G-02, etc.)
      const numeroA = parseInt(a.codigoQR.replace('G-', ''));
      const numeroB = parseInt(b.codigoQR.replace('G-', ''));
      return numeroA - numeroB;
    });

  const estadisticas = {
    total: lavadoras.length,
    disponibles: lavadoras.filter(l => l.estado === 'disponible').length,
    alquiladas: lavadoras.filter(l => l.estado === 'alquilada').length,
    mantenimiento: lavadoras.filter(l => l.estado === 'mantenimiento').length,
    retiradas: lavadoras.filter(l => l.estado === 'retirada').length,
    fuera_servicio: lavadoras.filter(l => l.estado === 'fuera_servicio').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario de Lavadoras</h1>
          <p className="text-gray-600">Gestiona el estado de las 15 lavadoras LG</p>
        </div>
        <div className="flex space-x-3">
          {lavadoras.length === 0 && (
            <button
              onClick={handleCrearLavadorasIniciales}
              className="btn-secondary flex items-center space-x-2"
            >
              <CubeIcon className="h-5 w-5" />
              <span>Crear 15 Lavadoras</span>
            </button>
          )}
          {lavadoras.length > 0 && (
            <button
              onClick={handleExportarTodos}
              disabled={loading}
              className="btn-secondary flex items-center space-x-2"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span>Exportar Todos los Códigos</span>
            </button>
          )}
          {lavadoras.length > 0 && (
            <button
              onClick={() => setMostrarAnalisisRentabilidad(!mostrarAnalisisRentabilidad)}
              className={`flex items-center space-x-2 ${
                mostrarAnalisisRentabilidad 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } px-4 py-2 rounded-lg font-medium transition-colors`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>{mostrarAnalisisRentabilidad ? 'Ocultar Análisis' : 'Análisis de Rentabilidad'}</span>
            </button>
          )}
          <button
            onClick={() => setMostrarFormulario(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Registrar Lavadora</span>
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center">
            <CubeIcon className="h-8 w-8 text-gray-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{estadisticas.total}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Disponibles</p>
              <p className="text-2xl font-bold text-green-600">{estadisticas.disponibles}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <UserIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Alquiladas</p>
              <p className="text-2xl font-bold text-blue-600">{estadisticas.alquiladas}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <WrenchScrewdriverIcon className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Mantenimiento</p>
              <p className="text-2xl font-bold text-yellow-600">{estadisticas.mantenimiento}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <XCircleIcon className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Retiradas</p>
              <p className="text-2xl font-bold text-red-600">{estadisticas.retiradas}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-gray-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Fuera de Servicio</p>
              <p className="text-2xl font-bold text-gray-600">{estadisticas.fuera_servicio}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Filtrar por Estado</h3>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="input-field max-w-xs"
          >
            <option value="todos">Todos los estados</option>
            <option value="disponible">Disponibles</option>
            <option value="alquilada">Alquiladas</option>
            <option value="mantenimiento">En Mantenimiento</option>
            <option value="retirada">Retiradas</option>
            <option value="fuera_servicio">Fuera de Servicio</option>
          </select>
        </div>
      </div>

      {/* Análisis de Rentabilidad */}
      {mostrarAnalisisRentabilidad && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Análisis de Rentabilidad</h3>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Período:</label>
              <select
                value={periodoAnalisis}
                onChange={(e) => setPeriodoAnalisis(e.target.value as 'mensual' | 'trimestral' | 'anual')}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          {/* Gráfico de Rentabilidad */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-4">Ingresos vs Gastos por Lavadora</h4>
            <div className="space-y-3">
              {datosRentabilidad.slice(0, 10).map((dato, index) => {
                const maxValor = Math.max(...datosRentabilidad.map(d => Math.max(d.ingresos, d.gastos)));
                const ingresosWidth = (dato.ingresos / maxValor) * 100;
                const gastosWidth = (dato.gastos / maxValor) * 100;
                
                return (
                  <div key={dato.lavadora.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {dato.lavadora.codigoQR} - {dato.lavadora.marca} {dato.lavadora.modelo}
                      </span>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>Rentabilidad: <span className={`font-medium ${dato.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${dato.rentabilidad.toLocaleString()}
                        </span></span>
                        <span>ROI: <span className={`font-medium ${dato.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dato.roi.toFixed(1)}%
                        </span></span>
                      </div>
                    </div>
                    
                    {/* Barra de Ingresos */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-600 font-medium">Ingresos</span>
                        <span className="text-green-600 font-medium">${dato.ingresos.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${ingresosWidth}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Barra de Gastos */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-red-600 font-medium">Gastos</span>
                        <span className="text-red-600 font-medium">${dato.gastos.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${gastosWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 5 Más Rentables */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">🥇 Top 5 Más Rentables</h4>
              <div className="space-y-2">
                {datosRentabilidad.slice(0, 5).map((dato, index) => (
                  <div key={dato.lavadora.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">#{index + 1}</span>
                      <span className="text-sm font-medium">{dato.lavadora.codigoQR}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                      ${dato.rentabilidad.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 Más Problemáticas */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">⚠️ Top 5 Más Problemáticas</h4>
              <div className="space-y-2">
                {datosRentabilidad
                  .sort((a, b) => b.frecuenciaDanos - a.frecuenciaDanos)
                  .slice(0, 5)
                  .map((dato, index) => (
                  <div key={dato.lavadora.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">#{index + 1}</span>
                      <span className="text-sm font-medium">{dato.lavadora.codigoQR}</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      {dato.frecuenciaDanos} daños
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen General */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-md font-medium text-gray-800 mb-3">📊 Resumen General</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${datosRentabilidad.reduce((sum, d) => sum + d.ingresos, 0).toLocaleString()}
                </div>
                <div className="text-gray-600">Total Ingresos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  ${datosRentabilidad.reduce((sum, d) => sum + d.gastos, 0).toLocaleString()}
                </div>
                <div className="text-gray-600">Total Gastos</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${datosRentabilidad.reduce((sum, d) => sum + d.rentabilidad, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${datosRentabilidad.reduce((sum, d) => sum + d.rentabilidad, 0).toLocaleString()}
                </div>
                <div className="text-gray-600">Rentabilidad Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {datosRentabilidad.reduce((sum, d) => sum + d.pedidosAtendidos, 0)}
                </div>
                <div className="text-gray-600">Pedidos Atendidos</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Lavadoras */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Lavadoras ({lavadorasFiltradas.length})
        </h3>
        
        {lavadorasFiltradas.length === 0 ? (
          <div className="text-center py-8">
            <CubeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay lavadoras registradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lavadorasFiltradas.map((lavadora) => (
              <div key={lavadora.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getEstadoIcon(lavadora.estado)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(lavadora.estado)}`}>
                      {lavadora.estado}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-gray-500">
                      {getUbicacionIcon(lavadora.ubicacion)}
                      <span className="text-xs">{lavadora.ubicacion}</span>
                    </div>
                    <button
                      onClick={() => handleGenerarQR(lavadora)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Generar QR"
                    >
                      <QrCodeIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-lg font-bold text-gray-900 mb-1">
                      {lavadora.codigoQR}
                    </p>
                    <p className="text-xs text-gray-500">Serie: {lavadora.numeroSerie}</p>
                    <p className="text-sm text-gray-700">
                      {lavadora.marca} {lavadora.modelo}
                    </p>
                  </div>
                  
                  {lavadora.clienteId && (
                    <div className="flex items-center space-x-2">
                      <UserIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-blue-600">Cliente: {lavadora.clienteId}</span>
                    </div>
                  )}
                  
                  {lavadora.fechaInstalacion && (
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-600">
                        Instalada: {formatDate(lavadora.fechaInstalacion, 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}

                  {/* Información de mantenimiento */}
                  {lavadora.estado === 'mantenimiento' && lavadora.mantenimientoActual && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <WrenchScrewdriverIcon className="h-4 w-4 text-yellow-600" />
                        <span className="text-xs font-medium text-yellow-800">En Mantenimiento</span>
                      </div>
                      <p className="text-xs text-yellow-700">
                        {lavadora.mantenimientoActual.tipoFalla} - {lavadora.mantenimientoActual.servicioTecnico}
                      </p>
                      <p className="text-xs text-yellow-600">
                        Estimado: {formatDate(lavadora.mantenimientoActual.fechaEstimadaFin, 'dd/MM/yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleVerHistorial(lavadora)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-1"
                    title="Ver historial de mantenimiento"
                  >
                    <DocumentTextIcon className="h-3 w-3" />
                    <span>Historial</span>
                  </button>

                  <div className="flex space-x-2">
                    {lavadora.estado === 'disponible' && (
                      <>
                        <button
                          onClick={() => handleIniciarMantenimiento(lavadora)}
                          className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors flex items-center space-x-1"
                          title="Enviar a mantenimiento"
                        >
                          <WrenchScrewdriverIcon className="h-3 w-3" />
                          <span>Mantenimiento</span>
                        </button>
                        <button
                          onClick={() => handleMarcarFueraServicio(lavadora)}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center space-x-1"
                          title="Marcar como fuera de servicio"
                        >
                          <ExclamationTriangleIcon className="h-3 w-3" />
                          <span>Fuera Servicio</span>
                        </button>
                      </>
                    )}
                    
                    {lavadora.estado === 'mantenimiento' && (
                      <button
                        onClick={() => handleFinalizarMantenimiento(lavadora)}
                        className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors flex items-center space-x-1"
                        title="Marcar como disponible"
                      >
                        <CheckCircleIcon className="h-3 w-3" />
                        <span>Disponible</span>
                      </button>
                    )}

                    {lavadora.estado === 'fuera_servicio' && (
                      <button
                        onClick={() => handleMarcarDisponible(lavadora)}
                        className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors flex items-center space-x-1"
                        title="Marcar como disponible"
                      >
                        <CheckCircleIcon className="h-3 w-3" />
                        <span>Disponible</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para registrar nueva lavadora */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Registrar Nueva Lavadora</h3>
              <button
                onClick={() => setMostrarFormulario(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCrearLavadora} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> El código QR se generará automáticamente (G-01, G-02, etc.)
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={nuevaLavadora.marca}
                    onChange={(e) => setNuevaLavadora(prev => ({ ...prev, marca: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={nuevaLavadora.modelo}
                    onChange={(e) => setNuevaLavadora(prev => ({ ...prev, modelo: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Serie
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={nuevaLavadora.numeroSerie}
                  onChange={(e) => setNuevaLavadora(prev => ({ ...prev, numeroSerie: e.target.value }))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    className="input-field"
                    value={nuevaLavadora.estado}
                    onChange={(e) => setNuevaLavadora(prev => ({ ...prev, estado: e.target.value as any }))}
                  >
                    <option value="disponible">Disponible</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="retirada">Retirada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <select
                    className="input-field"
                    value={nuevaLavadora.ubicacion}
                    onChange={(e) => setNuevaLavadora(prev => ({ ...prev, ubicacion: e.target.value as any }))}
                  >
                    <option value="bodega">Bodega</option>
                    <option value="taller">Taller</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Registrar Lavadora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Generator */}
      {qrParaGenerar && (
        <QRGenerator
          isOpen={mostrarQRGenerator}
          onClose={() => {
            setMostrarQRGenerator(false);
            setQrParaGenerar(null);
          }}
          codigoQR={qrParaGenerar.codigo}
          lavadoraInfo={qrParaGenerar.info}
        />
      )}

      {/* Modal de Mantenimiento */}
      <ModalMantenimiento
        isOpen={mostrarModalMantenimiento}
        onClose={() => {
          setMostrarModalMantenimiento(false);
          setLavadoraSeleccionada(null);
          setMantenimientoActual(undefined);
        }}
        lavadora={lavadoraSeleccionada}
        onSuccess={handleMantenimientoSuccess}
        modo={modoMantenimiento}
        mantenimiento={mantenimientoActual}
      />

      {/* Modal de Historial */}
      <ModalHistorialMantenimiento
        isOpen={mostrarModalHistorial}
        onClose={() => {
          setMostrarModalHistorial(false);
          setLavadoraSeleccionada(null);
        }}
        lavadora={lavadoraSeleccionada}
        refreshTrigger={refreshHistorialTrigger}
      />
    </div>
  );
};

export default InventarioLavadoras;

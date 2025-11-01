import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon, 
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { gastoService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Gasto, ConceptoGasto } from '../types';
import { formatDate, formatCurrency, getCurrentDateColombia } from '../utils/dateUtils';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calcularSaldosActuales, validarSaldoSuficiente, obtenerMediosDisponibles, SaldoPorMedio } from '../utils/saldoUtils';

interface FiltrosGastos {
  fechaInicio: Date;
  fechaFin: Date;
  conceptoId: string;
  tipoFiltro: 'hoy' | 'ayer' | 'personalizado';
}

const Gastos: React.FC = () => {
  const { user, esOperador, tienePermiso } = useAuth();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [gastosMantenimiento, setGastosMantenimiento] = useState<any[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoGasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevoGasto, setNuevoGasto] = useState({
    conceptoId: '',
    amount: '',
    description: '',
    date: new Date(), // Usar new Date() directamente para fecha actual
    medioPago: 'efectivo' as 'efectivo' | 'nequi' | 'daviplata'
  });

  
  const [filtros, setFiltros] = useState<FiltrosGastos>({
    fechaInicio: new Date(), // Fecha actual real
    fechaFin: new Date(), // Fecha actual real
    conceptoId: 'todos',
    tipoFiltro: 'hoy'
  });
  
  const [mostrarFormularioConcepto, setMostrarFormularioConcepto] = useState(false);
  const [mostrarGestionConceptos, setMostrarGestionConceptos] = useState(false);
  const [conceptoEditando, setConceptoEditando] = useState<ConceptoGasto | null>(null);
  const [nuevoConcepto, setNuevoConcepto] = useState({
    name: '',
    description: ''
  });

  // Estados para validación de saldos
  const [saldosActuales, setSaldosActuales] = useState<SaldoPorMedio>({
    efectivo: 0,
    nequi: 0,
    daviplata: 0
  });
  const [mediosDisponibles, setMediosDisponibles] = useState<Array<'efectivo' | 'nequi' | 'daviplata'>>(['efectivo', 'nequi', 'daviplata']);
  const [formularioListo, setFormularioListo] = useState(false);

  useEffect(() => {
    cargarDatos();
    cargarSaldos();
  }, [filtros]);

  // Asegurar que operadores no puedan usar filtro personalizado
  useEffect(() => {
    if (esOperador() && filtros.tipoFiltro === 'personalizado') {
      const hoy = getCurrentDateColombia();
      setFiltros(prev => ({
        ...prev,
        tipoFiltro: 'hoy',
        fechaInicio: hoy,
        fechaFin: hoy
      }));
    }
  }, [esOperador, filtros.tipoFiltro]);

  // Actualizar medios disponibles cuando se abra el formulario
  useEffect(() => {
    if (mostrarFormulario) {
      // Cuando se abre el formulario, mostrar medios según el rol del usuario
      if (esOperador()) {
        setMediosDisponibles(['efectivo']);
      } else {
        setMediosDisponibles(['efectivo', 'nequi', 'daviplata']);
      }
      
      // También llamar validarMontoYMedios para asegurar que se ejecute
      validarMontoYMedios('');
      
      // Marcar formulario como listo después de un pequeño delay
      setTimeout(() => {
        setFormularioListo(true);
      }, 100);
    } else {
      setFormularioListo(false);
    }
  }, [mostrarFormulario, saldosActuales, esOperador]);

  const cargarSaldos = async () => {
    try {
      const saldos = await calcularSaldosActuales();
      setSaldosActuales(saldos);
    } catch (error) {
      console.error('Error al cargar saldos:', error);
    }
  };

  const eliminarGasto = async (gasto: Gasto) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el gasto "${gasto.concepto.name}" por ${formatCurrency(gasto.amount)}?`)) {
      return;
    }

    try {
      await gastoService.deleteGasto(gasto.id);
      alert('Gasto eliminado exitosamente');
      cargarDatos();
      cargarSaldos(); // Recargar saldos después de eliminar
    } catch (error) {
      console.error('Error al eliminar gasto:', error);
      alert('Error al eliminar el gasto');
    }
  };

  const eliminarGastoMantenimiento = async (mantenimiento: any) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el gasto de mantenimiento "${mantenimiento.tipoFalla}" por ${formatCurrency(mantenimiento.costoReparacion || 0)}?`)) {
      return;
    }

    try {
      const { eliminarMantenimiento } = await import('../services/mantenimientoService');
      await eliminarMantenimiento(mantenimiento.id);
      alert('Gasto de mantenimiento eliminado exitosamente');
      cargarDatos();
      cargarSaldos(); // Recargar saldos después de eliminar
    } catch (error) {
      console.error('Error al eliminar gasto de mantenimiento:', error);
      alert('Error al eliminar el gasto de mantenimiento');
    }
  };

  const validarMontoYMedios = (monto: string) => {
    const montoNumerico = parseFloat(monto) || 0;
    
    if (montoNumerico > 0) {
      const mediosDisponiblesCalculados = obtenerMediosDisponibles(saldosActuales, montoNumerico);
      
      // Si es operador, solo permitir efectivo
      if (esOperador()) {
        setMediosDisponibles(mediosDisponiblesCalculados.filter(m => m === 'efectivo'));
        if (nuevoGasto.medioPago !== 'efectivo') {
          setNuevoGasto(prev => ({ ...prev, medioPago: 'efectivo' }));
        }
      } else {
        setMediosDisponibles(mediosDisponiblesCalculados);
        // Si el medio de pago actual no está disponible, cambiar a uno disponible
        if (mediosDisponiblesCalculados.length > 0 && !mediosDisponiblesCalculados.includes(nuevoGasto.medioPago)) {
          setNuevoGasto(prev => ({ ...prev, medioPago: mediosDisponiblesCalculados[0] }));
        }
      }
    } else {
      // Si no hay monto, todos los medios disponibles según el rol
      if (esOperador()) {
        setMediosDisponibles(['efectivo']);
      } else {
        setMediosDisponibles(['efectivo', 'nequi', 'daviplata']);
      }
    }
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Obtener gastos del rango de fechas
      const gastosData = await gastoService.getGastosDelRango(filtros.fechaInicio, filtros.fechaFin);
      const conceptosData = await gastoService.getConceptosActivos();
      
      // Obtener gastos de mantenimiento del rango de fechas
      const mantenimientosSnapshot = await getDocs(collection(db, 'mantenimientos'));
      const mantenimientosData = mantenimientosSnapshot.docs.map(doc => {
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
          registradoPor: data.registradoPor, // ✅ Nombre del usuario que registró el mantenimiento
          medioPago: data.medioPago, // Agregar medio de pago también
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      });
      
      // Si es operador, filtrar gastos y mantenimientos por su nombre
      let gastosFinales = gastosData;
      let mantenimientosFinales = mantenimientosData;
      
      if (esOperador() && user?.name) {
        gastosFinales = gastosData.filter(g => g.registradoPor === user.name);
        mantenimientosFinales = mantenimientosData.filter(m => m.registradoPor === user.name);
      }
      
      setGastos(gastosFinales);
      setGastosMantenimiento(mantenimientosFinales);
      setConceptos(conceptosData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const crearGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNumerico = parseFloat(nuevoGasto.amount) || 0;
    if (!nuevoGasto.conceptoId || amountNumerico <= 0) {
      alert('Concepto y monto son obligatorios');
      return;
    }

    // Validar que el medio de pago tenga saldo suficiente
    if (!validarSaldoSuficiente(saldosActuales, amountNumerico, nuevoGasto.medioPago)) {
      alert(`⚠️ No hay saldo suficiente en ${nuevoGasto.medioPago}. Saldo disponible: $${saldosActuales[nuevoGasto.medioPago].toLocaleString()}`);
      return;
    }

    if (!user) {
      alert('Usuario no autenticado');
      return;
    }

    try {
      const concepto = conceptos.find(c => c.id === nuevoGasto.conceptoId);
      if (!concepto) {
        alert('Concepto no encontrado');
        return;
      }

      // Usar la fecha actual en el momento exacto de crear el gasto
      const fechaActual = new Date();
      
      // Obtener nombre del usuario actual
      const getCurrentUserName = (): string => {
        try {
          const userStr = localStorage.getItem('currentUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            return user.name || 'Usuario desconocido';
          }
        } catch (error) {
          console.error('Error al obtener nombre del usuario:', error);
        }
        return user?.name || 'Usuario desconocido';
      };
      
      await gastoService.createGasto({
        conceptoId: nuevoGasto.conceptoId,
        concepto,
        amount: amountNumerico,
        description: nuevoGasto.description,
        date: fechaActual, // Fecha actual real
        medioPago: nuevoGasto.medioPago,
        createdBy: user.id,
        registradoPor: getCurrentUserName() // ✅ Nombre del usuario que registró el gasto
      });
      
      setNuevoGasto({
        conceptoId: '',
        amount: '',
        description: '',
        date: new Date(), // Resetear con fecha actual
        medioPago: 'efectivo'
      });
      setMostrarFormulario(false);
      cargarDatos();
      cargarSaldos(); // Recargar saldos después de crear el gasto
      alert('Gasto registrado exitosamente');
    } catch (error) {
      console.error('Error al crear gasto:', error);
      alert('Error al registrar el gasto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const aplicarFiltroRapido = (tipo: 'hoy' | 'ayer') => {
    const hoy = new Date(); // Fecha actual real
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    switch (tipo) {
      case 'hoy':
        setFiltros(prev => ({ ...prev, fechaInicio: hoy, fechaFin: hoy, tipoFiltro: 'hoy' }));
        break;
      case 'ayer':
        setFiltros(prev => ({ ...prev, fechaInicio: ayer, fechaFin: ayer, tipoFiltro: 'ayer' }));
        break;
    }
  };

  const crearConcepto = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuevoConcepto.name.trim()) {
      alert('El nombre del concepto es obligatorio');
      return;
    }

    try {
      console.log('Creando concepto:', nuevoConcepto);
      const conceptoId = await gastoService.createConcepto({
        name: nuevoConcepto.name.trim(),
        description: nuevoConcepto.description.trim(),
        isActive: true
      });
      console.log('Concepto creado con ID:', conceptoId);
      
      setNuevoConcepto({ name: '', description: '' });
      setMostrarFormularioConcepto(false);
      
      // Recargar conceptos específicamente
      const conceptosActualizados = await gastoService.getConceptosActivos();
      console.log('Conceptos actualizados:', conceptosActualizados);
      setConceptos(conceptosActualizados);
      
      // Si se estaba gestionando conceptos, volver a abrir el modal con datos actualizados
      if (mostrarGestionConceptos) {
        setMostrarGestionConceptos(false);
        setTimeout(() => {
          setMostrarGestionConceptos(true);
        }, 100);
      }
      
      alert('Concepto creado exitosamente');
    } catch (error) {
      console.error('Error al crear concepto:', error);
      alert('Error al crear el concepto');
    }
  };

  const editarConcepto = (concepto: ConceptoGasto) => {
    setConceptoEditando(concepto);
    setNuevoConcepto({
      name: concepto.name,
      description: concepto.description || ''
    });
    setMostrarFormularioConcepto(true);
  };

  const actualizarConcepto = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuevoConcepto.name.trim()) {
      alert('El nombre del concepto es obligatorio');
      return;
    }

    if (!conceptoEditando) return;

    try {
      await gastoService.updateConcepto(conceptoEditando.id, {
        name: nuevoConcepto.name.trim(),
        description: nuevoConcepto.description.trim()
      });
      
      setNuevoConcepto({ name: '', description: '' });
      setConceptoEditando(null);
      setMostrarFormularioConcepto(false);
      cargarDatos(); // Recargar conceptos
      alert('Concepto actualizado exitosamente');
    } catch (error) {
      console.error('Error al actualizar concepto:', error);
      alert('Error al actualizar el concepto');
    }
  };

  const eliminarConcepto = async (conceptoId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este concepto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await gastoService.deleteConcepto(conceptoId);
      cargarDatos(); // Recargar conceptos
      alert('Concepto eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar concepto:', error);
      alert('Error al eliminar el concepto');
    }
  };

  const cancelarEdicion = () => {
    setNuevoConcepto({ name: '', description: '' });
    setConceptoEditando(null);
    setMostrarFormularioConcepto(false);
  };

  const gastosFiltrados = gastos.filter(gasto => {
    const cumpleConcepto = filtros.conceptoId === 'todos' || gasto.conceptoId === filtros.conceptoId;
    return cumpleConcepto;
  });

  // Filtrar gastos de mantenimiento por fecha
  const gastosMantenimientoFiltrados = gastosMantenimiento.filter(mantenimiento => {
    // Usar fechaInicio o createdAt para determinar cuándo se hizo efectivo el gasto
    const fechaMantenimiento = mantenimiento.fechaInicio || mantenimiento.createdAt;
    return fechaMantenimiento >= filtros.fechaInicio && fechaMantenimiento <= filtros.fechaFin;
  });


  const totalGastosGenerales = gastosFiltrados.reduce((sum, gasto) => sum + gasto.amount, 0);
  const totalGastosMantenimiento = gastosMantenimientoFiltrados.reduce((sum, mantenimiento) => sum + (mantenimiento.costoReparacion || 0), 0);
  const totalGastos = totalGastosGenerales + totalGastosMantenimiento;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-danger-700 to-danger-800 bg-clip-text text-transparent">Gastos</h1>
          <p className="mt-1 text-sm text-gray-600">
            Registra y gestiona los gastos del negocio
          </p>
        </div>
        <button
          onClick={() => setMostrarFormulario(true)}
          className="btn-primary"
        >
          Nuevo Gasto
        </button>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-colored border-l-4 border-danger-500">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-danger-100 to-danger-200 border border-danger-300 shadow-md">
              <CurrencyDollarIcon className="h-7 w-7 text-danger-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Gastos Hoy</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalGastos)}
              </p>
              {/* Desglose de gastos */}
              {(totalGastosGenerales > 0 || totalGastosMantenimiento > 0) && (
                <div className="mt-2 space-y-1">
                  {totalGastosGenerales > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Gastos Generales:</span>
                      <span className="text-orange-600 font-medium">
                        {formatCurrency(totalGastosGenerales)}
                      </span>
                    </div>
                  )}
                  {totalGastosMantenimiento > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Mantenimiento:</span>
                      <span className="text-red-600 font-medium">
                        {formatCurrency(totalGastosMantenimiento)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-lg bg-primary-100">
              <CalendarIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Gastos Registrados</p>
              <p className="text-2xl font-semibold text-gray-900">{gastosFiltrados.length + gastosMantenimientoFiltrados.length}</p>
              {/* Desglose de contadores */}
              {(gastosFiltrados.length > 0 || gastosMantenimientoFiltrados.length > 0) && (
                <div className="mt-1 space-y-1">
                  {gastosFiltrados.length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Generales:</span>
                      <span className="text-orange-600 font-medium">{gastosFiltrados.length}</span>
                    </div>
                  )}
                  {gastosMantenimientoFiltrados.length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Mantenimiento:</span>
                      <span className="text-red-600 font-medium">{gastosMantenimientoFiltrados.length}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 rounded-lg bg-warning-100">
              <CurrencyDollarIcon className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Promedio por Gasto</p>
              <p className="text-2xl font-semibold text-gray-900">
                {(gastosFiltrados.length + gastosMantenimientoFiltrados.length) > 0 ? 
                  formatCurrency(totalGastos / (gastosFiltrados.length + gastosMantenimientoFiltrados.length)) : 
                  formatCurrency(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de nuevo gasto */}
      {mostrarFormulario && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setMostrarFormulario(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
          <h3 className="text-lg font-medium text-gray-900 mb-4">Nuevo Gasto</h3>
          <form onSubmit={crearGasto} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concepto *
                </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                <select
                    className="input-field flex-1"
                  value={nuevoGasto.conceptoId}
                  onChange={(e) => setNuevoGasto(prev => ({ ...prev, conceptoId: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar concepto</option>
                  {conceptos.map((concepto) => (
                    <option key={concepto.id} value={concepto.id}>
                      {concepto.name}
                    </option>
                  ))}
                </select>
                  <button
                    type="button"
                    onClick={() => setMostrarGestionConceptos(true)}
                    className="btn-primary px-3 py-2"
                    title="Gestionar conceptos"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
                
              </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="input-field"
                  value={nuevoGasto.amount}
                  onChange={(e) => {
                    setNuevoGasto(prev => ({ ...prev, amount: e.target.value }));
                    validarMontoYMedios(e.target.value);
                  }}
                  required
                />
                {parseFloat(nuevoGasto.amount) > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    💰 Saldos disponibles: 
                    Efectivo: ${saldosActuales.efectivo.toLocaleString()} | 
                    Nequi: ${saldosActuales.nequi.toLocaleString()} | 
                    Daviplata: ${saldosActuales.daviplata.toLocaleString()}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={nuevoGasto.date.toISOString().split('T')[0]}
                  onChange={(e) => setNuevoGasto(prev => ({ ...prev, date: new Date(e.target.value) }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={nuevoGasto.description}
                  onChange={(e) => setNuevoGasto(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción detallada del gasto..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medio de Pago *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => mediosDisponibles.includes('efectivo') && setNuevoGasto(prev => ({ ...prev, medioPago: 'efectivo' }))}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                      nuevoGasto.medioPago === 'efectivo'
                        ? 'bg-green-500 border-green-600 text-white'
                        : mediosDisponibles.includes('efectivo')
                        ? 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50'
                        : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => mediosDisponibles.includes('nequi') && setNuevoGasto(prev => ({ ...prev, medioPago: 'nequi' }))}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                      nuevoGasto.medioPago === 'nequi'
                        ? 'bg-blue-500 border-blue-600 text-white'
                        : mediosDisponibles.includes('nequi')
                        ? 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50'
                        : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    📱 Nequi
                  </button>
                  <button
                    type="button"
                    onClick={() => mediosDisponibles.includes('daviplata') && setNuevoGasto(prev => ({ ...prev, medioPago: 'daviplata' }))}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                      nuevoGasto.medioPago === 'daviplata'
                        ? 'bg-purple-500 border-purple-600 text-white'
                        : mediosDisponibles.includes('daviplata')
                        ? 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50'
                        : 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    📱 Daviplata
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Registrar Gasto
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Modal de concepto */}
      {mostrarFormularioConcepto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setMostrarFormularioConcepto(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {conceptoEditando ? 'Editar Concepto' : 'Nuevo Concepto'}
            </h3>
          <form onSubmit={conceptoEditando ? actualizarConcepto : crearConcepto} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Concepto *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={nuevoConcepto.name}
                  onChange={(e) => setNuevoConcepto(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Alimentación"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={nuevoConcepto.description}
                  onChange={(e) => setNuevoConcepto(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del concepto"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={cancelarEdicion}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                {conceptoEditando ? 'Actualizar' : 'Crear'} Concepto
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Modal de gestión de conceptos */}
      {mostrarGestionConceptos && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setMostrarGestionConceptos(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Gestionar Conceptos de Gastos</h3>
              <button
                onClick={() => setMostrarGestionConceptos(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Lista de conceptos existentes */}
            <div className="mb-6">
              {conceptos.length > 0 ? (
                <div className="space-y-2">
                  {conceptos.map((concepto) => (
                    <div key={concepto.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div>
                        <h5 className="font-medium text-gray-900">{concepto.name}</h5>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setConceptoEditando(concepto);
                            setNuevoConcepto({
                              name: concepto.name,
                              description: concepto.description || ''
                            });
                            setMostrarGestionConceptos(false);
                            setMostrarFormularioConcepto(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarConcepto(concepto.id)}
                          className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No hay conceptos registrados</p>
              )}
            </div>

            {/* Botón para agregar nuevo concepto */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setConceptoEditando(null);
                  setNuevoConcepto({ name: '', description: '' });
                  setMostrarGestionConceptos(false);
                  setMostrarFormularioConcepto(true);
                }}
                className="btn-primary"
              >
                Agregar Nuevo Concepto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <FunnelIcon className="h-5 w-5 text-primary-600 mr-2" />
          Filtros
        </h3>
        
        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => aplicarFiltroRapido('hoy')}
            className={`btn ${filtros.tipoFiltro === 'hoy' ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarFiltroRapido('ayer')}
            className={`btn ${filtros.tipoFiltro === 'ayer' ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            Ayer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!esOperador() && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  className="input"
                  value={filtros.fechaInicio.toISOString().split('T')[0]}
                  onChange={(e) => setFiltros(prev => ({ 
                    ...prev, 
                    fechaInicio: new Date(e.target.value),
                    tipoFiltro: 'personalizado'
                  }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  className="input"
                  value={filtros.fechaFin.toISOString().split('T')[0]}
                  onChange={(e) => setFiltros(prev => ({ 
                    ...prev, 
                    fechaFin: new Date(e.target.value),
                    tipoFiltro: 'personalizado'
                  }))}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concepto
            </label>
            <select
              className="input"
              value={filtros.conceptoId}
              onChange={(e) => setFiltros(prev => ({ ...prev, conceptoId: e.target.value }))}
            >
              <option value="todos">Todos</option>
              {conceptos.map((concepto) => (
                <option key={concepto.id} value={concepto.id}>
                  {concepto.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de gastos */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Gastos ({gastosFiltrados.length + gastosMantenimientoFiltrados.length})
        </h3>
        
        {(gastosFiltrados.length + gastosMantenimientoFiltrados.length) === 0 ? (
          <div className="text-center py-8">
            <CurrencyDollarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay gastos registrados hoy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concepto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medio de Pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Gastos generales */}
                {gastosFiltrados.map((gasto) => (
                  <tr key={gasto.id} className="hover:bg-gray-50">
                    {tienePermiso('eliminarGastos') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => eliminarGasto(gasto)}
                          className="inline-flex items-center justify-center w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-full transition-colors duration-200"
                          title="Eliminar gasto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {gasto.concepto.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {gasto.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-danger-600">
                        {formatCurrency(gasto.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        gasto.medioPago === 'efectivo' ? 'bg-green-100 text-green-800' :
                        gasto.medioPago === 'nequi' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {gasto.medioPago === 'efectivo' ? '💵 Efectivo' :
                         gasto.medioPago === 'nequi' ? '📱 Nequi' :
                         '📱 Daviplata'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {formatDate(gasto.date, 'dd/MM/yyyy HH:mm')}
                        {gasto.registradoPor && (
                          <div className="text-xs text-gray-500 mt-1">
                            {gasto.registradoPor}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                
                {/* Gastos de mantenimiento */}
                {gastosMantenimientoFiltrados.map((mantenimiento) => (
                  <tr key={`mant-${mantenimiento.id}`} className="hover:bg-gray-50 bg-red-50">
                    {tienePermiso('eliminarGastos') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => eliminarGastoMantenimiento(mantenimiento)}
                          className="inline-flex items-center justify-center w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-full transition-colors duration-200"
                          title="Eliminar gasto de mantenimiento"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-800">
                        Mantenimiento - {mantenimiento.tipoFalla}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {mantenimiento.descripcion || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        {formatCurrency(mantenimiento.costoReparacion || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {mantenimiento.medioPago === 'efectivo' ? '💵 Efectivo' :
                         mantenimiento.medioPago === 'nequi' ? '📱 Nequi' :
                         '📱 Daviplata'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(mantenimiento.fechaFin, 'dd/MM/yyyy HH:mm')}
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

export default Gastos;


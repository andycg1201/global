import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Cog6ToothIcon, 
  CurrencyDollarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { configService, planService, resetService } from '../services/firebaseService';
import { storageService, ejecutarLimpiezaAutomatica } from '../services/storageService';
import { Configuracion, Plan } from '../types';
import { formatCurrency } from '../utils/dateUtils';

const Configuracion: React.FC = () => {
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mostrarFormularioPlan, setMostrarFormularioPlan] = useState(false);
  const [planEditando, setPlanEditando] = useState<Plan | null>(null);
  const [mostrarConfirmacionReset, setMostrarConfirmacionReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [estadisticasStorage, setEstadisticasStorage] = useState({
    totalFotos: 0,
    tamañoTotal: 0,
    fotosAntiguas: 0
  });
  const [limpiando, setLimpiando] = useState(false);
  
  const [formData, setFormData] = useState({
    horaAdicional: 2000
  });

  const [formularioPlan, setFormularioPlan] = useState({
    name: '',
    description: '',
    price: 0,
    duration: 0,
    startTime: '07:00',
    endTime: '19:00',
    isWeekendOnly: false
  });

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar datos críticos primero
      const [config, planesData] = await Promise.all([
        configService.getConfiguracion(),
        planService.getActivePlans()
      ]);
      
      if (config) {
        setConfiguracion(config);
        setFormData({
          horaAdicional: config.horaAdicional
        });
      }
      
      setPlanes(planesData);
      
      // Cargar estadísticas de storage de forma asíncrona (no bloquea la UI)
      storageService.obtenerEstadisticas().then(stats => {
        setEstadisticasStorage(stats);
      }).catch(error => {
        console.error('Error al cargar estadísticas de storage:', error);
      });
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const guardarConfiguracion = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await configService.updateConfiguracion(formData);
      setConfiguracion(prev => prev ? { ...prev, ...formData } : null);
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  }, [formData]);

  const abrirFormularioPlan = (plan?: Plan) => {
    if (plan) {
      setPlanEditando(plan);
      setFormularioPlan({
        name: plan.name,
        description: plan.description,
        price: plan.price,
        duration: plan.duration,
        startTime: plan.startTime,
        endTime: plan.endTime,
        isWeekendOnly: plan.isWeekendOnly
      });
    } else {
      setPlanEditando(null);
      setFormularioPlan({
        name: '',
        description: '',
        price: 0,
        duration: 0,
        startTime: '07:00',
        endTime: '19:00',
        isWeekendOnly: false
      });
    }
    setMostrarFormularioPlan(true);
  };

  const cerrarFormularioPlan = () => {
    setMostrarFormularioPlan(false);
    setPlanEditando(null);
    setFormularioPlan({
      name: '',
      description: '',
      price: 0,
      duration: 0,
      startTime: '07:00',
      endTime: '19:00',
      isWeekendOnly: false
    });
  };

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      // Eliminar todos los datos
      await resetService.resetAllData();
      
      // Reinicializar datos básicos
      await resetService.initializeBasicData();
      
      // Recargar datos
      await cargarDatos();
      
      setMostrarConfirmacionReset(false);
      alert('¡Todos los datos han sido eliminados y reinicializados exitosamente!');
    } catch (error) {
      console.error('Error al resetear datos:', error);
      alert('Error al resetear los datos: ' + (error as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const handleLimpiarFotosAntiguas = async () => {
    setLimpiando(true);
    try {
      const fotosEliminadas = await storageService.eliminarFotosAntiguas();
      
      // Recargar estadísticas
      const stats = await storageService.obtenerEstadisticas();
      setEstadisticasStorage(stats);
      
      alert(`✅ Limpieza completada: ${fotosEliminadas} fotos eliminadas`);
    } catch (error) {
      console.error('Error al limpiar fotos:', error);
      alert('Error al limpiar fotos antiguas: ' + (error as Error).message);
    } finally {
      setLimpiando(false);
    }
  };

  const guardarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (planEditando) {
        // Actualizar plan existente
        await planService.updatePlan(planEditando.id, formularioPlan);
        setPlanes(prev => prev.map(p => p.id === planEditando.id ? { ...p, ...formularioPlan } : p));
        alert('Plan actualizado exitosamente');
      } else {
        // Crear nuevo plan
        const planConActivo = { ...formularioPlan, isActive: true };
        const nuevoPlanId = await planService.createPlan(planConActivo);
        const nuevoPlan: Plan = {
          id: nuevoPlanId,
          ...planConActivo,
          createdAt: new Date()
        };
        setPlanes(prev => [...prev, nuevoPlan]);
        alert('Plan creado exitosamente');
      }
      cerrarFormularioPlan();
    } catch (error) {
      console.error('Error al guardar plan:', error);
      alert('Error al guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const eliminarPlan = async (plan: Plan) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el plan "${plan.name}"?`)) {
      return;
    }
    
    try {
      await planService.updatePlan(plan.id, { isActive: false });
      setPlanes(prev => prev.filter(p => p.id !== plan.id));
      alert('Plan eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      alert('Error al eliminar el plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 p-2 sm:p-4 min-h-screen bg-white relative z-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-700">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configura los precios y gestiona los planes de servicio
        </p>
      </div>

      {/* Configuración de precios */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <CurrencyDollarIcon className="h-6 w-6 text-primary-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-900">Configuración de Precios</h3>
        </div>
        
        <form onSubmit={guardarConfiguracion}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio por Hora Adicional
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="number"
                min="0"
                step="100"
                className="input-field w-32"
                value={formData.horaAdicional}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  horaAdicional: parseFloat(e.target.value) || 0 
                }))}
              />
              <span className="text-sm text-gray-500">
                = {formatCurrency(formData.horaAdicional)}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Gestión de Fotos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-blue-800 mb-2">📸 Gestión de Fotos de Instalación</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{estadisticasStorage.totalFotos}</div>
              <div className="text-sm text-blue-600">Total Fotos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(estadisticasStorage.tamañoTotal / 1024 / 1024).toFixed(1)} MB
              </div>
              <div className="text-sm text-blue-600">Espacio Usado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{estadisticasStorage.fotosAntiguas}</div>
              <div className="text-sm text-orange-600">Fotos Antiguas (&gt;30 días)</div>
            </div>
          </div>
          <p className="text-sm text-blue-600 mb-4">
            Las fotos se eliminan automáticamente después de 30 días para ahorrar espacio.
          </p>
          <div className="flex justify-end">
            <button
              onClick={handleLimpiarFotosAntiguas}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              disabled={limpiando || estadisticasStorage.fotosAntiguas === 0}
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              {limpiando ? 'Limpiando...' : `Limpiar ${estadisticasStorage.fotosAntiguas} Fotos Antiguas`}
            </button>
          </div>
        </div>
      </div>

      {/* Gestión de planes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Cog6ToothIcon className="h-6 w-6 text-primary-600 mr-3" />
            <h3 className="text-lg font-medium text-gray-900">Gestión de Planes</h3>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => abrirFormularioPlan()}
              className="btn-primary"
            >
              Nuevo Plan
            </button>
            <button
              onClick={() => setMostrarConfirmacionReset(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              disabled={resetting}
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              {resetting ? 'Reseteando...' : 'Reset Todo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {planes.map((plan) => (
            <div key={plan.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                <div className="flex space-x-1">
                  <button
                    onClick={() => abrirFormularioPlan(plan)}
                    className="text-warning-600 hover:text-warning-700"
                    title="Editar"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => eliminarPlan(plan)}
                    className="text-danger-600 hover:text-danger-700"
                    title="Eliminar"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{plan.description}</p>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Precio:</span>
                  <span className="font-medium text-success-600">
                    {formatCurrency(plan.price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duración:</span>
                  <span className="font-medium">{plan.duration}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Horario:</span>
                  <span className="font-medium">{plan.startTime} - {plan.endTime}</span>
                </div>
                {plan.isWeekendOnly && (
                  <div className="text-xs text-warning-600 font-medium">
                    Solo fines de semana
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {planes.length === 0 && (
          <div className="text-center py-8">
            <Cog6ToothIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay planes configurados</p>
            <button
              onClick={() => abrirFormularioPlan()}
              className="btn-primary mt-4"
            >
              Crear Primer Plan
            </button>
          </div>
        )}
      </div>

      {/* Modal de formulario de plan */}
      {mostrarFormularioPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {planEditando ? 'Editar Plan' : 'Nuevo Plan'}
              </h3>
              <button
                onClick={cerrarFormularioPlan}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={guardarPlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Plan
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formularioPlan.name}
                    onChange={(e) => setFormularioPlan(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="input-field"
                    value={formularioPlan.price}
                    onChange={(e) => setFormularioPlan(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={formularioPlan.description}
                  onChange={(e) => setFormularioPlan(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración (horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={formularioPlan.duration}
                    onChange={(e) => setFormularioPlan(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    className="input-field"
                    value={formularioPlan.startTime}
                    onChange={(e) => setFormularioPlan(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    className="input-field"
                    value={formularioPlan.endTime}
                    onChange={(e) => setFormularioPlan(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isWeekendOnly"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={formularioPlan.isWeekendOnly}
                  onChange={(e) => setFormularioPlan(prev => ({ ...prev, isWeekendOnly: e.target.checked }))}
                />
                <label htmlFor="isWeekendOnly" className="ml-2 block text-sm text-gray-900">
                  Solo fines de semana
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={cerrarFormularioPlan}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Guardando...' : (planEditando ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para reset */}
      {mostrarConfirmacionReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <TrashIcon className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Confirmar Reset Completo
                </h3>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-4">
                <strong>⚠️ ADVERTENCIA:</strong> Esta acción eliminará los siguientes datos:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Todos los pedidos</li>
                <li>• Todos los clientes</li>
                <li>• Todos los gastos</li>
                <li>• Todos los conceptos de gastos</li>
                <li>• Todos los reportes</li>
                <li>• Todos los mantenimientos realizados</li>
                <li>• La configuración actual</li>
              </ul>
              <p className="text-sm text-green-600 mt-4 font-medium">
                ✅ Los planes y lavadoras se conservarán (no se eliminan)
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Después se crearán conceptos de gastos básicos si no existen.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setMostrarConfirmacionReset(false)}
                className="btn-secondary"
                disabled={resetting}
              >
                Cancelar
              </button>
              <button
                onClick={handleResetAllData}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                disabled={resetting}
              >
                {resetting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Reseteando...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Confirmar Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracion;
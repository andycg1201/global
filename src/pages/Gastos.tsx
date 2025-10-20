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

interface FiltrosGastos {
  fechaInicio: Date;
  fechaFin: Date;
  conceptoId: string;
  tipoFiltro: 'hoy' | 'ayer' | 'personalizado';
}

const Gastos: React.FC = () => {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoGasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevoGasto, setNuevoGasto] = useState({
    conceptoId: '',
    amount: 0,
    description: '',
    date: getCurrentDateColombia()
  });
  
  const [filtros, setFiltros] = useState<FiltrosGastos>({
    fechaInicio: getCurrentDateColombia(),
    fechaFin: getCurrentDateColombia(),
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

  useEffect(() => {
    cargarDatos();
  }, [filtros]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      console.log('Cargando gastos para rango:', filtros.fechaInicio, 'a', filtros.fechaFin);
      // Obtener gastos del rango de fechas
      const gastosData = await gastoService.getGastosDelRango(filtros.fechaInicio, filtros.fechaFin);
      const conceptosData = await gastoService.getConceptosActivos();
      
      console.log('Gastos cargados:', gastosData);
      console.log('Conceptos cargados:', conceptosData);
      
      setGastos(gastosData);
      setConceptos(conceptosData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const crearGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuevoGasto.conceptoId || nuevoGasto.amount <= 0) {
      alert('Concepto y monto son obligatorios');
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

      await gastoService.createGasto({
        conceptoId: nuevoGasto.conceptoId,
        concepto,
        amount: nuevoGasto.amount,
        description: nuevoGasto.description,
        date: nuevoGasto.date,
        createdBy: user.id
      });
      
      setNuevoGasto({
        conceptoId: '',
        amount: 0,
        description: '',
        date: getCurrentDateColombia()
      });
      setMostrarFormulario(false);
      cargarDatos();
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
    const hoy = getCurrentDateColombia();
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

  const totalGastos = gastosFiltrados.reduce((sum, gasto) => sum + gasto.amount, 0);

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
              <p className="text-2xl font-semibold text-gray-900">{gastosFiltrados.length}</p>
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
                {gastosFiltrados.length > 0 ? formatCurrency(totalGastos / gastosFiltrados.length) : formatCurrency(0)}
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
                  onChange={(e) => setNuevoGasto(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  required
                />
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
          Gastos ({gastosFiltrados.length})
        </h3>
        
        {gastosFiltrados.length === 0 ? (
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
                    Concepto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registrado por
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {gastosFiltrados.map((gasto) => (
                  <tr key={gasto.id} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(gasto.date, 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(gasto.createdAt, 'HH:mm')}
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


import React, { useState, useEffect } from 'react';
import { XMarkIcon, WrenchScrewdriverIcon, CalendarIcon, CurrencyDollarIcon, BuildingOfficeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Lavadora, Mantenimiento } from '../types';
import { obtenerHistorialMantenimiento } from '../services/mantenimientoService';
import { formatDate } from '../utils/dateUtils';

interface ModalHistorialMantenimientoProps {
  isOpen: boolean;
  onClose: () => void;
  lavadora: Lavadora | null;
  onRefresh?: () => void;
  refreshTrigger?: number; // Para forzar actualización desde el padre
}

export const ModalHistorialMantenimiento: React.FC<ModalHistorialMantenimientoProps> = ({
  isOpen,
  onClose,
  lavadora,
  onRefresh,
  refreshTrigger
}) => {
  const [historial, setHistorial] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lavadora) {
      cargarHistorial();
    }
  }, [isOpen, lavadora]);

  // Actualizar historial cuando se abre el modal o cambia la lavadora
  useEffect(() => {
    if (isOpen && lavadora) {
      cargarHistorial();
    }
  }, [isOpen, lavadora?.id, lavadora?.mantenimientoActual, refreshTrigger]);

  const cargarHistorial = async () => {
    if (!lavadora) return;

    try {
      setLoading(true);
      setError(null);
      const historialData = await obtenerHistorialMantenimiento(lavadora.id);
      setHistorial(historialData);
    } catch (err) {
      setError('Error al cargar el historial de mantenimiento');
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoMantenimiento = (mantenimiento: Mantenimiento) => {
    if (mantenimiento.fechaFin) {
      return {
        texto: 'Completado',
        color: 'bg-green-100 text-green-800',
        icono: '✅'
      };
    } else {
      return {
        texto: 'En Progreso',
        color: 'bg-yellow-100 text-yellow-800',
        icono: '🔧'
      };
    }
  };

  const calcularEstadisticas = () => {
    const totalMantenimientos = historial.length;
    const mantenimientosCompletados = historial.filter(m => m.fechaFin).length;
    const costoTotal = historial.reduce((sum, m) => sum + m.costoReparacion, 0);
    const costoPromedio = totalMantenimientos > 0 ? costoTotal / totalMantenimientos : 0;

    return {
      totalMantenimientos,
      mantenimientosCompletados,
      costoTotal,
      costoPromedio
    };
  };

  const estadisticas = calcularEstadisticas();

  if (!isOpen || !lavadora) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <WrenchScrewdriverIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Historial de Mantenimiento
              </h2>
              <p className="text-sm text-gray-500">
                {lavadora.codigoQR} - {lavadora.marca} {lavadora.modelo}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={cargarHistorial}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Actualizar historial"
            >
              <ArrowPathIcon className={`h-5 w-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Cargando historial...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : (
            <>
              {/* Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <WrenchScrewdriverIcon className="h-8 w-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-600">Total Reparaciones</p>
                      <p className="text-2xl font-bold text-blue-900">{estadisticas.totalMantenimientos}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <CalendarIcon className="h-8 w-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">Completadas</p>
                      <p className="text-2xl font-bold text-green-900">{estadisticas.mantenimientosCompletados}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-8 w-8 text-orange-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-orange-600">Costo Total</p>
                      <p className="text-2xl font-bold text-orange-900">
                        ${estadisticas.costoTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-8 w-8 text-purple-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-600">Costo Promedio</p>
                      <p className="text-2xl font-bold text-purple-900">
                        ${estadisticas.costoPromedio.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de mantenimientos */}
              {historial.length === 0 ? (
                <div className="text-center py-8">
                  <WrenchScrewdriverIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay historial de mantenimiento</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Reparaciones Realizadas</h3>
                  {historial.map((mantenimiento) => {
                    const estado = getEstadoMantenimiento(mantenimiento);
                    return (
                      <div key={mantenimiento.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{estado.icono}</span>
                            <div>
                              <h4 className="font-medium text-gray-900">{mantenimiento.tipoFalla}</h4>
                              <p className="text-sm text-gray-500">{mantenimiento.servicioTecnico}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${estado.color}`}>
                            {estado.texto}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500">Fecha de Inicio</p>
                            <p className="text-sm font-medium">
                              {formatDate(mantenimiento.fechaInicio, 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Fecha Estimada</p>
                            <p className="text-sm font-medium">
                              {formatDate(mantenimiento.fechaEstimadaFin, 'dd/MM/yyyy')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Costo</p>
                            <p className="text-sm font-medium text-green-600">
                              ${mantenimiento.costoReparacion.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-xs text-gray-500">Descripción</p>
                          <p className="text-sm text-gray-900">{mantenimiento.descripcion}</p>
                        </div>

                        {mantenimiento.fechaFin && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500">Fecha de Finalización</p>
                            <p className="text-sm font-medium text-green-600">
                              {formatDate(mantenimiento.fechaFin, 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        )}

                        {mantenimiento.observaciones && (
                          <div>
                            <p className="text-xs text-gray-500">Observaciones</p>
                            <p className="text-sm text-gray-900">{mantenimiento.observaciones}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

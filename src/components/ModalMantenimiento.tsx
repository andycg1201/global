import React, { useState, useEffect } from 'react';
import { XMarkIcon, CameraIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { Lavadora, Mantenimiento } from '../types';
import { TIPOS_FALLA, crearMantenimiento, finalizarMantenimiento } from '../services/mantenimientoService';
import { useAuth } from '../contexts/AuthContext';
import { calcularSaldosActuales, validarSaldoSuficiente, obtenerMediosDisponibles, SaldoPorMedio } from '../utils/saldoUtils';

interface ModalMantenimientoProps {
  isOpen: boolean;
  onClose: () => void;
  lavadora: Lavadora | null;
  onSuccess: () => void;
  modo: 'crear' | 'finalizar';
  mantenimiento?: Mantenimiento;
}

export const ModalMantenimiento: React.FC<ModalMantenimientoProps> = ({
  isOpen,
  onClose,
  lavadora,
  onSuccess,
  modo,
  mantenimiento
}) => {
  const { user, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para crear mantenimiento
  const [tipoFalla, setTipoFalla] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [costoReparacion, setCostoReparacion] = useState<string>('');
  const [servicioTecnico, setServicioTecnico] = useState('');
  const [fechaEstimadaFin, setFechaEstimadaFin] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [medioPago, setMedioPago] = useState<'efectivo' | 'nequi' | 'daviplata'>('efectivo');

  // Estados para validación de saldos
  const [saldosActuales, setSaldosActuales] = useState<SaldoPorMedio>({
    efectivo: 0,
    nequi: 0,
    daviplata: 0
  });
  const [mediosDisponibles, setMediosDisponibles] = useState<Array<'efectivo' | 'nequi' | 'daviplata'>>(['efectivo', 'nequi', 'daviplata']);

  // Estados para finalizar mantenimiento
  const [observacionesFinalizacion, setObservacionesFinalizacion] = useState('');

  // Cargar saldos cuando se abre el modal
  useEffect(() => {
    if (isOpen && modo === 'crear') {
      cargarSaldos();
    }
  }, [isOpen, modo]);

  const cargarSaldos = async () => {
    try {
      const saldos = await calcularSaldosActuales();
      setSaldosActuales(saldos);
      console.log('💰 Saldos actuales cargados en mantenimiento:', saldos);
    } catch (error) {
      console.error('Error al cargar saldos:', error);
    }
  };

  const validarMontoYMedios = (monto: string) => {
    const montoNumerico = parseFloat(monto) || 0;
    if (montoNumerico > 0) {
      const mediosDisponibles = obtenerMediosDisponibles(saldosActuales, montoNumerico);
      setMediosDisponibles(mediosDisponibles);
      
      // Si el medio de pago actual no está disponible, cambiar a uno disponible
      if (mediosDisponibles.length > 0 && !mediosDisponibles.includes(medioPago)) {
        setMedioPago(mediosDisponibles[0]);
      }
    } else {
      setMediosDisponibles(['efectivo', 'nequi', 'daviplata']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Usar firebaseUser.uid como fallback si user.id no está disponible
    const userId = user?.id || firebaseUser?.uid;
    
    if (!lavadora || !userId) {
      setError('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (modo === 'crear') {
        // Validaciones
        if (!tipoFalla || !descripcion || !servicioTecnico || !fechaEstimadaFin) {
          throw new Error('Todos los campos obligatorios deben ser completados');
        }

        const costoNumerico = parseFloat(costoReparacion) || 0;
        if (costoNumerico < 0) {
          throw new Error('El costo de reparación no puede ser negativo');
        }

        // Validar que el medio de pago tenga saldo suficiente
        if (costoNumerico > 0 && !validarSaldoSuficiente(saldosActuales, costoNumerico, medioPago)) {
          throw new Error(`⚠️ No hay saldo suficiente en ${medioPago}. Saldo disponible: $${saldosActuales[medioPago].toLocaleString()}`);
        }

        const fechaFin = new Date(fechaEstimadaFin);
        if (fechaFin <= new Date()) {
          throw new Error('La fecha estimada de fin debe ser futura');
        }

        await crearMantenimiento(
          lavadora.id,
          tipoFalla,
          descripcion,
          costoNumerico,
          servicioTecnico,
          fechaFin,
          userId,
          fotos,
          observaciones,
          medioPago
        );
      } else if (modo === 'finalizar' && mantenimiento) {
        await finalizarMantenimiento(
          mantenimiento.id,
          lavadora.id,
          observacionesFinalizacion
        );
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipoFalla('');
    setDescripcion('');
    setCostoReparacion('');
    setServicioTecnico('');
    setFechaEstimadaFin('');
    setObservaciones('');
    setFotos([]);
    setMedioPago('efectivo');
    setObservacionesFinalizacion('');
    setError(null);
    setMediosDisponibles(['efectivo', 'nequi', 'daviplata']);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || !lavadora) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <WrenchScrewdriverIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {modo === 'crear' ? 'Enviar a Mantenimiento' : 'Finalizar Mantenimiento'}
              </h2>
              <p className="text-sm text-gray-500">
                {lavadora.codigoQR} - {lavadora.marca} {lavadora.modelo}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}


          {modo === 'crear' ? (
            <>
              {/* Tipo de Falla */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Falla *
                </label>
                <select
                  value={tipoFalla}
                  onChange={(e) => setTipoFalla(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                >
                  <option value="">Seleccionar tipo de falla</option>
                  {TIPOS_FALLA.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción del Problema *
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Describe detalladamente el problema encontrado..."
                  required
                />
              </div>

              {/* Costo y Servicio Técnico */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Costo de Reparación ($)
                  </label>
                  <input
                    type="number"
                    value={costoReparacion}
                    onChange={(e) => {
                      setCostoReparacion(e.target.value);
                      validarMontoYMedios(e.target.value);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="0.00"
                  />
                  {parseFloat(costoReparacion) > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      💰 Saldos disponibles: 
                      Efectivo: ${saldosActuales.efectivo.toLocaleString()} | 
                      Nequi: ${saldosActuales.nequi.toLocaleString()} | 
                      Daviplata: ${saldosActuales.daviplata.toLocaleString()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Servicio Técnico *
                  </label>
                  <input
                    type="text"
                    value={servicioTecnico}
                    onChange={(e) => setServicioTecnico(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Nombre del servicio técnico"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medio de Pago *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMedioPago('efectivo')}
                      disabled={!mediosDisponibles.includes('efectivo')}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        medioPago === 'efectivo'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : mediosDisponibles.includes('efectivo')
                          ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      💵 Efectivo {!mediosDisponibles.includes('efectivo') && '(Sin saldo)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedioPago('nequi')}
                      disabled={!mediosDisponibles.includes('nequi')}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        medioPago === 'nequi'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : mediosDisponibles.includes('nequi')
                          ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      📱 Nequi {!mediosDisponibles.includes('nequi') && '(Sin saldo)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedioPago('daviplata')}
                      disabled={!mediosDisponibles.includes('daviplata')}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        medioPago === 'daviplata'
                          ? 'bg-purple-50 border-purple-500 text-purple-700'
                          : mediosDisponibles.includes('daviplata')
                          ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      📱 Daviplata {!mediosDisponibles.includes('daviplata') && '(Sin saldo)'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Fecha Estimada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Estimada de Reparación *
                </label>
                <input
                  type="date"
                  value={fechaEstimadaFin}
                  onChange={(e) => setFechaEstimadaFin(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones Adicionales
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Observaciones adicionales sobre el mantenimiento..."
                />
              </div>
            </>
          ) : (
            /* Modo Finalizar */
            <div className="space-y-4">
              {mantenimiento && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">Información del Mantenimiento</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Tipo de Falla:</span>
                      <p className="font-medium">{mantenimiento.tipoFalla}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Servicio Técnico:</span>
                      <p className="font-medium">{mantenimiento.servicioTecnico}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Costo:</span>
                      <p className="font-medium">${mantenimiento.costoReparacion.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Fecha Estimada:</span>
                      <p className="font-medium">
                        {mantenimiento.fechaEstimadaFin.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Descripción:</span>
                    <p className="font-medium">{mantenimiento.descripcion}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones de Finalización
                </label>
                <textarea
                  value={observacionesFinalizacion}
                  onChange={(e) => setObservacionesFinalizacion(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Observaciones sobre la reparación realizada..."
                />
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>
                {modo === 'crear' ? 'Enviar a Mantenimiento' : 'Marcar como Disponible'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { clienteService } from '../services/firebaseService';
import { Cliente } from '../types';
import LocationPicker from './LocationPicker';
import { formatColombianPhone } from '../utils/dateUtils';

interface ModalClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteCreated: (cliente: Cliente) => void;
  clienteEditando?: Cliente | null;
  title?: string;
}

const ModalCliente: React.FC<ModalClienteProps> = ({ 
  isOpen, 
  onClose, 
  onClienteCreated, 
  clienteEditando = null,
  title 
}) => {
  const [loading, setLoading] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    ubicacionGPS: undefined as { lat: number; lng: number } | undefined
  });
  const [getCurrentMapCenter, setGetCurrentMapCenter] = useState<(() => { lat: number; lng: number }) | null>(null);

  // Actualizar el estado cuando se abre el modal con un cliente para editar
  useEffect(() => {
    if (isOpen && clienteEditando) {
      setNuevoCliente({
        name: clienteEditando.name || '',
        phone: clienteEditando.phone || '',
        address: clienteEditando.address || '',
        notes: clienteEditando.notes || '',
        ubicacionGPS: clienteEditando.ubicacionGPS || undefined
      });
    } else if (isOpen && !clienteEditando) {
      // Limpiar el formulario para nuevo cliente
      setNuevoCliente({
        name: '',
        phone: '',
        address: '',
        notes: '',
        ubicacionGPS: undefined
      });
    }
  }, [isOpen, clienteEditando]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (clienteEditando) {
        // Actualizar cliente existente
        const clienteActualizado = {
          ...clienteEditando,
          ...nuevoCliente,
          updatedAt: new Date()
        };
        await clienteService.updateCliente(clienteEditando.id, clienteActualizado);
        onClienteCreated(clienteActualizado);
      } else {
        // Crear nuevo cliente
        const clienteData = {
          ...nuevoCliente,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };
        const clienteId = await clienteService.createCliente(clienteData);
        const clienteCreado = {
          id: clienteId,
          ...clienteData
        };
        onClienteCreated(clienteCreado);
      }
      
      // Limpiar formulario
      setNuevoCliente({
        name: '',
        phone: '',
        address: '',
        notes: '',
        ubicacionGPS: undefined
      });
      onClose();
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      alert('Error al guardar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Limpiar formulario al cerrar
    setNuevoCliente({
      name: '',
      phone: '',
      address: '',
      notes: '',
      ubicacionGPS: undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {title || (clienteEditando ? 'Editar Cliente' : 'Crear Nuevo Cliente')}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                className="input-field"
                value={nuevoCliente.name}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <input
                type="tel"
                className="input-field"
                value={nuevoCliente.phone}
                onChange={(e) => {
                  const formattedPhone = formatColombianPhone(e.target.value);
                  setNuevoCliente(prev => ({ ...prev, phone: formattedPhone }));
                }}
                required
                placeholder="Ej: 3001234567 o 3172478520"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se formateará automáticamente a formato colombiano (+57)
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                className="input-field"
                value={nuevoCliente.address}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ej: Calle 123 #45-67, Barrio Centro"
              />
            </div>
            <div className="md:col-span-2">
              <LocationPicker
                onLocationSelect={(lat, lng) => {
                  setNuevoCliente(prev => ({
                    ...prev,
                    ubicacionGPS: { lat, lng }
                  }));
                }}
                initialLocation={nuevoCliente.ubicacionGPS}
                label="Ubicación GPS (Opcional)"
                getCurrentMapCenter={(getCenterFn) => {
                  setGetCurrentMapCenter(() => getCenterFn);
                }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                className="input-field"
                rows={3}
                value={nuevoCliente.notes}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Información adicional sobre el cliente..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Guardando...' : (clienteEditando ? 'Actualizar Cliente' : 'Crear Cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCliente;

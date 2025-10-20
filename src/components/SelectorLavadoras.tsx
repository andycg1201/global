import React, { useState, useEffect } from 'react';
import { 
  CubeIcon,
  CheckCircleIcon,
  XCircleIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import { lavadoraService } from '../services/firebaseService';
import { Lavadora } from '../types';

interface SelectorLavadorasProps {
  lavadoraSeleccionada: string | null;
  onLavadoraSeleccionada: (lavadoraId: string | null) => void;
  disabled?: boolean;
}

const SelectorLavadoras: React.FC<SelectorLavadorasProps> = ({
  lavadoraSeleccionada,
  onLavadoraSeleccionada,
  disabled = false
}) => {
  const [lavadoras, setLavadoras] = useState<Lavadora[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarLavadorasDisponibles();
  }, []);

  const cargarLavadorasDisponibles = async () => {
    try {
      setLoading(true);
      // Cargar todas las lavadoras
      const lavadorasData = await lavadoraService.getAllLavadoras();
      // Filtrar solo las lavadoras que están disponibles para alquilar
      // (disponible o alquilada - para mostrar cuáles están ocupadas)
      const lavadorasDisponibles = lavadorasData.filter(lavadora => 
        lavadora.estado === 'disponible' || lavadora.estado === 'alquilada'
      );
      // Ordenar por código QR ascendente
      const lavadorasOrdenadas = lavadorasDisponibles.sort((a, b) => 
        a.codigoQR.localeCompare(b.codigoQR)
      );
      setLavadoras(lavadorasOrdenadas);
    } catch (error) {
      console.error('Error al cargar lavadoras disponibles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColors = (estado: string, isSelected: boolean) => {
    switch (estado) {
      case 'disponible':
        return {
          bg: isSelected ? 'bg-blue-100' : 'bg-green-100',
          border: isSelected ? 'border-blue-500' : 'border-green-400',
          text: 'text-gray-900'
        };
      case 'alquilada':
        return {
          bg: isSelected ? 'bg-blue-100' : 'bg-orange-100',
          border: isSelected ? 'border-blue-500' : 'border-orange-400',
          text: 'text-gray-900'
        };
      case 'mantenimiento':
        return {
          bg: isSelected ? 'bg-blue-100' : 'bg-red-100',
          border: isSelected ? 'border-blue-500' : 'border-red-400',
          text: 'text-gray-900'
        };
      case 'retirada':
        return {
          bg: isSelected ? 'bg-blue-100' : 'bg-gray-200',
          border: isSelected ? 'border-blue-500' : 'border-gray-400',
          text: 'text-gray-700'
        };
      default:
        return {
          bg: isSelected ? 'bg-blue-100' : 'bg-white',
          border: isSelected ? 'border-blue-500' : 'border-gray-300',
          text: 'text-gray-900'
        };
    }
  };

  const handleSeleccionarLavadora = (lavadoraId: string) => {
    if (disabled) return;
    
    // Buscar la lavadora para verificar su estado
    const lavadora = lavadoras.find(l => l.id === lavadoraId);
    if (!lavadora) return;
    
    // No permitir seleccionar lavadoras que están alquiladas
    if (lavadora.estado === 'alquilada') {
      alert('Esta lavadora ya está alquilada y no está disponible');
      return;
    }
    
    if (lavadoraSeleccionada?.id === lavadoraId) {
      // Deseleccionar si ya está seleccionada
      onLavadoraSeleccionada(null);
    } else {
      // Seleccionar nueva lavadora - pasar el objeto completo
      onLavadoraSeleccionada(lavadora);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Seleccionar Lavadora
        </label>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (lavadoras.length === 0) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Seleccionar Lavadora
        </label>
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CubeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay lavadoras disponibles</p>
          <p className="text-sm text-gray-400">Ve al inventario para registrar lavadoras</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Seleccionar Lavadora
      </label>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {lavadoras.map((lavadora) => {
          const isSelected = lavadoraSeleccionada?.id === lavadora.id;
          const isDisabled = disabled || lavadora.estado === 'alquilada';
          const colors = getEstadoColors(lavadora.estado, isSelected);
          
          return (
            <button
              key={lavadora.id}
              type="button"
              onClick={() => handleSeleccionarLavadora(lavadora.id)}
              disabled={isDisabled}
              className={`
                relative p-2 rounded-lg border-2 transition-all duration-200
                ${colors.bg} ${colors.border}
                ${isSelected ? 'shadow-md' : 'hover:shadow-sm'}
                ${isDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'
                }
              `}
            >
              {/* Contenido en una sola fila */}
              <div className="text-center">
                <div className={`text-sm font-bold mb-1 ${colors.text}`}>
                  {lavadora.codigoQR}
                </div>
                <div className={`text-xs ${colors.text}`}>
                  {lavadora.marca} {lavadora.modelo}
                </div>
              </div>
              
              {/* Indicador de selección */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <CheckCircleIcon className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Información de selección */}
      {lavadoraSeleccionada && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-blue-800">
              Lavadora seleccionada: {lavadoras.find(l => l.id === lavadoraSeleccionada)?.codigoQR}
            </span>
          </div>
        </div>
      )}
      
      {/* Contador */}
      <div className="text-xs text-gray-500 text-center">
        {lavadoras.filter(l => l.estado === 'disponible').length} disponible{lavadoras.filter(l => l.estado === 'disponible').length !== 1 ? 's' : ''} • {lavadoras.filter(l => l.estado === 'alquilada').length} alquilada{lavadoras.filter(l => l.estado === 'alquilada').length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default SelectorLavadoras;

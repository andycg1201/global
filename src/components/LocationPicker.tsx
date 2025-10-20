import React, { useState } from 'react';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
  label?: string;
  getCurrentMapCenter?: (getCenterFn: () => { lat: number; lng: number }) => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation,
  label = "Ubicación GPS"
}) => {
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada por este navegador.');
      return;
    }

    setGpsLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        onLocationSelect(lat, lng);
        setGpsLoading(false);
      },
      (error) => {
        console.error('Error de geolocalización:', error);
        let message = 'Error al obtener la ubicación GPS.';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permisos de ubicación denegados. Por favor, permite el acceso a la ubicación.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Información de ubicación no disponible.';
            break;
          case error.TIMEOUT:
            message = 'Tiempo de espera agotado al obtener la ubicación.';
            break;
        }
        
        alert(message);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      
      {/* Botón GPS */}
      <button
        type="button"
        onClick={handleGPSLocation}
        disabled={gpsLoading}
        className="btn-secondary w-full flex items-center justify-center space-x-2"
      >
        <DevicePhoneMobileIcon className="h-4 w-4" />
        <span>{gpsLoading ? 'Obteniendo ubicación...' : 'Mi Ubicación GPS'}</span>
      </button>
      
    </div>
  );
};

export default LocationPicker;
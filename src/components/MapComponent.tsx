import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Estilos CSS para iconos personalizados
const customIconStyles = `
  .custom-div-icon {
    background: transparent !important;
    border: none !important;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

// Inyectar estilos si no existen
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('leaflet-custom-styles');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = 'leaflet-custom-styles';
    style.textContent = customIconStyles;
    document.head.appendChild(style);
  }
}

// Función para inicializar iconos de Leaflet de manera robusta
const initializeLeafletIcons = () => {
  // Eliminar método problemático si existe (usando any para evitar errores de TypeScript)
  if ((L.Icon.Default.prototype as any)._getIconUrl) {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }

  // Configurar iconos por defecto
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Inicializar iconos al cargar el módulo
initializeLeafletIcons();

// Función para crear icono personalizado
const createCustomIcon = () => {
  return L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

interface MapComponentProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    id: string;
    position: [number, number];
    title: string;
    description?: string;
  }>;
  onLocationSelect?: (lat: number, lng: number) => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  selectable?: boolean;
  height?: string;
  onMapReady?: (getCenter: () => { lat: number; lng: number }) => void;
}

const LocationPicker: React.FC<{ 
  onLocationSelect: (lat: number, lng: number) => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
}> = ({ onLocationSelect, onLongPressStart, onLongPressEnd }) => {
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);

  useMapEvents({
    // Para computadora - clic normal
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    },
    
    // Para móvil - inicio del toque
    mousedown: (e: any) => {
      setTouchStartTime(Date.now());
      setIsLongPressing(false);
      
      const timer = setTimeout(() => {
        setIsLongPressing(true);
        onLongPressStart?.();
        const { lat, lng } = e.latlng;
        onLocationSelect(lat, lng);
      }, 3000); // 3 segundos
      setLongPressTimer(timer);
    },
    
    // Para móvil - fin del toque
    mouseup: (e: any) => {
      const touchDuration = Date.now() - touchStartTime;
      
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      
      // Si fue un toque corto (menos de 3 segundos), seleccionar inmediatamente
      if (touchDuration < 3000 && touchDuration > 100) {
        const { lat, lng } = e.latlng;
        onLocationSelect(lat, lng);
      }
      
      setIsLongPressing(false);
      onLongPressEnd?.();
    }
  });
  
  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({
  center,
  zoom = 13,
  markers = [],
  onLocationSelect,
  onLongPressStart,
  onLongPressEnd,
  selectable = false,
  height = '400px',
  onMapReady
}) => {
  // Calcular centro automático basado en marcadores
  const calculateCenter = (): [number, number] => {
    if (markers.length === 0) {
      // Si no hay marcadores, usar centro por defecto o el centro proporcionado
      return center || [3.4516, -76.5320]; // Colombia por defecto
    }
    
    if (markers.length === 1) {
      // Si hay solo un marcador, centrar en él
      return markers[0].position;
    }
    
    // Si hay múltiples marcadores, calcular el centro promedio
    const avgLat = markers.reduce((sum, marker) => sum + marker.position[0], 0) / markers.length;
    const avgLng = markers.reduce((sum, marker) => sum + marker.position[1], 0) / markers.length;
    
    return [avgLat, avgLng];
  };

  const [mapCenter, setMapCenter] = useState<[number, number]>(calculateCenter());
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Actualizar centro cuando cambien los marcadores
  useEffect(() => {
    const newCenter = calculateCenter();
    setMapCenter(newCenter);
  }, [markers, center]);

  useEffect(() => {
    if (mapInstance && onMapReady) {
      onMapReady(() => {
        const center = mapInstance.getCenter();
        return { lat: center.lat, lng: center.lng };
      });
    }
  }, [mapInstance]); // Remover onMapReady de las dependencias

  // Auto-fit para mostrar todos los marcadores
  useEffect(() => {
    if (mapInstance && markers.length > 0) {
      const group = new L.FeatureGroup();
      markers.forEach(marker => {
        group.addLayer(L.marker(marker.position));
      });
      
      mapInstance.fitBounds(group.getBounds().pad(0.1)); // 10% de padding
    }
  }, [mapInstance, markers]);

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-300">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        touchZoom={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        dragging={true}
        zoomControl={true}
        ref={setMapInstance}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {selectable && onLocationSelect && (
          <LocationPicker 
            onLocationSelect={onLocationSelect}
            onLongPressStart={onLongPressStart}
            onLongPressEnd={onLongPressEnd}
          />
        )}
        
        {markers.map((marker) => {
          // Crear icono especial para ubicación GPS actual
          const isCurrentLocation = marker.id === 'current-location';
          const customIcon = isCurrentLocation ? L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              background-color: #3b82f6;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              animation: pulse 2s infinite;
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          }) : createCustomIcon();

          return (
            <Marker key={marker.id} position={marker.position} icon={customIcon}>
              <Popup>
                <div>
                  <h3 className="font-semibold text-gray-900">{marker.title}</h3>
                  {marker.description && (
                    <p className="text-gray-600 text-sm mt-1">{marker.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapComponent;

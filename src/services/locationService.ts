// Servicio para manejo de ubicación y geocoding
export interface CityInfo {
  city: string;
  state: string;
  country: string;
  fullAddress: string;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

class LocationService {
  private userCity: CityInfo | null = null;
  private userLocation: LocationCoordinates | null = null;

  /**
   * Obtiene la ubicación GPS del usuario
   */
  async getCurrentLocation(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La geolocalización no está soportada por este navegador.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.userLocation = location;
          resolve(location);
        },
        (error) => {
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
          
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        }
      );
    });
  }

  /**
   * Convierte coordenadas a información de ciudad usando geocoding inverso
   */
  async getCityFromCoordinates(lat: number, lng: number): Promise<CityInfo> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es`
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener información de la ciudad');
      }
      
      const data = await response.json();
      
      if (!data.address) {
        throw new Error('No se pudo determinar la ciudad');
      }

      const address = data.address;
      const cityInfo: CityInfo = {
        city: address.city || address.town || address.village || address.municipality || 'Ciudad desconocida',
        state: address.state || address.region || 'Estado desconocido',
        country: address.country || 'País desconocido',
        fullAddress: data.display_name || `${address.city}, ${address.state}`
      };

      return cityInfo;
    } catch (error) {
      console.error('Error en geocoding inverso:', error);
      throw new Error('No se pudo determinar la ciudad desde las coordenadas');
    }
  }

  /**
   * Detecta automáticamente la ciudad del usuario
   */
  async detectUserCity(): Promise<CityInfo> {
    try {
      // Si ya tenemos la ciudad guardada, la devolvemos
      if (this.userCity) {
        return this.userCity;
      }

      // Obtener ubicación GPS
      const location = await this.getCurrentLocation();
      
      // Convertir a información de ciudad
      const cityInfo = await this.getCityFromCoordinates(location.lat, location.lng);
      
      // Guardar para futuras consultas
      this.userCity = cityInfo;
      
      console.log('Ciudad detectada:', cityInfo);
      return cityInfo;
    } catch (error) {
      console.error('Error detectando ciudad:', error);
      // Fallback a Cali si no se puede detectar
      const fallbackCity: CityInfo = {
        city: 'Cali',
        state: 'Valle del Cauca',
        country: 'Colombia',
        fullAddress: 'Cali, Valle del Cauca, Colombia'
      };
      
      this.userCity = fallbackCity;
      return fallbackCity;
    }
  }

  /**
   * Busca una dirección usando la ciudad detectada como contexto
   */
  async searchAddress(address: string): Promise<{ lat: number; lng: number; displayName: string }> {
    try {
      // Obtener ciudad del usuario
      const cityInfo = await this.detectUserCity();
      
      // Intentar múltiples estrategias de búsqueda
      const searchStrategies = [
        // Estrategia 1: Dirección completa con ciudad
        `${address}, ${cityInfo.city}, ${cityInfo.state}, Colombia`,
        // Estrategia 2: Solo dirección con ciudad
        `${address}, ${cityInfo.city}, Colombia`,
        // Estrategia 3: Solo dirección con estado
        `${address}, ${cityInfo.state}, Colombia`,
        // Estrategia 4: Solo dirección
        `${address}, Colombia`
      ];
      
      for (const searchQuery of searchStrategies) {
        console.log('Intentando búsqueda:', searchQuery);
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=3&addressdetails=1&accept-language=es&countrycodes=co`
          );
          
          if (!response.ok) {
            console.log('Error en respuesta:', response.status);
            continue;
          }
          
          const data = await response.json();
          
          if (data.length > 0) {
            const result = data[0];
            console.log('Dirección encontrada:', result.display_name);
            return {
              lat: parseFloat(result.lat),
              lng: parseFloat(result.lon),
              displayName: result.display_name
            };
          }
        } catch (searchError) {
          console.log('Error en búsqueda específica:', searchError);
          continue;
        }
      }
      
      // Si ninguna estrategia funcionó
      throw new Error('Dirección no encontrada. Intenta con una dirección más específica o verifica que esté en Colombia.');
    } catch (error) {
      console.error('Error buscando dirección:', error);
      throw error;
    }
  }

  /**
   * Obtiene la ciudad actual del usuario (sin hacer nueva detección)
   */
  getCurrentCity(): CityInfo | null {
    return this.userCity;
  }

  /**
   * Obtiene la ubicación actual del usuario (sin hacer nueva detección)
   */
  getCurrentLocationCached(): LocationCoordinates | null {
    return this.userLocation;
  }

  /**
   * Búsqueda simple de dirección sin contexto de ciudad (fallback)
   */
  async searchAddressSimple(address: string): Promise<{ lat: number; lng: number; displayName: string }> {
    try {
      console.log('Búsqueda simple:', address);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1&accept-language=es&countrycodes=co`
      );
      
      if (!response.ok) {
        throw new Error('Error al buscar la dirección');
      }
      
      const data = await response.json();
      
      if (data.length === 0) {
        throw new Error('Dirección no encontrada.');
      }
      
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name
      };
    } catch (error) {
      console.error('Error en búsqueda simple:', error);
      throw error;
    }
  }

  /**
   * Limpia la información guardada (útil para testing o cambio de ubicación)
   */
  clearCache(): void {
    this.userCity = null;
    this.userLocation = null;
  }
}

// Instancia singleton del servicio
export const locationService = new LocationService();

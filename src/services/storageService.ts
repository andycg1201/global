import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  getMetadata
} from 'firebase/storage';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteField 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const storage = getStorage();

export interface FotoInstalacion {
  url: string;
  fechaSubida: Date;
  pedidoId: string;
  lavadoraCodigo: string;
}

export const storageService = {
  // Subir foto de instalación
  async subirFotoInstalacion(
    file: File, 
    pedidoId: string, 
    lavadoraCodigo: string
  ): Promise<string> {
    try {
      // Verificar si estamos en desarrollo local o dispositivo móvil
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isMobile = isMobileDevice();
      
      if (isLocalhost || isMobile) {
        console.log('🏠 storageService: Modo desarrollo o móvil - usando base64 comprimido');
        // En desarrollo o móvil, comprimir y convertir a base64
        const compressedFile = await comprimirImagen(file);
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            console.log('✅ storageService: Base64 comprimido generado, tamaño:', base64.length);
            resolve(base64);
          };
          reader.readAsDataURL(compressedFile);
        });
      }
      
      console.log('🔄 storageService: Iniciando compresión de imagen...');
      // En desktop, comprimir y subir a Firebase Storage
      const compressedFile = await comprimirImagen(file);
      console.log('✅ storageService: Imagen comprimida');
      
      // Crear referencia única
      const timestamp = Date.now();
      const fileName = `instalaciones/${pedidoId}_${lavadoraCodigo}_${timestamp}.jpg`;
      const storageRef = ref(storage, fileName);
      console.log('📁 storageService: Referencia creada:', fileName);
      
      // Subir archivo
      console.log('📤 storageService: Subiendo archivo...');
      const snapshot = await uploadBytes(storageRef, compressedFile);
      console.log('✅ storageService: Archivo subido');
      
      // Obtener URL de descarga
      console.log('🔗 storageService: Obteniendo URL de descarga...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('✅ storageService: URL obtenida:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('❌ storageService: Error al subir foto:', error);
      
      // Fallback a base64 si hay error
      console.log('🔄 storageService: Usando fallback base64...');
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          console.log('✅ storageService: Fallback base64 generado');
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });
    }
  },

  // Eliminar foto de instalación
  async eliminarFotoInstalacion(url: string): Promise<void> {
    try {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
      console.log('✅ Foto eliminada exitosamente');
    } catch (error) {
      console.error('❌ Error al eliminar foto:', error);
      // No lanzar error si el archivo ya no existe
    }
  },

  // Eliminar fotos antiguas (más de 30 días)
  async eliminarFotosAntiguas(): Promise<number> {
    try {
      // En desarrollo local, no intentar eliminar fotos para evitar errores de CORS
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        console.log('🔧 Modo desarrollo: no se pueden eliminar fotos antiguas');
        return 0;
      }

      const fotosEliminadas: string[] = [];
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 30); // 30 días atrás

      // Obtener todas las fotos de instalaciones
      const instalacionesRef = ref(storage, 'instalaciones');
      const listResult = await listAll(instalacionesRef);

      for (const itemRef of listResult.items) {
        try {
          const metadata = await getMetadata(itemRef);
          const fechaCreacion = new Date(metadata.timeCreated);
          
          if (fechaCreacion < fechaLimite) {
            await deleteObject(itemRef);
            fotosEliminadas.push(itemRef.fullPath);
            console.log('🗑️ Foto antigua eliminada:', itemRef.name);
          }
        } catch (error) {
          console.error('Error al procesar foto:', itemRef.name, error);
        }
      }

      // Limpiar referencias en Firestore
      await limpiarReferenciasFirestore(fotosEliminadas);

      console.log(`✅ Eliminadas ${fotosEliminadas.length} fotos antiguas`);
      return fotosEliminadas.length;
    } catch (error) {
      console.error('❌ Error al eliminar fotos antiguas:', error);
      return 0;
    }
  },

  // Obtener estadísticas de almacenamiento
  async obtenerEstadisticas(): Promise<{
    totalFotos: number;
    tamañoTotal: number;
    fotosAntiguas: number;
  }> {
    try {
      // En desarrollo local, retornar valores por defecto para evitar errores de CORS
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        console.log('🔧 Modo desarrollo: retornando estadísticas por defecto');
        return {
          totalFotos: 0,
          tamañoTotal: 0,
          fotosAntiguas: 0
        };
      }

      const instalacionesRef = ref(storage, 'instalaciones');
      const listResult = await listAll(instalacionesRef);
      
      let tamañoTotal = 0;
      let fotosAntiguas = 0;
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 30);

      for (const itemRef of listResult.items) {
        try {
          const metadata = await getMetadata(itemRef);
          tamañoTotal += metadata.size;
          
          const fechaCreacion = new Date(metadata.timeCreated);
          if (fechaCreacion < fechaLimite) {
            fotosAntiguas++;
          }
        } catch (error) {
          console.error('Error al obtener metadata:', itemRef.name, error);
        }
      }

      return {
        totalFotos: listResult.items.length,
        tamañoTotal,
        fotosAntiguas
      };
    } catch (error) {
      console.error('❌ Error al obtener estadísticas:', error);
      // En caso de error (incluyendo CORS), retornar valores por defecto
      return { totalFotos: 0, tamañoTotal: 0, fotosAntiguas: 0 };
    }
  }
};

// Función para detectar si es dispositivo móvil
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768;
}

// Función para comprimir imágenes
async function comprimirImagen(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    console.log('🔄 comprimirImagen: Iniciando compresión de', file.name, file.size, 'bytes');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Timeout más corto para móviles (5 segundos)
    const timeoutDuration = isMobileDevice() ? 5000 : 10000;
    const timeoutId = setTimeout(() => {
      console.error('⏰ comprimirImagen: Timeout en compresión');
      // En caso de timeout, devolver archivo original
      resolve(file);
    }, timeoutDuration);
    
    img.onload = () => {
      console.log('🖼️ comprimirImagen: Imagen cargada, dimensiones originales:', img.width, 'x', img.height);
      
      // Configuración más agresiva para móviles
      const isMobile = isMobileDevice();
      const maxWidth = isMobile ? 400 : 800;  // Más pequeño en móviles
      const maxHeight = isMobile ? 300 : 600; // Más pequeño en móviles
      const quality = isMobile ? 0.5 : 0.7;   // Más compresión en móviles
      
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      console.log('📐 comprimirImagen: Nuevas dimensiones:', width, 'x', height, 'Calidad:', quality);
      
      canvas.width = width;
      canvas.height = height;
      
      // Dibujar la imagen redimensionada
      ctx?.drawImage(img, 0, 0, width, height);
      console.log('🎨 comprimirImagen: Imagen dibujada en canvas');
      
      // Convertir a blob con compresión
      canvas.toBlob((blob) => {
        clearTimeout(timeoutId);
        
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          console.log('✅ comprimirImagen: Compresión completada, nuevo tamaño:', compressedFile.size, 'bytes');
          
          // Si sigue siendo muy grande, intentar con calidad aún menor
          if (compressedFile.size > 800000 && quality > 0.3) { // Más de 800KB
            console.log('🔄 comprimirImagen: Archivo aún muy grande, re-comprimiendo con calidad menor...');
            canvas.toBlob((smallerBlob) => {
              if (smallerBlob) {
                const smallerFile = new File([smallerBlob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                console.log('✅ comprimirImagen: Re-compresión completada, nuevo tamaño:', smallerFile.size, 'bytes');
                resolve(smallerFile);
              } else {
                resolve(compressedFile);
              }
            }, 'image/jpeg', 0.3);
          } else {
            resolve(compressedFile);
          }
        } else {
          console.error('❌ comprimirImagen: Error al crear blob - usando archivo original');
          resolve(file);
        }
      }, 'image/jpeg', quality);
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      console.error('❌ comprimirImagen: Error al cargar imagen - usando archivo original');
      resolve(file);
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Función para limpiar referencias en Firestore
async function limpiarReferenciasFirestore(fotosEliminadas: string[]): Promise<void> {
  try {
    // Buscar pedidos que tengan estas fotos
    const pedidosRef = collection(db, 'pedidos');
    const pedidosSnapshot = await getDocs(pedidosRef);
    
    for (const pedidoDoc of pedidosSnapshot.docs) {
      const pedidoData = pedidoDoc.data();
      let necesitaActualizacion = false;
      const updateData: any = {};
      
      // Verificar si tiene foto de instalación que fue eliminada
      if (pedidoData.validacionQR_fotoInstalacion) {
        const fotoUrl = pedidoData.validacionQR_fotoInstalacion;
        if (fotosEliminadas.some(foto => fotoUrl.includes(foto))) {
          updateData.validacionQR_fotoInstalacion = deleteField();
          necesitaActualizacion = true;
        }
      }
      
      // Verificar lavadoraAsignada_fotoInstalacion
      if (pedidoData.lavadoraAsignada_fotoInstalacion) {
        const fotoUrl = pedidoData.lavadoraAsignada_fotoInstalacion;
        if (fotosEliminadas.some(foto => fotoUrl.includes(foto))) {
          updateData.lavadoraAsignada_fotoInstalacion = deleteField();
          necesitaActualizacion = true;
        }
      }
      
      if (necesitaActualizacion) {
        await updateDoc(doc(db, 'pedidos', pedidoDoc.id), updateData);
        console.log('🧹 Referencias limpiadas en pedido:', pedidoDoc.id);
      }
    }
  } catch (error) {
    console.error('❌ Error al limpiar referencias:', error);
  }
}

// Función para ejecutar limpieza automática (llamar desde un cron job o manualmente)
export const ejecutarLimpiezaAutomatica = async (): Promise<void> => {
  try {
    console.log('🧹 Iniciando limpieza automática de fotos...');
    const fotosEliminadas = await storageService.eliminarFotosAntiguas();
    
    if (fotosEliminadas > 0) {
      console.log(`✅ Limpieza completada: ${fotosEliminadas} fotos eliminadas`);
    } else {
      console.log('✅ No hay fotos antiguas para eliminar');
    }
  } catch (error) {
    console.error('❌ Error en limpieza automática:', error);
  }
};

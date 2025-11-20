import React, { useState } from 'react';
import { XMarkIcon, CameraIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { formatDate } from '../utils/dateUtils';
import { configService } from '../services/firebaseService';

// Plantilla por defecto del mensaje de WhatsApp
const PLANTILLA_MENSAJE_WHATSAPP_DEFECTO = `*¡Lavadora entregada!* ✅

📅 *Fecha:* {FECHA_ENTREGA}
🕐 *Hora:* {HORA_ENTREGA}

📋 *Detalles del servicio:*
• {DESCRIPCION_PLAN}
• Dirección: {DIRECCION}

⏰ *Recogida programada:*
📅 Fecha: {FECHA_RECOGIDA}
🕐 Hora: {HORA_RECOGIDA}

💰 *¿Necesitas más tiempo?*
• Hora adicional: {PRECIO_HORA_ADICIONAL}
• Confirma con anticipación
• Contacto: {TELEFONO_CONTACTO}

Muchas gracias por utilizar nuestros servicios
LAVADORAS GLOBAL`;

interface ModalWhatsAppProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido | null;
  fotoEvidencia?: string; // URL de la foto de evidencia
}

const ModalWhatsApp: React.FC<ModalWhatsAppProps> = ({ isOpen, onClose, pedido, fotoEvidencia }) => {
  const [horaRecogida, setHoraRecogida] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mensajeEditable, setMensajeEditable] = useState<string>('');
  const [telefonoContacto, setTelefonoContacto] = useState<string>('+573105988735'); // Valor por defecto
  const [horaAdicional, setHoraAdicional] = useState<number>(2000); // Valor por defecto
  const [plantillaMensaje, setPlantillaMensaje] = useState<string>(''); // Plantilla desde configuración

  React.useEffect(() => {
    if (pedido && isOpen) {
      // Cargar configuración
      const cargarConfiguracion = async () => {
        try {
          const config = await configService.getConfiguracion();
          if (config) {
            setTelefonoContacto(config.telefonoContacto || '+573105988735');
            setHoraAdicional(config.horaAdicional || 2000);
            setPlantillaMensaje(config.plantillaMensajeWhatsApp || PLANTILLA_MENSAJE_WHATSAPP_DEFECTO);
          } else {
            // Si no hay configuración, usar valores por defecto
            setPlantillaMensaje(PLANTILLA_MENSAJE_WHATSAPP_DEFECTO);
          }
        } catch (error) {
          console.error('Error al cargar configuración:', error);
          // En caso de error, usar plantilla por defecto
          setPlantillaMensaje(PLANTILLA_MENSAJE_WHATSAPP_DEFECTO);
        }
      };
      cargarConfiguracion();

      // Calcular hora de recogida según el plan
      const horaRecogidaCalculada = calcularHoraRecogida(pedido);
      setHoraRecogida(horaRecogidaCalculada);
      
      // Pre-cargar la foto de evidencia si está disponible
      if (fotoEvidencia) {
        setFotoUrl(fotoEvidencia);
        setFotoPreview(fotoEvidencia);
        console.log('📸 Foto de evidencia pre-cargada:', fotoEvidencia);
      }
    } else {
      // Limpiar cuando se cierra el modal
      setMensajeEditable('');
      setHoraRecogida('');
    }
  }, [pedido, isOpen, fotoEvidencia]);

  // Actualizar mensaje cuando cambie la hora de recogida o la configuración
  React.useEffect(() => {
    if (pedido) {
      setMensajeEditable(generarMensaje());
    }
  }, [horaRecogida, pedido, telefonoContacto, horaAdicional, plantillaMensaje]);

  // Función para calcular fecha y hora de recogida correctamente
  const calcularFechaHoraRecogida = (fechaEntrega: Date, planName: string): Date => {
    const fecha = new Date(fechaEntrega);
    
    if (planName === 'PLAN 1') {
      // PLAN 1: Recogida 5 horas después de la entrega
      fecha.setHours(fecha.getHours() + 5);
      return fecha;
    } else if (planName === 'PLAN 2') {
      // PLAN 2: Recogida día siguiente a las 7 AM
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(7, 0, 0, 0);
      return fecha;
    } else if (planName === 'PLAN 3') {
      // PLAN 3: Recogida 24 horas después
      fecha.setHours(fecha.getHours() + 24);
      return fecha;
    } else if (planName === 'PLAN 4') {
      // PLAN 4: Recogida lunes a las 7 AM
      const diasHastaLunes = (1 + 7 - fecha.getDay()) % 7 || 7;
      fecha.setDate(fecha.getDate() + diasHastaLunes);
      fecha.setHours(7, 0, 0, 0);
      return fecha;
    } else if (planName === 'PLAN 5') {
      // PLAN 5: Recogida lunes a las 7 AM
      const diasHastaLunes = (1 + 7 - fecha.getDay()) % 7 || 7;
      fecha.setDate(fecha.getDate() + diasHastaLunes);
      fecha.setHours(7, 0, 0, 0);
      return fecha;
    }
    
    return fecha;
  };

  // Función para obtener descripción del plan
  const obtenerDescripcionPlan = (planName: string): string => {
    switch (planName) {
      case 'PLAN 1':
        return 'Servicio 5 horas diurnas';
      case 'PLAN 2':
        return 'Servicio nocturno';
      case 'PLAN 3':
        return 'Servicio 24 horas';
      case 'PLAN 4':
        return 'Promoción fin de semana diurno';
      case 'PLAN 5':
        return 'Promoción fin de semana nocturno';
      default:
        return planName;
    }
  };

  const calcularHoraRecogida = (pedido: Pedido): string => {
    if (!pedido.fechaEntrega) return '';
    
    // Usar la misma lógica que calcularFechaHoraRecogida pero con la fecha actual
    const fechaActual = new Date();
    const fechaHoraRecogida = calcularFechaHoraRecogida(fechaActual, pedido.plan.name);
    return formatDate(fechaHoraRecogida, 'HH:mm');
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Comprimir imagen
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Redimensionar a máximo 800px de ancho
          const maxWidth = 800;
          const maxHeight = 600;
          let { width, height } = img;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              setFoto(compressedFile);
              setFotoPreview(URL.createObjectURL(compressedFile));
            }
          }, 'image/jpeg', 0.8); // 80% de calidad
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const subirFoto = async (): Promise<string | null> => {
    if (!foto) return null;
    
    setIsUploading(true);
    try {
      const { uploadBytes, ref, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../lib/firebase');
      
      const timestamp = Date.now();
      const fileName = `evidencias/${pedido?.id}_${timestamp}.jpg`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, foto);
      const url = await getDownloadURL(storageRef);
      
      setFotoUrl(url);
      return url;
    } catch (error) {
      console.error('Error subiendo foto:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const generarMensaje = (): string => {
    if (!pedido) return '';
    
    // Usar la fecha actual como fecha de entrega real
    const fechaActual = new Date();
    const fechaEntrega = formatDate(fechaActual, 'dd/MM/yyyy');
    const horaEntrega = formatDate(fechaActual, 'HH:mm');
    
    // Usar la hora personalizada del input si está disponible, sino calcular automáticamente
    let fechaRecogida: string;
    let horaRecogidaTexto: string;
    
    if (horaRecogida && horaRecogida.trim() !== '') {
      // Usar la hora personalizada del usuario
      const fechaHoraRecogida = calcularFechaHoraRecogida(fechaActual, pedido.plan.name);
      fechaRecogida = formatDate(fechaHoraRecogida, 'dd/MM/yyyy');
      horaRecogidaTexto = horaRecogida; // Usar la hora del input
    } else {
      // Calcular fecha y hora de recogida automáticamente
      const fechaHoraRecogida = calcularFechaHoraRecogida(fechaActual, pedido.plan.name);
      fechaRecogida = formatDate(fechaHoraRecogida, 'dd/MM/yyyy');
      horaRecogidaTexto = formatDate(fechaHoraRecogida, 'HH:mm');
    }
    
    // Obtener descripción del plan
    const descripcionPlan = obtenerDescripcionPlan(pedido.plan.name);
    
    // Formatear precio de hora adicional
    const precioFormateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(horaAdicional);
    
    // Usar plantilla desde configuración o la por defecto
    const plantilla = plantillaMensaje.trim() || PLANTILLA_MENSAJE_WHATSAPP_DEFECTO;
    
    // Reemplazar variables en la plantilla
    let mensaje = plantilla
      .replace(/{NOMBRE_CLIENTE}/g, pedido.cliente.name)
      .replace(/{FECHA_ENTREGA}/g, fechaEntrega)
      .replace(/{HORA_ENTREGA}/g, horaEntrega)
      .replace(/{FECHA_RECOGIDA}/g, fechaRecogida)
      .replace(/{HORA_RECOGIDA}/g, horaRecogidaTexto)
      .replace(/{DESCRIPCION_PLAN}/g, descripcionPlan)
      .replace(/{DIRECCION}/g, pedido.cliente.address)
      .replace(/{PRECIO_HORA_ADICIONAL}/g, precioFormateado)
      .replace(/{TELEFONO_CONTACTO}/g, telefonoContacto);
    
    return mensaje;
  };

  const abrirWhatsApp = async () => {
    if (!pedido) return;
    
    // Usar el mensaje editable
    const mensaje = mensajeEditable;
    
    // Abrir WhatsApp
    const numero = pedido.cliente.phone.replace(/\D/g, ''); // Solo números
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    onClose();
  };

  if (!isOpen || !pedido) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            📱 Notificación WhatsApp
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Información del cliente */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Cliente:</h4>
            <p className="text-sm text-gray-600">{pedido.cliente.name}</p>
            <p className="text-sm text-gray-600">{pedido.cliente.phone}</p>
          </div>

          {/* Hora de recogida editable (opcional, también se puede editar en el mensaje) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hora de Recogida Programada
            </label>
            <input
              type="time"
              value={horaRecogida}
              onChange={(e) => setHoraRecogida(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Al cambiar la hora, el mensaje se actualizará automáticamente. Puedes editarlo después.
            </p>
          </div>

          {/* Mensaje editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje que se enviará (editable):
            </label>
            <textarea
              value={mensajeEditable}
              onChange={(e) => setMensajeEditable(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono resize-y"
              placeholder="El mensaje se generará automáticamente..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Puedes editar completamente el mensaje antes de enviarlo. La plantilla se carga automáticamente.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 p-4 sm:p-6 border-t">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={abrirWhatsApp}
            disabled={isUploading}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center font-medium"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Subiendo...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                Abrir WhatsApp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalWhatsApp;

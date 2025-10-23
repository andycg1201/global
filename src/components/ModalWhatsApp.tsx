import React, { useState } from 'react';
import { XMarkIcon, CameraIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Pedido } from '../types';
import { formatDate } from '../utils/dateUtils';

interface ModalWhatsAppProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido | null;
}

const ModalWhatsApp: React.FC<ModalWhatsAppProps> = ({ isOpen, onClose, pedido }) => {
  const [horaRecogida, setHoraRecogida] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    if (pedido && isOpen) {
      // Calcular hora de recogida según el plan
      const horaRecogidaCalculada = calcularHoraRecogida(pedido);
      setHoraRecogida(horaRecogidaCalculada);
    }
  }, [pedido, isOpen]);

  const calcularHoraRecogida = (pedido: Pedido): string => {
    if (!pedido.fechaEntrega) return '';
    
    const planName = pedido.plan.name;
    const fechaEntrega = pedido.fechaEntrega;
    
    if (planName === 'PLAN 1') {
      // PLAN 1: Recogida mismo día a las 2:15 PM
      const recogida = new Date(fechaEntrega);
      recogida.setHours(14, 15, 0, 0);
      return formatDate(recogida, 'HH:mm');
    } else if (planName === 'PLAN 2') {
      // PLAN 2: Recogida día siguiente a las 7 AM
      const recogida = new Date(fechaEntrega);
      recogida.setDate(recogida.getDate() + 1);
      recogida.setHours(7, 0, 0, 0);
      return formatDate(recogida, 'HH:mm');
    } else if (planName === 'PLAN 3') {
      // PLAN 3: 24 horas exactas
      const recogida = new Date(fechaEntrega);
      recogida.setHours(recogida.getHours() + 24);
      return formatDate(recogida, 'HH:mm');
    } else if (planName === 'PLAN 4') {
      // PLAN 4: Fin de semana, recogida lunes 7 AM
      const recogida = new Date(fechaEntrega);
      // Encontrar el próximo lunes
      const diasHastaLunes = (1 - recogida.getDay() + 7) % 7;
      recogida.setDate(recogida.getDate() + diasHastaLunes);
      recogida.setHours(7, 0, 0, 0);
      return formatDate(recogida, 'HH:mm');
    } else if (planName === 'PLAN 5') {
      // PLAN 5: Sábado tarde, recogida lunes 7 AM
      const recogida = new Date(fechaEntrega);
      // Encontrar el próximo lunes
      const diasHastaLunes = (1 - recogida.getDay() + 7) % 7;
      recogida.setDate(recogida.getDate() + diasHastaLunes);
      recogida.setHours(7, 0, 0, 0);
      return formatDate(recogida, 'HH:mm');
    }
    
    return formatDate(fechaEntrega, 'HH:mm');
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
    
    const fechaEntrega = formatDate(pedido.fechaEntrega!, 'dd/MM/yyyy');
    const horaEntrega = formatDate(pedido.fechaEntrega!, 'HH:mm');
    const fechaRecogida = formatDate(pedido.fechaEntrega!, 'dd/MM/yyyy');
    
    let mensaje = `*¡Lavadora entregada!* ✅\n\n`;
    mensaje += `📅 *Fecha:* ${fechaEntrega}\n`;
    mensaje += `🕐 *Hora:* ${horaEntrega}\n\n`;
    mensaje += `📋 *Detalles del servicio:*\n`;
    mensaje += `• Plan: ${pedido.plan.name}\n`;
    mensaje += `• Dirección: ${pedido.cliente.address}\n`;
    mensaje += `• Lavadora: ${pedido.lavadoraAsignada}\n\n`;
    mensaje += `⏰ *Recogida programada:*\n`;
    mensaje += `📅 Fecha: ${fechaRecogida}\n`;
    mensaje += `🕐 Hora: ${horaRecogida}\n\n`;
    mensaje += `💰 *¿Necesitas más tiempo?*\n`;
    mensaje += `• Hora adicional: $2,000\n`;
    mensaje += `• Confirma con anticipación\n`;
    mensaje += `• Contacto: +573005254876\n\n`;
    mensaje += `Muchas gracias por utilizar nuestros servicios\n`;
    mensaje += `LAVADORAS GLOBAL`;
    
    return mensaje;
  };

  const abrirWhatsApp = async () => {
    if (!pedido) return;
    
    // Subir foto si existe
    let fotoUrlFinal = fotoUrl;
    if (foto && !fotoUrl) {
      fotoUrlFinal = await subirFoto();
    }
    
    // Generar mensaje
    const mensaje = generarMensaje();
    
    // Agregar foto al mensaje si existe
    let mensajeFinal = mensaje;
    if (fotoUrlFinal) {
      mensajeFinal += `\n\n📸 *Evidencia de instalación:*\n${fotoUrlFinal}`;
    }
    
    // Abrir WhatsApp
    const numero = pedido.cliente.phone.replace(/\D/g, ''); // Solo números
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensajeFinal)}`;
    window.open(url, '_blank');
    
    onClose();
  };

  if (!isOpen || !pedido) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            📱 Notificación WhatsApp
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Información del cliente */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Cliente:</h4>
            <p className="text-sm text-gray-600">{pedido.cliente.name}</p>
            <p className="text-sm text-gray-600">{pedido.cliente.phone}</p>
          </div>

          {/* Hora de recogida editable */}
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
          </div>

          {/* Subir foto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📸 Foto de Evidencia (Obligatoria)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {fotoPreview && (
              <div className="mt-2">
                <img
                  src={fotoPreview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-md"
                />
              </div>
            )}
          </div>

          {/* Preview del mensaje */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje que se enviará:
            </label>
            <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 max-h-32 overflow-y-auto">
              {generarMensaje()}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={abrirWhatsApp}
            disabled={!foto || isUploading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
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

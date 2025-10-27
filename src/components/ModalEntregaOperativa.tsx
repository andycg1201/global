import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, QrCodeIcon, CameraIcon } from '@heroicons/react/24/outline';
import { Pedido, Lavadora } from '../types';
import { storageService } from '../services/storageService';

// Usaremos html5-qrcode para escanear con la cámara
// Se importa de forma dinámica para evitar problemas en SSR/build si no existe window
let Html5Qrcode: any;

interface ModalEntregaOperativaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entregaData: {
    lavadoraEscaneada: string;
    fotoInstalacion?: string;
    observacionesInstalacion?: string;
    recogidaPrioritaria?: boolean;
    horaRecogida?: string;
    observacionRecogida?: string;
  }) => void;
  pedido: Pedido;
  lavadoras: Lavadora[];
}

const ModalEntregaOperativa: React.FC<ModalEntregaOperativaProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
  lavadoras
}) => {
  const [lavadoraEscaneada, setLavadoraEscaneada] = useState<string>('');
  const [fotoInstalacion, setFotoInstalacion] = useState<string>('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [observacionesInstalacion, setObservacionesInstalacion] = useState<string>('');
  const [recogidaPrioritaria, setRecogidaPrioritaria] = useState<boolean>(false);
  const [horaRecogida, setHoraRecogida] = useState<string>('');
  const [observacionRecogida, setObservacionRecogida] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrRegionId = 'qr-reader-region';
  const html5QrCodeRef = useRef<any>(null);

  const handleClose = () => {
    stopScanner();
    setLavadoraEscaneada('');
    setFotoInstalacion('');
    setFotoFile(null);
    setObservacionesInstalacion('');
    setRecogidaPrioritaria(false);
    setHoraRecogida('');
    setObservacionRecogida('');
    setScanResult('');
    setError('');
    onClose();
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      }
    } catch {
      // noop
    } finally {
      setIsScanning(false);
    }
  };

  const startScanner = async () => {
    try {
      if (!Html5Qrcode) {
        const mod = await import('html5-qrcode');
        Html5Qrcode = mod.Html5Qrcode || (mod as any).default?.Html5Qrcode;
      }
      if (!Html5Qrcode) {
        alert('No se pudo inicializar el escáner QR');
        return;
      }
      
      // Primero establecer el estado para que se renderice el elemento
      setIsScanning(true);
      
      // Esperar un momento para que el DOM se actualice
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verificar que el elemento existe
      const element = document.getElementById(qrRegionId);
      if (!element) {
        alert('No se encontró el elemento para el escáner');
        setIsScanning(false);
        return;
      }
      
      const html5QrCode = new Html5Qrcode(qrRegionId);
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText: string) => {
          console.log('QR escaneado:', decodedText);
          
          // VALIDAR INMEDIATAMENTE cuando se escanea el QR
          const lavadoraExiste = lavadoras.find(l => l.codigoQR === decodedText);
          console.log('🔍 Debug ModalEntregaOperativa - Lavadora escaneada encontrada:', lavadoraExiste);
          
          if (!lavadoraExiste) {
            setError('La lavadora escaneada no existe en el sistema');
            stopScanner();
            return;
          }

          if (lavadoraExiste.estado !== 'disponible') {
            setError(`La lavadora ${decodedText} no está disponible para alquiler. Estado actual: ${lavadoraExiste.estado}. Por favor, escanea otra lavadora.`);
            stopScanner();
            return;
          }
          
          // Solo si está disponible, proceder
          setScanResult(decodedText);
          setLavadoraEscaneada(decodedText);
          stopScanner();
        },
        (error: string) => {
          // No mostrar errores de escaneo continuo
        }
      );
    } catch (err) {
      console.error('Error al iniciar scanner:', err);
      setError('Error al iniciar la cámara');
      setIsScanning(false);
    }
  };

  const handleFotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('📸 DEBUG - Foto tomada:', file.name);
      setFotoFile(file);
      
      try {
        // Subir la foto a Firebase Storage y obtener la URL
        const url = await storageService.subirFotoInstalacion(file, pedido.id, lavadoraEscaneada);
        setFotoInstalacion(url);
      } catch (error) {
        console.error('Error al subir la foto:', error);
        alert('Error al subir la foto');
        setFotoFile(null);
        setFotoInstalacion('');
      }
    }
  };

  const handleConfirmar = () => {
    console.log('🚨 DEBUG - handleConfirmar EJECUTÁNDOSE');
    console.log('🚨 DEBUG - lavadoraEscaneada:', lavadoraEscaneada);
    console.log('🚨 DEBUG - fotoFile:', fotoFile);
    
    if (!lavadoraEscaneada.trim()) {
      setError('Debe escanear el QR de la lavadora');
      return;
    }

    if (!fotoFile) {
      setError('Debe tomar una foto de la instalación como evidencia');
      return;
    }

    // La validación principal ya se hizo al escanear el QR

    onConfirm({
      lavadoraEscaneada,
      fotoInstalacion: fotoInstalacion || undefined,
      observacionesInstalacion: observacionesInstalacion || undefined,
      recogidaPrioritaria,
      horaRecogida: horaRecogida || undefined,
      observacionRecogida: observacionRecogida || undefined
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <QrCodeIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Entrega Operativa</h2>
              <p className="text-sm text-gray-600">Servicio: {pedido.cliente.name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del pedido */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Información del Servicio</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p><span className="font-medium">Cliente:</span> {pedido.cliente.name}</p>
                <p><span className="font-medium">Teléfono:</span> {pedido.cliente.phone}</p>
              </div>
              <div>
                <p><span className="font-medium">Plan:</span> {pedido.plan.name}</p>
                <p><span className="font-medium">Total:</span> {pedido.plan.price.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</p>
              </div>
            </div>
          </div>

          {/* Scanner QR */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escanear QR de la Lavadora
            </label>
            
            {!isScanning ? (
              <div className="space-y-4">
                <button
                  onClick={startScanner}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <QrCodeIcon className="h-5 w-5" />
                  <span>Iniciar Escaneo QR</span>
                </button>
                
                {scanResult && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">QR Escaneado:</span> {scanResult}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div id="qr-reader-region" className="w-full"></div>
                <button
                  onClick={stopScanner}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Detener Escaneo
                </button>
              </div>
            )}
          </div>

          {/* Foto de instalación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto de Instalación (Obligatoria)
            </label>
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                  fotoFile 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <CameraIcon className="h-5 w-5" />
                <span>
                  {fotoFile ? '✅ Foto Tomada' : '📸 Tomar Foto'}
                </span>
              </button>
              
              {fotoInstalacion && (
                <div className="space-y-2">
                  <p className="text-sm text-green-600 font-medium">✓ Foto capturada</p>
                  <img
                    src={fotoInstalacion}
                    alt="Foto de instalación"
                    className="w-full max-w-md h-48 object-cover rounded-lg border"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Observaciones de instalación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones de Instalación (Opcional)
            </label>
            <textarea
              value={observacionesInstalacion}
              onChange={(e) => setObservacionesInstalacion(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Detalles de la instalación..."
            />
          </div>

          {/* Recogida prioritaria */}
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="recogidaPrioritaria"
                checked={recogidaPrioritaria}
                onChange={(e) => setRecogidaPrioritaria(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="recogidaPrioritaria" className="ml-2 text-sm font-medium text-gray-700">
                Recogida Prioritaria
              </label>
            </div>
            
            {recogidaPrioritaria && (
              <div className="space-y-4 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de Recogida
                  </label>
                  <input
                    type="time"
                    value={horaRecogida}
                    onChange={(e) => setHoraRecogida(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones de Recogida
                  </label>
                  <textarea
                    value={observacionRecogida}
                    onChange={(e) => setObservacionRecogida(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                    placeholder="Instrucciones especiales para la recogida..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-4 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!lavadoraEscaneada.trim() || !fotoFile}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg transition-colors font-medium ${
              !lavadoraEscaneada.trim() || !fotoFile
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Confirmar Entrega
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalEntregaOperativa;

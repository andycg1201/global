import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, QrCodeIcon, CameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Pedido, Lavadora } from '../types';
// Usaremos html5-qrcode para escanear con la cámara
// Se importa de forma dinámica para evitar problemas en SSR/build si no existe window
let Html5Qrcode: any;

interface ModalValidacionQRProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (validacionData: {
    lavadoraEscaneada: string;
    cambioRealizado: boolean;
    fotoInstalacion?: string;
    observacionesValidacion?: string;
  }) => void;
  pedido: Pedido;
  lavadoras: Lavadora[];
}

const ModalValidacionQR: React.FC<ModalValidacionQRProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
  lavadoras
}) => {
  const [qrEscaneado, setQrEscaneado] = useState<string>('');
  const [fotoInstalacion, setFotoInstalacion] = useState<string>('');
  const [observacionesValidacion, setObservacionesValidacion] = useState<string>('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false);
  const [cambioDetectado, setCambioDetectado] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const qrRegionId = 'qr-reader-region';
  const html5QrCodeRef = useRef<any>(null);

  if (!isOpen) return null;

  const lavadoraOriginal = pedido.lavadoraAsignada?.codigoQR || '';
  const lavadoraOriginalData = lavadoras.find(l => l.codigoQR === lavadoraOriginal);
  const lavadoraEscaneadaData = lavadoras.find(l => l.codigoQR === qrEscaneado);

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
        alert('Error: No se pudo encontrar el elemento del escáner');
        setIsScanning(false);
        return;
      }
      
      const instance = new Html5Qrcode(qrRegionId);
      html5QrCodeRef.current = instance;
      
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const code = decodedText.trim();
          setQrEscaneado(code);
          if (code !== lavadoraOriginal) {
            setCambioDetectado(true);
            setMostrarConfirmacion(true);
          }
          stopScanner();
        },
        () => {}
      );
    } catch (e) {
      console.error('Error al iniciar escáner QR', e);
      alert('No se pudo acceder a la cámara. Verifica permisos HTTPS y otorgar acceso.');
      setIsScanning(false);
    }
  };

  const handleFotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Comprimir la imagen antes de guardarla
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Redimensionar la imagen para que sea más pequeña
        const maxWidth = 800;
        const maxHeight = 600;
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
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar la imagen redimensionada
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convertir a base64 con calidad reducida
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFotoInstalacion(compressedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    }
  };

  const handleConfirmarCambio = () => {
    setMostrarConfirmacion(false);
  };

  const handleConfirmar = () => {
    if (!qrEscaneado) {
      alert('Debe escanear el código QR de la lavadora');
      return;
    }

    if (!fotoInstalacion) {
      alert('Debe tomar una foto de la instalación');
      return;
    }

    onConfirm({
      lavadoraEscaneada: qrEscaneado,
      cambioRealizado: cambioDetectado,
      fotoInstalacion,
      observacionesValidacion
    });
  };

  const handleClose = () => {
    stopScanner();
    setQrEscaneado('');
    setFotoInstalacion('');
    setObservacionesValidacion('');
    setMostrarConfirmacion(false);
    setCambioDetectado(false);
    onClose();
  };

  useEffect(() => {
    return () => {
      // cleanup al desmontar
      stopScanner();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <QrCodeIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Validación de Lavadora
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del pedido */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Pedido #{pedido.id.slice(-6)}</h3>
            <p className="text-sm text-blue-800">
              <strong>Cliente:</strong> {pedido.cliente.name}
            </p>
            <p className="text-sm text-blue-800">
              <strong>Plan:</strong> {pedido.plan.name}
            </p>
            <p className="text-sm text-blue-800">
              <strong>Lavadora asignada:</strong> {lavadoraOriginal} ({lavadoraOriginalData?.marca} {lavadoraOriginalData?.modelo})
            </p>
          </div>

          {/* Validación QR */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">1. Escanear QR de la Lavadora</h3>
            
            <div className="flex items-center space-x-4">
              {!isScanning ? (
                <button
                  onClick={startScanner}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <QrCodeIcon className="h-5 w-5" />
                  <span>Activar cámara y escanear</span>
                </button>
              ) : (
                <button
                  onClick={stopScanner}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <span>Detener escáner</span>
                </button>
              )}
              
              {qrEscaneado && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">QR escaneado:</span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {qrEscaneado}
                  </span>
                </div>
              )}
            </div>

            {/* Región donde se muestra la cámara */}
            {isScanning && (
              <div className="mt-3">
                <div id={qrRegionId} className="w-full max-w-xs h-[260px] bg-black rounded-lg overflow-hidden" />
                <p className="text-xs text-gray-500 mt-2">Apunte la cámara al código QR de la lavadora.</p>
              </div>
            )}

            {/* Mostrar información de la lavadora escaneada */}
            {qrEscaneado && lavadoraEscaneadaData && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Lavadora escaneada:</h4>
                <p className="text-sm text-gray-700">
                  <strong>Código:</strong> {lavadoraEscaneadaData.codigoQR}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Modelo:</strong> {lavadoraEscaneadaData.marca} {lavadoraEscaneadaData.modelo}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Serie:</strong> {lavadoraEscaneadaData.numeroSerie}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Estado:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    lavadoraEscaneadaData.estado === 'disponible' ? 'bg-green-100 text-green-800' :
                    lavadoraEscaneadaData.estado === 'alquilada' ? 'bg-blue-100 text-blue-800' :
                    lavadoraEscaneadaData.estado === 'mantenimiento' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {lavadoraEscaneadaData.estado}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Foto de instalación */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">2. Foto de la Instalación</h3>
            
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
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CameraIcon className="h-5 w-5" />
                <span>Tomar Foto de la Instalación</span>
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

          {/* Observaciones */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">3. Observaciones (Opcional)</h3>
            <textarea
              value={observacionesValidacion}
              onChange={(e) => setObservacionesValidacion(e.target.value)}
              placeholder="Observaciones sobre la instalación..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-4 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!qrEscaneado || !fotoInstalacion}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Continuar a Facturación
          </button>
        </div>

        {/* Modal de confirmación de cambio */}
        {mostrarConfirmacion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Cambio de Lavadora Detectado
                  </h3>
                </div>
                
                <div className="space-y-3 mb-6">
                  <p className="text-sm text-gray-600">
                    Se detectó que la lavadora escaneada es diferente a la asignada:
                  </p>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg space-y-2">
                    <p className="text-sm">
                      <strong>Lavadora asignada:</strong> {lavadoraOriginal} ({lavadoraOriginalData?.marca} {lavadoraOriginalData?.modelo})
                    </p>
                    <p className="text-sm">
                      <strong>Lavadora escaneada:</strong> {qrEscaneado} ({lavadoraEscaneadaData?.marca} {lavadoraEscaneadaData?.modelo})
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    ¿Desea continuar con la lavadora escaneada?
                  </p>
                </div>
                
                <div className="flex items-center justify-end space-x-4">
                  <button
                    onClick={() => {
                      setMostrarConfirmacion(false);
                      setQrEscaneado(lavadoraOriginal);
                      setCambioDetectado(false);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Usar Original
                  </button>
                  <button
                    onClick={handleConfirmarCambio}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Continuar con {qrEscaneado}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalValidacionQR;

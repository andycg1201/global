import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, QrCodeIcon, CameraIcon } from '@heroicons/react/24/outline';
import { Pedido, Lavadora } from '../types';
import { storageService } from '../services/storageService';
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
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [observacionesValidacion, setObservacionesValidacion] = useState<string>('');
  const [errorLavadora, setErrorLavadora] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const qrRegionId = 'qr-reader-region';
  const html5QrCodeRef = useRef<any>(null);

  if (!isOpen) return null;

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
          
          // Verificar si la lavadora ya está alquilada
          const lavadoraData = lavadoras.find(l => l.codigoQR === code);
          if (lavadoraData && lavadoraData.estado === 'alquilada') {
            setErrorLavadora('Esta lavadora ya está alquilada. Por favor, escanee otra lavadora.');
          } else {
            setErrorLavadora('');
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

  const handleFotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFotoFile(file);
      
      try {
        // Crear preview temporal para mostrar la imagen
        const reader = new FileReader();
        reader.onload = (e) => {
          setFotoInstalacion(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error al procesar la foto:', error);
        alert('Error al procesar la foto');
      }
    }
  };


  const handleConfirmar = async () => {
    if (!qrEscaneado) {
      alert('Debe escanear el código QR de la lavadora');
      return;
    }

    if (errorLavadora) {
      alert('No se puede continuar con una lavadora ya alquilada');
      return;
    }

    if (!fotoFile) {
      alert('Debe tomar una foto de la instalación antes de continuar');
      return;
    }

    try {
      setSubiendoFoto(true);
      
      // Timeout más corto para móviles (15 segundos)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      const timeoutDuration = isMobile ? 15000 : 30000;
      const timeoutId = setTimeout(() => {
        alert('La subida de foto está tardando mucho. Inténtalo de nuevo.');
        setSubiendoFoto(false);
      }, timeoutDuration);
      
      // Subir foto a Firebase Storage
      const lavadoraCodigo = qrEscaneado;
      const fotoUrl = await storageService.subirFotoInstalacion(
        fotoFile, 
        pedido.id, 
        lavadoraCodigo
      );

      // Cancelar timeout
      clearTimeout(timeoutId);

      // Resetear estado antes de cerrar
      setSubiendoFoto(false);
      
      onConfirm({
        lavadoraEscaneada: qrEscaneado,
        cambioRealizado: false, // Ya no hay validación de cambio
        fotoInstalacion: fotoUrl, // Ahora es una URL, no base64
        observacionesValidacion
      });
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto. Inténtalo de nuevo.');
      setSubiendoFoto(false);
    }
  };

  const handleClose = () => {
    stopScanner();
    setQrEscaneado('');
    setFotoInstalacion('');
    setFotoFile(null);
    setSubiendoFoto(false);
    setObservacionesValidacion('');
    setErrorLavadora('');
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

            {/* Mostrar error si lavadora ya está alquilada */}
            {errorLavadora && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Lavadora no disponible</h4>
                    <p className="text-sm text-red-700 mt-1">{errorLavadora}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mostrar información de la lavadora escaneada */}
            {qrEscaneado && lavadoraEscaneadaData && !errorLavadora && (
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
            <h3 className="text-lg font-medium text-gray-900">
              2. 📸 Foto de la Instalación
            </h3>
            <p className="text-sm text-gray-600">
              Tome una foto de la instalación para documentar el servicio
            </p>
            
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
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
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
            disabled={!qrEscaneado || !fotoFile || subiendoFoto || !!errorLavadora}
            className={`px-6 py-2 rounded-lg transition-colors ${
              !qrEscaneado || !fotoFile || subiendoFoto || !!errorLavadora
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={
              !qrEscaneado ? 'Debe escanear el código QR' :
              !fotoFile ? 'Debe tomar una foto de la instalación' :
              errorLavadora ? 'Lavadora ya está alquilada' :
              subiendoFoto ? 'Subiendo foto...' :
              'Continuar con la entrega'
            }
          >
            {subiendoFoto ? 'Subiendo Foto...' : 
             !fotoFile ? 'Tomar Foto Primero' :
             'Continuar a Facturación'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalValidacionQR;

import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, QrCodeIcon, CameraIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Pedido, Lavadora, CobroAdicional } from '../types';
import { formatCurrency } from '../utils/dateUtils';
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
    cobrosAdicionales: CobroAdicional[];
    horasAdicionales: number;
    observacionesPago?: string;
    recogidaPrioritaria?: boolean;
    horaRecogida?: string;
    observacionRecogida?: string;
  }) => void;
  pedido: Pedido;
  lavadoras: Lavadora[];
  precioHoraAdicional: number;
}

const ModalValidacionQR: React.FC<ModalValidacionQRProps> = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
  lavadoras,
  precioHoraAdicional
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
  
  // Estados para facturación
  const [cobrosAdicionales, setCobrosAdicionales] = useState<CobroAdicional[]>([]);
  const [horasAdicionales, setHorasAdicionales] = useState<string>('0');
  const [observacionesPago, setObservacionesPago] = useState('');
  const [mostrarFormularioCobro, setMostrarFormularioCobro] = useState(false);
  const [nuevoCobro, setNuevoCobro] = useState({
    concepto: '',
    monto: '',
    descripcion: ''
  });
  
  // Estados para recogida prioritaria
  const [recogidaPrioritaria, setRecogidaPrioritaria] = useState(false);
  const [horaRecogida, setHoraRecogida] = useState('');
  const [observacionRecogida, setObservacionRecogida] = useState('');

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
        { 
          fps: 60, // Aumentar a 60 fps para MÁXIMA frecuencia de lectura
          qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
            // Área MÁS GRANDE: usar 90% del viewfinder para máximo área de captura
            const minEdgePercentage = 0.9;
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
            return {
              width: qrboxSize,
              height: qrboxSize
            };
          },
          aspectRatio: 1.0,
          // Configuración MEJORADA para QR dañados o sucios
          verbose: false,
          disableFlip: false,
          // Máxima resolución disponible
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920, min: 640 }, // Resolución máxima
            height: { ideal: 1080, min: 480 }
          },
          // Configuraciones adicionales para mejor tolerancia
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: false
          },
          // Intentar múltiples métodos de decodificación
          rememberLastUsedCamera: true,
          supportedScanTypes: [1, 2] // Suportar ambos tipos de scan
        },
        (decodedText: string) => {
          const code = decodedText.trim();
          setQrEscaneado(code);
          
          // Verificar si la lavadora ya está alquilada
          const lavadoraData = lavadoras.find(l => l.codigoQR === code);
          console.log('🔍 QR escaneado:', code);
          console.log('🔍 Total lavadoras cargadas:', lavadoras.length);
          console.log('🔍 Lavadoras disponibles:', lavadoras.filter(l => l.estado === 'disponible').length);
          console.log('🔍 Lavadoras alquiladas:', lavadoras.filter(l => l.estado === 'alquilada').length);
          console.log('🔍 Lavadora encontrada:', lavadoraData);
          console.log('🔍 Estado de lavadora:', lavadoraData?.estado);
          console.log('🔍 ID de lavadora:', lavadoraData?.id);
          
          if (lavadoraData && lavadoraData.estado === 'alquilada') {
            console.log('❌ Lavadora ya está alquilada - BLOQUEANDO proceso');
            setErrorLavadora('Esta lavadora ya está alquilada. Por favor, escanee otra lavadora.');
          } else {
            console.log('✅ Lavadora disponible - PERMITIENDO proceso');
            setErrorLavadora('');
          }
          
          stopScanner();
        },
        () => {}
      );
    } catch (e) {
      console.error('Error al iniciar escáner QR', e);
      
      // Intentar con configuración alternativa para móviles
      try {
        console.log('Intentando configuración alternativa para móviles...');
        await html5QrCodeRef.current.start(
          { facingMode: 'user' },
          { 
            fps: 60,
            qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
              const minEdgePercentage = 0.9;
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
              return {
                width: qrboxSize,
                height: qrboxSize
              };
            },
            aspectRatio: 1.0,
            verbose: false,
            disableFlip: false,
            videoConstraints: {
              facingMode: 'user',
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 }
            },
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: false
            },
            rememberLastUsedCamera: true,
            supportedScanTypes: [1, 2]
          },
          (decodedText: string) => {
            const code = decodedText.trim();
            setQrEscaneado(code);
            
            // Verificar si la lavadora ya está alquilada
            const lavadoraData = lavadoras.find(l => l.codigoQR === code);
            console.log('🔍 QR escaneado:', code);
            console.log('🔍 Lavadora encontrada:', lavadoraData);
            console.log('🔍 Estado de lavadora:', lavadoraData?.estado);
            
            if (lavadoraData && lavadoraData.estado === 'alquilada') {
              console.log('❌ Lavadora ya está alquilada - BLOQUEANDO proceso');
              setErrorLavadora('Esta lavadora ya está alquilada. Por favor, escanee otra lavadora.');
            } else {
              console.log('✅ Lavadora disponible - PERMITIENDO proceso');
              setErrorLavadora('');
            }
            
            stopScanner();
          },
          () => {}
        );
        console.log('✅ Escáner iniciado con configuración alternativa');
      } catch (e2) {
        console.error('Error con configuración alternativa:', e2);
        alert('No se pudo acceder a la cámara. Asegúrate de que:\n\n1. La aplicación esté en HTTPS\n2. Permitas el acceso a la cámara\n3. No haya otras aplicaciones usando la cámara\n\nIntenta recargar la página.');
        setIsScanning(false);
      }
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
        observacionesValidacion,
        cobrosAdicionales,
        horasAdicionales: parseInt(horasAdicionales) || 0,
        observacionesPago,
        recogidaPrioritaria,
        horaRecogida,
        observacionRecogida
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
    // Resetear estados de facturación
    setCobrosAdicionales([]);
    setHorasAdicionales('0');
    setObservacionesPago('');
    setMostrarFormularioCobro(false);
    setNuevoCobro({ concepto: '', monto: '', descripcion: '' });
    // Resetear estados de recogida prioritaria
    setRecogidaPrioritaria(false);
    setHoraRecogida('');
    setObservacionRecogida('');
    onClose();
  };

  // Funciones para manejar cobros adicionales
  const agregarCobroAdicional = () => {
    const montoNumerico = parseFloat(nuevoCobro.monto) || 0;
    if (!nuevoCobro.concepto || montoNumerico <= 0) {
      alert('Todos los campos son obligatorios y el monto debe ser mayor a 0');
      return;
    }

    setCobrosAdicionales(prev => [...prev, {
      concepto: nuevoCobro.concepto,
      monto: montoNumerico,
      descripcion: nuevoCobro.descripcion
    }]);
    
    setNuevoCobro({ concepto: '', monto: '', descripcion: '' });
    setMostrarFormularioCobro(false);
  };

  const eliminarCobroAdicional = (index: number) => {
    setCobrosAdicionales(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    return () => {
      // cleanup al desmontar
      stopScanner();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <QrCodeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Validación de Lavadora
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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

          {/* Horas Adicionales */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">4. ⏰ Horas Adicionales</h3>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Horas extras:</label>
              <input
                type="number"
                value={horasAdicionales}
                onChange={(e) => setHorasAdicionales(e.target.value)}
                min="0"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-600">
                = {formatCurrency((parseInt(horasAdicionales) || 0) * precioHoraAdicional)}
              </span>
            </div>
          </div>

          {/* Cobros Adicionales */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">5. 💰 Cobros Adicionales</h3>
              <button
                type="button"
                onClick={() => setMostrarFormularioCobro(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Agregar</span>
              </button>
            </div>

            {/* Lista de cobros */}
            {cobrosAdicionales.length > 0 && (
              <div className="space-y-2">
                {cobrosAdicionales.map((cobro, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{cobro.concepto}</p>
                      {cobro.descripcion && (
                        <p className="text-sm text-gray-600">{cobro.descripcion}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{formatCurrency(cobro.monto)}</span>
                      <button
                        type="button"
                        onClick={() => eliminarCobroAdicional(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario para agregar cobro */}
            {mostrarFormularioCobro && (
              <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Nuevo Cobro Adicional</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Concepto *
                    </label>
                    <input
                      type="text"
                      value={nuevoCobro.concepto}
                      onChange={(e) => setNuevoCobro(prev => ({ ...prev, concepto: e.target.value }))}
                      placeholder="Ej: Zona retirada, Transporte, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto *
                    </label>
                    <input
                      type="number"
                      value={nuevoCobro.monto}
                      onChange={(e) => setNuevoCobro(prev => ({ ...prev, monto: e.target.value }))}
                      placeholder="0"
                      min="0"
                      step="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (Opcional)
                    </label>
                    <textarea
                      value={nuevoCobro.descripcion}
                      onChange={(e) => setNuevoCobro(prev => ({ ...prev, descripcion: e.target.value }))}
                      placeholder="Detalles adicionales..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={agregarCobroAdicional}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormularioCobro(false);
                        setNuevoCobro({ concepto: '', monto: '', descripcion: '' });
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones de Pago */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">6. 📝 Observaciones de Pago (Opcional)</h3>
            <textarea
              value={observacionesPago}
              onChange={(e) => setObservacionesPago(e.target.value)}
              placeholder="Observaciones sobre el pago o la entrega..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Recogida Prioritaria */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">7. ⏰ Recogida Prioritaria (Opcional)</h3>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="recogidaPrioritaria"
                checked={recogidaPrioritaria}
                onChange={(e) => setRecogidaPrioritaria(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="recogidaPrioritaria" className="text-sm font-medium text-gray-700">
                Marcar como recogida prioritaria
              </label>
            </div>

            {recogidaPrioritaria && (
              <div className="space-y-4 pl-7 border-l-2 border-blue-200 bg-blue-50 p-4 rounded-r-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora Prioritaria de Recogida
                  </label>
                  <input
                    type="time"
                    value={horaRecogida}
                    onChange={(e) => setHoraRecogida(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Seleccionar hora"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observación de Recogida
                  </label>
                  <textarea
                    value={observacionRecogida}
                    onChange={(e) => setObservacionRecogida(e.target.value)}
                    placeholder="Instrucciones especiales para la recogida..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Resumen de Totales */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">💰 Resumen de Totales</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal (Plan):</span>
                <span>{formatCurrency(pedido.plan.price)}</span>
              </div>
              <div className="flex justify-between">
                <span>Horas adicionales:</span>
                <span>{formatCurrency((parseInt(horasAdicionales) || 0) * precioHoraAdicional)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cobros adicionales:</span>
                <span>{formatCurrency(cobrosAdicionales.reduce((sum, cobro) => sum + cobro.monto, 0))}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-blue-600">
                    {formatCurrency(
                      pedido.plan.price + 
                      (parseInt(horasAdicionales) || 0) * precioHoraAdicional + 
                      cobrosAdicionales.reduce((sum, cobro) => sum + cobro.monto, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-4 p-4 sm:p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!qrEscaneado || !fotoFile || subiendoFoto || !!errorLavadora}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg transition-colors font-medium ${
              !qrEscaneado || !fotoFile || subiendoFoto || !!errorLavadora
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={
              !qrEscaneado ? 'Debe escanear el código QR' :
              !fotoFile ? 'Debe tomar una foto de la instalación' :
              errorLavadora ? 'Lavadora ya está alquilada' :
              subiendoFoto ? 'Subiendo foto...' :
              'Completar entrega y facturación'
            }
          >
            {subiendoFoto ? 'Subiendo Foto...' : 
             !fotoFile ? 'Tomar Foto Primero' :
             '✅ Completar Entrega'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalValidacionQR;

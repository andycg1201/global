import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  QrCodeIcon, 
  ArrowDownTrayIcon, 
  PrinterIcon,
  XMarkIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface QRGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  codigoQR: string;
  lavadoraInfo?: {
    marca: string;
    modelo: string;
    numeroSerie: string;
  };
}

const QRGenerator: React.FC<QRGeneratorProps> = ({
  isOpen,
  onClose,
  codigoQR,
  lavadoraInfo
}) => {
  const [qrDataURL, setQrDataURL] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (isOpen && codigoQR) {
      generateQR();
    }
  }, [isOpen, codigoQR]);

  const generateQR = async () => {
    try {
      setLoading(true);
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Generar QR con opciones personalizadas y MÁXIMA tolerancia a errores
      await QRCode.toCanvas(canvas, codigoQR, {
        width: 128,
        margin: 2, // Mayor margen para zona tranquila
        color: {
          dark: '#000000', // Negro más puro para mejor contraste
          light: '#ffffff' // Blanco más puro
        },
        errorCorrectionLevel: 'H' // Nivel H: corrige hasta 30% de errores (máximo)
      });

      // Convertir canvas a data URL para descarga
      const dataURL = canvas.toDataURL('image/png');
      setQrDataURL(dataURL);
    } catch (error) {
      console.error('Error generando QR:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrDataURL) return;

    const link = document.createElement('a');
    link.download = `QR_${codigoQR}.png`;
    link.href = qrDataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printQR = () => {
    if (!qrDataURL) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${codigoQR}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
            }
            .qr-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            .qr-info {
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              background: #f9fafb;
            }
            .qr-code {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px;
              background: white;
            }
            h1 { color: #1f2937; margin: 0; }
            p { color: #6b7280; margin: 5px 0; }
            .code { font-family: monospace; font-weight: bold; color: #1f2937; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>Lavadora ${lavadoraInfo?.marca} ${lavadoraInfo?.modelo}</h1>
            <div class="qr-info">
              <p><strong>Código QR:</strong> <span class="code">${codigoQR}</span></p>
              ${lavadoraInfo?.numeroSerie ? `<p><strong>Serie:</strong> ${lavadoraInfo.numeroSerie}</p>` : ''}
              <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
            </div>
            <div class="qr-code">
              <img src="${qrDataURL}" alt="QR Code" style="max-width: 200px;" />
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(codigoQR);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <QrCodeIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Código QR Generado
              </h3>
              <p className="text-sm text-gray-500">
                {lavadoraInfo ? `${lavadoraInfo.marca} ${lavadoraInfo.modelo}` : 'Lavadora'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* QR Code Display */}
          <div className="text-center mb-4">
            <div className="inline-block p-3 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
              {loading ? (
                <div className="w-32 h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  className="w-32 h-32"
                  style={{ display: 'block' }}
                />
              )}
            </div>
          </div>

          {/* Code Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Código QR</p>
                <p className="text-lg font-mono text-gray-900">{codigoQR}</p>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {copied ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Copiado</span>
                  </>
                ) : (
                  <>
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            
            {lavadoraInfo && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Serie:</span> {lavadoraInfo.numeroSerie}
                </p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Instrucciones de uso:
            </h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Imprime este código QR y pégalo en la lavadora</li>
              <li>• Usa el escáner QR para identificar la lavadora</li>
              <li>• El código es único para cada lavadora</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cerrar
          </button>
          <button
            onClick={downloadQR}
            disabled={!qrDataURL || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Descargar</span>
          </button>
          <button
            onClick={printQR}
            disabled={!qrDataURL || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;
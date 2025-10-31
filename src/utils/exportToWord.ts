import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { Lavadora } from '../types';

export const exportAllLavadorasToWord = async (lavadoras: Lavadora[]) => {
  // Ordenar lavadoras por código QR
  const lavadorasOrdenadas = lavadoras.sort((a, b) => a.codigoQR.localeCompare(b.codigoQR));
  
  // Dividir en dos páginas: 8 en la primera, 7 en la segunda
  const primeraPagina = lavadorasOrdenadas.slice(0, 8);
  const segundaPagina = lavadorasOrdenadas.slice(8, 15);

  // Función para generar código QR como data URL
  const generarQRDataURL = async (codigo: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(codigo, {
        width: 120,
        margin: 2, // Mayor margen para zona tranquila
        color: {
          dark: '#000000', // Negro puro para máximo contraste
          light: '#FFFFFF' // Blanco puro
        },
        errorCorrectionLevel: 'H' // Nivel H: corrige hasta 30% de errores (máximo)
      });
    } catch (error) {
      console.error('Error generando QR:', error);
      return '';
    }
  };

  // Función para crear HTML de una página
  const crearPaginaHTML = async (lavadorasPagina: Lavadora[], titulo: string) => {
    let html = `
      <div style="page-break-after: always; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="text-align: center; color: #1f2937; font-size: 24px; margin-bottom: 30px;">
          ${titulo}
        </h1>
        <table style="width: 100%; border-collapse: collapse;">
    `;

    // Crear filas de lavadoras (2 por fila)
    for (let i = 0; i < lavadorasPagina.length; i += 2) {
      const lavadora1 = lavadorasPagina[i];
      const lavadora2 = lavadorasPagina[i + 1];

      // Generar códigos QR
      const qr1 = await generarQRDataURL(lavadora1.codigoQR);
      const qr2 = lavadora2 ? await generarQRDataURL(lavadora2.codigoQR) : '';

      html += `
        <tr>
          <td style="width: 50%; padding: 20px; border: 2px solid #e5e7eb; text-align: center; vertical-align: top;">
            <div style="margin-bottom: 20px;">
              <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 10px 0;">
                Código QR: ${lavadora1.codigoQR}
              </h3>
              <p style="color: #374151; font-size: 16px; margin: 0 0 5px 0;">
                ${lavadora1.marca} ${lavadora1.modelo}
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0;">
                Serie: ${lavadora1.numeroSerie}
              </p>
              <div style="padding: 10px; margin: 20px 0; display: flex; align-items: center; justify-content: center;">
                <img src="${qr1}" alt="QR Code ${lavadora1.codigoQR}" style="width: 120px; height: 120px; border: 1px solid #d1d5db;" />
              </div>
            </div>
          </td>
      `;

      if (lavadora2) {
        html += `
          <td style="width: 50%; padding: 20px; border: 2px solid #e5e7eb; text-align: center; vertical-align: top;">
            <div style="margin-bottom: 20px;">
              <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 10px 0;">
                Código QR: ${lavadora2.codigoQR}
              </h3>
              <p style="color: #374151; font-size: 16px; margin: 0 0 5px 0;">
                ${lavadora2.marca} ${lavadora2.modelo}
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0;">
                Serie: ${lavadora2.numeroSerie}
              </p>
              <div style="padding: 10px; margin: 20px 0; display: flex; align-items: center; justify-content: center;">
                <img src="${qr2}" alt="QR Code ${lavadora2.codigoQR}" style="width: 120px; height: 120px; border: 1px solid #d1d5db;" />
              </div>
            </div>
          </td>
        `;
      } else {
        html += `
          <td style="width: 50%; padding: 20px; border: 2px solid #e5e7eb;">
            <!-- Celda vacía -->
          </td>
        `;
      }

      html += `</tr>`;
    }

    html += `
        </table>
      </div>
    `;

    return html;
  };

  // Generar las páginas con códigos QR
  const primeraPaginaHTML = await crearPaginaHTML(primeraPagina, "Códigos QR Lavadoras - Página 1 (G-01 a G-08)");
  const segundaPaginaHTML = await crearPaginaHTML(segundaPagina, "Códigos QR Lavadoras - Página 2 (G-09 a G-15)");

  // Crear el HTML completo
  const htmlCompleto = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Códigos QR Lavadoras</title>
      <style>
        @media print {
          body { margin: 0; }
          .page-break { page-break-after: always; }
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
      </style>
    </head>
    <body>
      ${primeraPaginaHTML}
      ${segundaPaginaHTML}
    </body>
    </html>
  `;

  // Crear y descargar el archivo
  const blob = new Blob([htmlCompleto], { 
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
  });
  
  const fileName = `Codigos_QR_Lavadoras_${new Date().toISOString().split('T')[0]}.doc`;
  saveAs(blob, fileName);
};

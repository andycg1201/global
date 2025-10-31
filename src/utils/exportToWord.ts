import { saveAs } from 'file-saver';
import { Lavadora } from '../types';

export const exportAllLavadorasToWord = async (lavadoras: Lavadora[]) => {
  try {
    // Descargar el PDF estático desde la carpeta public
    const response = await fetch('/QR-Lavadoras pdf.pdf');
    
    if (!response.ok) {
      throw new Error('No se pudo cargar el archivo PDF');
    }
    
    const blob = await response.blob();
    const fileName = `QR-Lavadoras.pdf`;
    
    saveAs(blob, fileName);
  } catch (error) {
    console.error('Error al descargar el PDF:', error);
    alert('Error al descargar el archivo PDF. Asegúrate de que el archivo existe en la carpeta public.');
    throw error;
  }
};

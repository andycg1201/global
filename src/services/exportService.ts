import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MovimientoSaldo } from './movimientosSaldosService';
import { formatCurrency } from '../utils/dateUtils';

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface DatosExportacion {
  tipoSaldo: 'efectivo' | 'nequi' | 'daviplata';
  saldoActual: number;
  saldoInicial: number;
  movimientos: MovimientoSaldo[];
  filtroFecha: 'hoy' | 'personalizado' | 'todo';
  fechaInicio?: string;
  fechaFin?: string;
}

export class ExportService {
  /**
   * Exportar historial de saldos a PDF
   */
  static exportarPDF(datos: DatosExportacion): void {
    try {
      const doc = new jsPDF();
      const { tipoSaldo, saldoActual, saldoInicial, movimientos, filtroFecha, fechaInicio, fechaFin } = datos;

      // Configuración de colores por tipo de saldo
      const configuracionColores = {
        efectivo: { primary: '#10B981', secondary: '#D1FAE5' },
        nequi: { primary: '#3B82F6', secondary: '#DBEAFE' },
        daviplata: { primary: '#8B5CF6', secondary: '#EDE9FE' }
      };

      const colores = configuracionColores[tipoSaldo];
      const nombresTipo = {
        efectivo: 'Efectivo',
        nequi: 'Nequi',
        daviplata: 'Daviplata'
      };

      // Título principal
      doc.setFontSize(20);
      doc.setTextColor(colores.primary);
      doc.text(`Historial de ${nombresTipo[tipoSaldo]}`, 14, 22);

      // Información del período
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      let periodoTexto = '';
      switch (filtroFecha) {
        case 'hoy':
          periodoTexto = 'Período: Hoy';
          break;
        case 'personalizado':
          periodoTexto = `Período: ${fechaInicio} a ${fechaFin}`;
          break;
        case 'todo':
          periodoTexto = 'Período: Desde el principio';
          break;
      }
      doc.text(periodoTexto, 14, 32);

      // Saldo actual
      doc.setFontSize(14);
      doc.setTextColor(colores.primary);
      doc.text(`Saldo actual: ${formatCurrency(saldoActual)}`, 14, 42);

      // Saldo inicial (si aplica)
      if (filtroFecha !== 'todo' && saldoInicial !== 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Saldo inicial: ${formatCurrency(saldoInicial)}`, 14, 52);
      }

      // Preparar datos para la tabla
      const datosTabla = movimientos.map((movimiento, index) => [
        index + 1,
        movimiento.concepto,
        movimiento.referencia,
        movimiento.descripcion || '',
        this.formatearFecha(movimiento.fecha),
        movimiento.tipo === 'ingreso' ? formatCurrency(movimiento.monto) : '',
        movimiento.tipo === 'gasto' ? formatCurrency(movimiento.monto) : ''
      ]);

      // Crear tabla
      doc.autoTable({
        startY: filtroFecha !== 'todo' && saldoInicial !== 0 ? 60 : 50,
        head: [['#', 'Concepto', 'Referencia', 'Descripción', 'Fecha', 'Ingreso', 'Gasto']],
        body: datosTabla,
        theme: 'grid',
        headStyles: {
          fillColor: colores.primary,
          textColor: 255,
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: colores.secondary
        },
        columnStyles: {
          5: { halign: 'right' }, // Ingreso
          6: { halign: 'right' }  // Gasto
        }
      });

      // Resumen final
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(colores.primary);
      doc.text(`Saldo final: ${formatCurrency(saldoActual)}`, 14, finalY);

      // Fecha de generación
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 14, finalY + 10);

      // Guardar archivo
      const nombreArchivo = `historial_${tipoSaldo}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(nombreArchivo);

      console.log('✅ PDF exportado exitosamente:', nombreArchivo);
    } catch (error) {
      console.error('❌ Error al exportar PDF:', error);
      alert('Error al generar el PDF. Inténtalo de nuevo.');
    }
  }

  /**
   * Exportar historial de saldos a Excel
   */
  static exportarExcel(datos: DatosExportacion): void {
    try {
      const { tipoSaldo, saldoActual, saldoInicial, movimientos, filtroFecha, fechaInicio, fechaFin } = datos;

      // Crear libro de trabajo
      const workbook = XLSX.utils.book_new();

      // Preparar datos para la hoja
      const datosHoja = [
        // Encabezados
        ['Historial de Saldos', '', '', '', '', '', ''],
        [`Tipo: ${tipoSaldo.toUpperCase()}`, '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        
        // Información del período
        ['INFORMACIÓN DEL PERÍODO', '', '', '', '', '', ''],
        ['Período:', this.obtenerTextoPeriodo(filtroFecha, fechaInicio, fechaFin), '', '', '', '', ''],
        ['Saldo actual:', formatCurrency(saldoActual), '', '', '', '', ''],
        ...(filtroFecha !== 'todo' && saldoInicial !== 0 ? [['Saldo inicial:', formatCurrency(saldoInicial), '', '', '', '', '']] : []),
        ['', '', '', '', '', '', ''],
        
        // Encabezados de la tabla
        ['#', 'Concepto', 'Referencia', 'Descripción', 'Fecha', 'Ingreso', 'Gasto'],
        
        // Datos de movimientos
        ...movimientos.map((movimiento, index) => [
          index + 1,
          movimiento.concepto,
          movimiento.referencia,
          movimiento.descripcion || '',
          this.formatearFecha(movimiento.fecha),
          movimiento.tipo === 'ingreso' ? movimiento.monto : '',
          movimiento.tipo === 'gasto' ? movimiento.monto : ''
        ]),
        
        // Línea vacía
        ['', '', '', '', '', '', ''],
        
        // Resumen final
        ['RESUMEN FINAL', '', '', '', '', '', ''],
        ['Saldo final:', formatCurrency(saldoActual), '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['Generado el:', new Date().toLocaleString('es-CO'), '', '', '', '', '']
      ];

      // Crear hoja de trabajo
      const worksheet = XLSX.utils.aoa_to_sheet(datosHoja);

      // Configurar ancho de columnas
      worksheet['!cols'] = [
        { wch: 5 },  // #
        { wch: 30 }, // Concepto
        { wch: 15 }, // Referencia
        { wch: 25 }, // Descripción
        { wch: 20 }, // Fecha
        { wch: 15 }, // Ingreso
        { wch: 15 }  // Gasto
      ];

      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Saldos');

      // Guardar archivo
      const nombreArchivo = `historial_${tipoSaldo}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, nombreArchivo);

      console.log('✅ Excel exportado exitosamente:', nombreArchivo);
    } catch (error) {
      console.error('❌ Error al exportar Excel:', error);
      alert('Error al generar el Excel. Inténtalo de nuevo.');
    }
  }

  /**
   * Formatear fecha para exportación
   */
  private static formatearFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtener texto del período para exportación
   */
  private static obtenerTextoPeriodo(
    filtroFecha: 'hoy' | 'personalizado' | 'todo',
    fechaInicio?: string,
    fechaFin?: string
  ): string {
    switch (filtroFecha) {
      case 'hoy':
        return 'Hoy';
      case 'personalizado':
        return `${fechaInicio} a ${fechaFin}`;
      case 'todo':
        return 'Desde el principio';
      default:
        return 'N/A';
    }
  }
}

export const exportService = new ExportService();

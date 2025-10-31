import React, { useState, useEffect } from 'react';
import { XMarkIcon, CalendarIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/dateUtils';
import { MovimientoSaldo } from '../services/movimientosSaldosService';
import { ExportService, DatosExportacion } from '../services/exportService';

interface ModalHistorialSaldosProps {
  isOpen: boolean;
  onClose: () => void;
  tipoSaldo: 'efectivo' | 'nequi' | 'daviplata';
  saldoActual: number;
  movimientos: MovimientoSaldo[];
  cargando?: boolean;
}

const ModalHistorialSaldos: React.FC<ModalHistorialSaldosProps> = ({
  isOpen,
  onClose,
  tipoSaldo,
  saldoActual,
  movimientos,
  cargando = false
}) => {
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'personalizado' | 'todo'>('hoy');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [movimientosFiltrados, setMovimientosFiltrados] = useState<MovimientoSaldo[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<number>(0);

  // Configuración de colores por tipo de saldo
  const configuracionColores = {
    efectivo: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-900',
      accent: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
      saldo: 'bg-green-100 text-green-800'
    },
    nequi: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      accent: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      saldo: 'bg-blue-100 text-blue-800'
    },
    daviplata: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-900',
      accent: 'text-purple-600',
      button: 'bg-purple-600 hover:bg-purple-700',
      saldo: 'bg-purple-100 text-purple-800'
    }
  };

  const colores = configuracionColores[tipoSaldo];

  // Configuración de nombres
  const nombresTipo = {
    efectivo: 'Efectivo',
    nequi: 'Nequi',
    daviplata: 'Daviplata'
  };

  // Inicializar fechas y resetear filtro
  useEffect(() => {
    if (isOpen) {
      // Resetear filtro a "hoy" cada vez que se abre el modal
      setFiltroFecha('hoy');
      
      const hoy = new Date();
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      
      setFechaInicio(hoy.toISOString().split('T')[0]);
      setFechaFin(hoy.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  // Filtrar movimientos y calcular saldo inicial
  useEffect(() => {
    if (!isOpen || movimientos.length === 0) return;

    console.log('🔍 ModalHistorialSaldos - Calculando filtros para:', filtroFecha);
    console.log('📊 Total movimientos recibidos:', movimientos.length);
    console.log('💰 Saldo actual recibido:', saldoActual);

    let movimientosDelPeriodo: MovimientoSaldo[] = [];
    let saldoHastaAnterior = 0;

    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);

    switch (filtroFecha) {
      case 'hoy':
        const inicioHoy = new Date();
        inicioHoy.setHours(0, 0, 0, 0);
        
        movimientosDelPeriodo = movimientos.filter(mov => 
          mov.fecha >= inicioHoy && mov.fecha <= hoy
        );
        
        // Calcular saldo hasta ayer
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        ayer.setHours(23, 59, 59, 999);
        
        saldoHastaAnterior = movimientos
          .filter(mov => mov.fecha <= ayer)
          .reduce((sum, mov) => sum + (mov.tipo === 'ingreso' ? mov.monto : -mov.monto), 0);
        
        console.log('📅 Filtro HOY:');
        console.log('  - Movimientos del día:', movimientosDelPeriodo.length);
        console.log('  - Saldo hasta ayer:', saldoHastaAnterior);
        break;

      case 'personalizado':
        if (fechaInicio && fechaFin) {
          const inicio = new Date(fechaInicio);
          inicio.setHours(0, 0, 0, 0);
          const fin = new Date(fechaFin);
          fin.setHours(23, 59, 59, 999);
          
          movimientosDelPeriodo = movimientos.filter(mov => 
            mov.fecha >= inicio && mov.fecha <= fin
          );
          
          // Calcular saldo hasta el día anterior al rango
          const diaAnterior = new Date(inicio);
          diaAnterior.setDate(diaAnterior.getDate() - 1);
          diaAnterior.setHours(23, 59, 59, 999);
          
          saldoHastaAnterior = movimientos
            .filter(mov => mov.fecha <= diaAnterior)
            .reduce((sum, mov) => sum + (mov.tipo === 'ingreso' ? mov.monto : -mov.monto), 0);
          
          console.log('📅 Filtro PERSONALIZADO:');
          console.log('  - Rango:', fechaInicio, 'a', fechaFin);
          console.log('  - Movimientos del período:', movimientosDelPeriodo.length);
          console.log('  - Saldo hasta día anterior:', saldoHastaAnterior);
        }
        break;

      case 'todo':
        movimientosDelPeriodo = movimientos;
        saldoHastaAnterior = 0;
        
        console.log('📅 Filtro TODO:');
        console.log('  - Movimientos totales:', movimientosDelPeriodo.length);
        console.log('  - Saldo inicial:', saldoHastaAnterior);
        break;
    }

    // Ordenar movimientos por fecha
    movimientosDelPeriodo.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    console.log('✅ Resultados finales:');
    console.log('  - Movimientos filtrados:', movimientosDelPeriodo.length);
    console.log('  - Saldo inicial calculado:', saldoHastaAnterior);
    console.log('  - Saldo actual recibido:', saldoActual);

    setMovimientosFiltrados(movimientosDelPeriodo);
    setSaldoInicial(saldoHastaAnterior);
  }, [filtroFecha, fechaInicio, fechaFin, movimientos, isOpen]);

  const calcularSaldoFinal = () => {
    const movimientosDelPeriodo = movimientosFiltrados.reduce(
      (sum, mov) => sum + (mov.tipo === 'ingreso' ? mov.monto : -mov.monto), 
      0
    );
    const saldoFinal = saldoInicial + movimientosDelPeriodo;
    
    console.log('🧮 Calculando saldo final:');
    console.log('  - Saldo inicial:', saldoInicial);
    console.log('  - Movimientos del período:', movimientosDelPeriodo);
    console.log('  - Saldo final calculado:', saldoFinal);
    console.log('  - Saldo actual (debería coincidir):', saldoActual);
    
    return saldoFinal;
  };

  const exportarPDF = () => {
    try {
      const datosExportacion: DatosExportacion = {
        tipoSaldo,
        saldoActual,
        saldoInicial,
        movimientos: movimientosFiltrados,
        filtroFecha,
        fechaInicio: filtroFecha === 'personalizado' ? fechaInicio : undefined,
        fechaFin: filtroFecha === 'personalizado' ? fechaFin : undefined
      };

      ExportService.exportarPDF(datosExportacion);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al generar el PDF. Inténtalo de nuevo.');
    }
  };

  const exportarExcel = () => {
    try {
      const datosExportacion: DatosExportacion = {
        tipoSaldo,
        saldoActual,
        saldoInicial,
        movimientos: movimientosFiltrados,
        filtroFecha,
        fechaInicio: filtroFecha === 'personalizado' ? fechaInicio : undefined,
        fechaFin: filtroFecha === 'personalizado' ? fechaFin : undefined
      };

      ExportService.exportarExcel(datosExportacion);
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      alert('Error al generar el Excel. Inténtalo de nuevo.');
    }
  };

  const formatearFecha = (fecha: Date) => {
    return fecha.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${colores.bg} ${colores.border} border-2 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className={`${colores.bg} ${colores.border} border-b p-4 flex justify-between items-center`}>
          <div>
            <h2 className={`text-xl font-bold ${colores.text}`}>
              Historial de {nombresTipo[tipoSaldo]}
            </h2>
            <p className={`text-sm ${colores.accent}`}>
              Saldo actual: {formatCurrency(saldoActual)}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors`}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroFecha('hoy')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filtroFecha === 'hoy' 
                    ? `${colores.button} text-white` 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setFiltroFecha('personalizado')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filtroFecha === 'personalizado' 
                    ? `${colores.button} text-white` 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Rango Personalizado
              </button>
              <button
                onClick={() => setFiltroFecha('todo')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filtroFecha === 'todo' 
                    ? `${colores.button} text-white` 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Desde el Principio
              </button>
            </div>

            {filtroFecha === 'personalizado' && (
              <div className="flex gap-2 items-center">
                <CalendarIcon className="h-5 w-5 text-gray-500" />
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-gray-500">a</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {cargando ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-600 font-medium">Cargando movimientos...</div>
            </div>
          ) : (
            <>
              {/* Saldo Inicial */}
              {filtroFecha !== 'todo' && saldoInicial !== 0 && (
                <div className={`${colores.saldo} rounded-lg p-3 mb-4`}>
                  <div className="font-semibold">
                    Saldo hasta {filtroFecha === 'hoy' ? 'ayer' : 'fecha anterior'}: {formatCurrency(saldoInicial)}
                  </div>
                </div>
              )}

              {/* Movimientos */}
              <div className="space-y-2">
                {movimientosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📊</div>
                    <div className="font-medium">No hay movimientos en el período seleccionado</div>
                  </div>
                ) : (
                  movimientosFiltrados.map((movimiento) => (
                    <div key={movimiento.id} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{movimiento.concepto}</div>
                          <div className="text-sm text-gray-600">{movimiento.referencia}</div>
                          {movimiento.descripcion && (
                            <div className="text-xs text-gray-500 mt-1">{movimiento.descripcion}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {formatearFecha(movimiento.fecha)}
                            {movimiento.registradoPor && (
                              <span className="text-gray-500 ml-2">• {movimiento.registradoPor}</span>
                            )}
                          </div>
                        </div>
                        <div className={`font-semibold ${
                          movimiento.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movimiento.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(movimiento.monto)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Saldo Final */}
              {movimientosFiltrados.length > 0 && (
                <div className={`${colores.saldo} rounded-lg p-3 mt-4`}>
                  <div className="font-bold text-lg">
                    Saldo {filtroFecha === 'todo' ? 'actual' : 'final'}: {formatCurrency(calcularSaldoFinal())}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer con botones de exportación */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={exportarPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalHistorialSaldos;

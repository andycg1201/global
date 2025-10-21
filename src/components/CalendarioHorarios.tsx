import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Pedido, Lavadora } from '../types';
import { formatDate, calculatePickupDate } from '../utils/dateUtils';

interface CalendarioHorariosProps {
  isOpen: boolean;
  onClose: () => void;
  pedidos: Pedido[];
  lavadoras: Lavadora[];
}

interface EventoCalendario {
  id: string;
  tipo: 'entrega' | 'recogida';
  fecha: Date;
  lavadora: string;
  cliente: string;
  plan: string;
  color: string;
}

const CalendarioHorarios: React.FC<CalendarioHorariosProps> = ({
  isOpen,
  onClose,
  pedidos,
  lavadoras
}) => {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [vista, setVista] = useState<'mes' | 'semana'>('mes');

  // Calcular eventos del calendario
  const eventos = useMemo(() => {
    const eventosList: EventoCalendario[] = [];

    pedidos.forEach(pedido => {
      // Evento de entrega
      if (pedido.fechaEntrega) {
        eventosList.push({
          id: `${pedido.id}-entrega`,
          tipo: 'entrega',
          fecha: pedido.fechaEntrega,
          lavadora: pedido.lavadoraAsignada?.codigoQR || 'Sin asignar',
          cliente: pedido.cliente.name,
          plan: pedido.plan.name,
          color: 'bg-green-500'
        });
      }

      // Evento de recogida (calculado o real)
      const fechaRecogida = pedido.fechaRecogida || 
        (pedido.fechaEntrega ? calculatePickupDate(pedido.fechaEntrega, pedido.plan, pedido.horasAdicionales) : null);
      
      if (fechaRecogida) {
        eventosList.push({
          id: `${pedido.id}-recogida`,
          tipo: 'recogida',
          fecha: fechaRecogida,
          lavadora: pedido.lavadoraAsignada?.codigoQR || 'Sin asignar',
          cliente: pedido.cliente.name,
          plan: pedido.plan.name,
          color: 'bg-blue-500'
        });
      }
    });

    return eventosList.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [pedidos]);

  // Calcular disponibilidad por fecha
  const disponibilidadPorFecha = useMemo(() => {
    const disponibilidad: { [key: string]: { disponibles: number; ocupadas: number; mantenimiento: number } } = {};

    // Inicializar con todas las lavadoras disponibles
    const fechaInicio = new Date(fechaActual);
    fechaInicio.setDate(1);
    const fechaFin = new Date(fechaActual);
    fechaFin.setMonth(fechaFin.getMonth() + 1);

    for (let fecha = new Date(fechaInicio); fecha <= fechaFin; fecha.setDate(fecha.getDate() + 1)) {
      const fechaKey = fecha.toISOString().split('T')[0];
      disponibilidad[fechaKey] = {
        disponibles: lavadoras.filter(l => l.estado === 'disponible').length,
        ocupadas: lavadoras.filter(l => l.estado === 'alquilada').length,
        mantenimiento: lavadoras.filter(l => l.estado === 'mantenimiento' || l.estado === 'fuera_servicio').length
      };
    }

    // Ajustar según eventos programados
    eventos.forEach(evento => {
      const fechaKey = evento.fecha.toISOString().split('T')[0];
      if (disponibilidad[fechaKey]) {
        if (evento.tipo === 'entrega') {
          disponibilidad[fechaKey].disponibles--;
          disponibilidad[fechaKey].ocupadas++;
        } else if (evento.tipo === 'recogida') {
          disponibilidad[fechaKey].disponibles++;
          disponibilidad[fechaKey].ocupadas--;
        }
      }
    });

    return disponibilidad;
  }, [eventos, lavadoras, fechaActual]);

  // Generar días del mes
  const diasDelMes = useMemo(() => {
    const año = fechaActual.getFullYear();
    const mes = fechaActual.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const diaInicioSemana = primerDia.getDay();

    const dias = [];
    
    // Días del mes anterior
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
      const fecha = new Date(año, mes, -i);
      dias.push({ fecha, esDelMesActual: false });
    }
    
    // Días del mes actual
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(año, mes, dia);
      dias.push({ fecha, esDelMesActual: true });
    }
    
    // Días del mes siguiente
    const diasRestantes = 42 - dias.length; // 6 semanas * 7 días
    for (let dia = 1; dia <= diasRestantes; dia++) {
      const fecha = new Date(año, mes + 1, dia);
      dias.push({ fecha, esDelMesActual: false });
    }
    
    return dias;
  }, [fechaActual]);

  const cambiarMes = (direccion: 'anterior' | 'siguiente') => {
    const nuevaFecha = new Date(fechaActual);
    if (direccion === 'anterior') {
      nuevaFecha.setMonth(nuevaFecha.getMonth() - 1);
    } else {
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
    }
    setFechaActual(nuevaFecha);
  };

  const irAHoy = () => {
    setFechaActual(new Date());
  };

  const obtenerEventosDelDia = (fecha: Date) => {
    const fechaKey = fecha.toISOString().split('T')[0];
    return eventos.filter(evento => 
      evento.fecha.toISOString().split('T')[0] === fechaKey
    );
  };

  const obtenerDisponibilidadDelDia = (fecha: Date) => {
    const fechaKey = fecha.toISOString().split('T')[0];
    return disponibilidadPorFecha[fechaKey] || { disponibles: 0, ocupadas: 0, mantenimiento: 0 };
  };

  if (!isOpen) return null;

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Calendario de Horarios de Lavadoras
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controles */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => cambiarMes('anterior')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              
              <h3 className="text-lg font-semibold text-gray-900">
                {nombresMeses[fechaActual.getMonth()]} {fechaActual.getFullYear()}
              </h3>
              
              <button
                onClick={() => cambiarMes('siguiente')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={irAHoy}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setVista('mes')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  vista === 'mes' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => setVista('semana')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  vista === 'semana' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Semana
              </button>
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Entrega</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Recogida</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded-full"></div>
              <span className="text-sm text-gray-600">Disponible</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded-full"></div>
              <span className="text-sm text-gray-600">Ocupada</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded-full"></div>
              <span className="text-sm text-gray-600">Mantenimiento</span>
            </div>
          </div>
        </div>

        {/* Calendario */}
        <div className="p-6">
          {vista === 'mes' ? (
            <div className="grid grid-cols-7 gap-1">
              {/* Días de la semana */}
              {nombresDias.map(dia => (
                <div key={dia} className="p-2 text-center text-sm font-medium text-gray-500">
                  {dia}
                </div>
              ))}
              
              {/* Días del mes */}
              {diasDelMes.map(({ fecha, esDelMesActual }, index) => {
                const eventosDelDia = obtenerEventosDelDia(fecha);
                const disponibilidad = obtenerDisponibilidadDelDia(fecha);
                const esHoy = fecha.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={`min-h-[120px] p-2 border border-gray-200 ${
                      esDelMesActual ? 'bg-white' : 'bg-gray-50'
                    } ${esHoy ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-2 ${
                      esDelMesActual ? 'text-gray-900' : 'text-gray-400'
                    } ${esHoy ? 'text-blue-600' : ''}`}>
                      {fecha.getDate()}
                    </div>
                    
                    {/* Disponibilidad */}
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-600">✓ {disponibilidad.disponibles}</span>
                        <span className="text-blue-600">● {disponibilidad.ocupadas}</span>
                        <span className="text-yellow-600">⚠ {disponibilidad.mantenimiento}</span>
                      </div>
                    </div>
                    
                    {/* Eventos */}
                    <div className="space-y-1">
                      {eventosDelDia.slice(0, 3).map(evento => (
                        <div
                          key={evento.id}
                          className={`text-xs p-1 rounded text-white truncate ${evento.color}`}
                          title={`${evento.tipo === 'entrega' ? 'Entrega' : 'Recogida'}: ${evento.cliente} - ${evento.lavadora}`}
                        >
                          {evento.tipo === 'entrega' ? '📦' : '📥'} {evento.lavadora}
                        </div>
                      ))}
                      {eventosDelDia.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{eventosDelDia.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Vista semanal próximamente...
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="p-6 border-t bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {lavadoras.filter(l => l.estado === 'disponible').length}
              </div>
              <div className="text-sm text-gray-600">Lavadoras Disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {lavadoras.filter(l => l.estado === 'alquilada').length}
              </div>
              <div className="text-sm text-gray-600">Lavadoras Ocupadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {lavadoras.filter(l => l.estado === 'mantenimiento' || l.estado === 'fuera_servicio').length}
              </div>
              <div className="text-sm text-gray-600">En Mantenimiento</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarioHorarios;

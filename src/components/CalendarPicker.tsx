import React, { useState, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { 
  ClockIcon, 
  CalendarIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { formatDate, formatCurrency } from '../utils/dateUtils';
import { Pedido, Plan } from '../types';

// Configurar moment en español
moment.locale('es');
const localizer = momentLocalizer(moment);

interface CalendarPickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  existingPedidos: Pedido[];
  plan?: Plan;
  isPrioritario?: boolean;
  onClose?: () => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    pedido: Pedido;
    type: 'entrega' | 'recogida';
    isPrioritario: boolean;
  };
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDate,
  onDateSelect,
  existingPedidos,
  plan,
  isPrioritario = false,
  onClose
}) => {
  const [view, setView] = useState(Views.WEEK);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Configuración de horarios de trabajo
  const workHours = {
    start: 7, // 7 AM
    end: 19   // 7 PM
  };

  // Convertir pedidos existentes a eventos del calendario
  const events: CalendarEvent[] = useMemo(() => {
    return existingPedidos.flatMap(pedido => {
      const eventos: CalendarEvent[] = [];
      
      // Evento de entrega
      if (pedido.fechaEntrega) {
        eventos.push({
          id: `${pedido.id}-entrega`,
          title: `📦 ${pedido.cliente.name} (${pedido.plan.name})`,
          start: pedido.fechaEntrega,
          end: new Date(pedido.fechaEntrega.getTime() + 30 * 60 * 1000), // 30 min
          resource: {
            pedido,
            type: 'entrega',
            isPrioritario: pedido.isPrioritario
          }
        });
      }

      // Evento de recogida
      if (pedido.fechaRecogidaCalculada) {
        eventos.push({
          id: `${pedido.id}-recogida`,
          title: `🏠 ${pedido.cliente.name} (Recogida)`,
          start: pedido.fechaRecogidaCalculada,
          end: new Date(pedido.fechaRecogidaCalculada.getTime() + 30 * 60 * 1000), // 30 min
          resource: {
            pedido,
            type: 'recogida',
            isPrioritario: pedido.isPrioritario
          }
        });
      }

      return eventos;
    });
  }, [existingPedidos]);

  // Verificar si un horario está disponible
  const isTimeAvailable = (date: Date): boolean => {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // No trabajar domingos
    if (dayOfWeek === 0) return false;

    // Verificar horarios de trabajo
    if (hour < workHours.start || hour >= workHours.end) return false;

    // Verificar conflictos con pedidos existentes
    const hasConflict = events.some(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return date >= eventStart && date < eventEnd;
    });

    return !hasConflict;
  };

  // Manejar selección de slot
  const handleSelectSlot = ({ start }: { start: Date }) => {
    if (isTimeAvailable(start)) {
      setSelectedSlot(start);
      setShowTimePicker(true);
    }
  };

  // Manejar selección de evento
  const handleSelectEvent = (event: CalendarEvent) => {
    // Mostrar información del pedido
    console.log('Pedido seleccionado:', event.resource.pedido);
  };

  // Confirmar selección de hora
  const handleConfirmTime = () => {
    if (selectedSlot) {
      onDateSelect(selectedSlot);
      setShowTimePicker(false);
      setSelectedSlot(null);
      if (onClose) onClose();
    }
  };

  // Obtener horarios disponibles para el día seleccionado
  const getAvailableTimes = (date: Date): Date[] => {
    const times: Date[] = [];
    const dayStart = new Date(date);
    dayStart.setHours(workHours.start, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(workHours.end, 0, 0, 0);

    for (let time = new Date(dayStart); time < dayEnd; time.setMinutes(time.getMinutes() + 30)) {
      if (isTimeAvailable(new Date(time))) {
        times.push(new Date(time));
      }
    }

    return times;
  };

  // Estilos personalizados para eventos
  const eventStyleGetter = (event: CalendarEvent) => {
    const isPrioritario = event.resource.isPrioritario;
    const isEntrega = event.resource.type === 'entrega';
    
    let backgroundColor = isEntrega ? '#3B82F6' : '#10B981'; // Azul para entrega, verde para recogida
    let borderColor = isPrioritario ? '#EF4444' : backgroundColor;
    let borderWidth = isPrioritario ? '3px' : '1px';

    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        fontSize: '12px',
        fontWeight: isPrioritario ? 'bold' : 'normal'
      }
    };
  };

  // Formatear fechas para el calendario
  const formats = {
    timeGutterFormat: 'HH:mm',
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
      `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
    dayFormat: 'dddd',
    dayHeaderFormat: 'dddd, DD MMMM',
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('DD MMM')} - ${moment(end).format('DD MMM YYYY')}`,
    monthHeaderFormat: 'MMMM YYYY',
    agendaDateFormat: 'dddd, DD MMMM',
    agendaTimeFormat: 'HH:mm',
    agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Seleccionar Fecha y Hora de Entrega
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex h-[calc(90vh-80px)]">
          {/* Calendario Principal */}
          <div className="flex-1 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setView(Views.MONTH)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    view === Views.MONTH 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Mes
                </button>
                <button
                  onClick={() => setView(Views.WEEK)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    view === Views.WEEK 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setView(Views.DAY)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    view === Views.DAY 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Día
                </button>
                <button
                  onClick={() => setView(Views.AGENDA)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    view === Views.AGENDA 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Agenda
                </button>
              </div>

              {plan && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Plan seleccionado:</span> {plan.name}
                  {isPrioritario && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                      Prioritario
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="h-[calc(100%-60px)]">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                onView={setView}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                step={30}
                timeslots={2}
                min={new Date(2024, 0, 1, workHours.start, 0, 0)}
                max={new Date(2024, 0, 1, workHours.end, 0, 0)}
                eventPropGetter={eventStyleGetter}
                formats={formats}
                messages={{
                  next: 'Siguiente',
                  previous: 'Anterior',
                  today: 'Hoy',
                  month: 'Mes',
                  week: 'Semana',
                  day: 'Día',
                  agenda: 'Agenda',
                  date: 'Fecha',
                  time: 'Hora',
                  event: 'Evento',
                  noEventsInRange: 'No hay pedidos en este rango de fechas',
                  showMore: (total: number) => `+ Ver ${total} más`
                }}
                style={{ height: '100%' }}
              />
            </div>
          </div>

          {/* Panel Lateral */}
          <div className="w-80 border-l border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Información del Plan */}
              {plan && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Plan Seleccionado</h3>
                  <div className="text-sm text-blue-800">
                    <p><strong>Nombre:</strong> {plan.name}</p>
                    <p><strong>Precio:</strong> {formatCurrency(plan.price)}</p>
                    <p><strong>Duración:</strong> {plan.duration} horas</p>
                    <p><strong>Descripción:</strong> {plan.description}</p>
                  </div>
                </div>
              )}

              {/* Horarios Disponibles */}
              {selectedSlot && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-900 mb-2">Horarios Disponibles</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {getAvailableTimes(selectedSlot).map((time, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedSlot(time);
                          setShowTimePicker(true);
                        }}
                        className="w-full text-left px-3 py-2 text-sm bg-white border border-green-300 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        {formatDate(time, 'HH:mm')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Leyenda */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Leyenda</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span>Entrega de lavadora</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Recogida de lavadora</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded border-2 border-red-700"></div>
                    <span>Pedido prioritario</span>
                  </div>
                </div>
              </div>

              {/* Instrucciones */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Instrucciones</h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Haz clic en un horario disponible</li>
                  <li>• Los horarios rojos están ocupados</li>
                  <li>• Horario de trabajo: 7:00 AM - 7:00 PM</li>
                  <li>• No se trabaja los domingos</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {selectedSlot && (
              <span>
                Seleccionado: <strong>{formatDate(selectedSlot, 'dd/MM/yyyy HH:mm')}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            {selectedSlot && (
              <button
                onClick={handleConfirmTime}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Confirmar Hora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPicker;

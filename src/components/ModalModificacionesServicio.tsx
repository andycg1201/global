import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, CurrencyDollarIcon, ClockIcon, MinusIcon } from '@heroicons/react/24/outline';
import { Pedido, Plan, ModificacionServicio } from '../types';
import { modificacionesService } from '../services/modificacionesService';

interface ModalModificacionesServicioProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido | null;
  planes: Plan[];
  onModificacionAplicada: () => void;
}

const ModalModificacionesServicio: React.FC<ModalModificacionesServicioProps> = ({
  isOpen,
  onClose,
  pedido,
  planes,
  onModificacionAplicada
}) => {
  const [modificacion, setModificacion] = useState<Partial<ModificacionServicio>>({
    horasExtras: [],
    cobrosAdicionales: [],
    descuentos: [],
    observaciones: '',
    totalHorasExtras: 0,
    totalCobrosAdicionales: 0,
    totalDescuentos: 0,
    totalModificaciones: 0
  });

  const [cambioPlan, setCambioPlan] = useState({
    planAnterior: pedido?.plan.id || '',
    planNuevo: pedido?.plan.id || '',
    diferencia: 0
  });

  const [nuevoCobro, setNuevoCobro] = useState({ concepto: '', monto: 0 });
  const [nuevoDescuento, setNuevoDescuento] = useState({ concepto: '', monto: 0 });
  const [nuevaHoraExtra, setNuevaHoraExtra] = useState({ cantidad: 0 });
  const [precioHoraExtra, setPrecioHoraExtra] = useState(2000); // Valor por defecto

  // Cargar configuración al abrir el modal
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const { configService } = await import('../services/firebaseService');
        const config = await configService.getConfiguracion();
        if (config?.horaAdicional) {
          setPrecioHoraExtra(config.horaAdicional);
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    };
    
    if (isOpen) {
      cargarConfiguracion();
    }
  }, [isOpen]);

  // Actualizar estado cuando cambie el pedido
  useEffect(() => {
    if (pedido) {
      console.log('🔍 ModalModificacionesServicio - Pedido recibido:', pedido);
      console.log('🔍 ModalModificacionesServicio - Plan del pedido:', pedido.plan);
      console.log('🔍 ModalModificacionesServicio - Planes disponibles:', planes);
      
      setCambioPlan({
        planAnterior: pedido.plan.id,
        planNuevo: pedido.plan.id,
        diferencia: 0
      });
    }
  }, [pedido]);

  // Resetear estado y cargar modificaciones cuando se abre el modal
  useEffect(() => {
    if (isOpen && pedido) {
      console.log('🔄 ModalModificacionesServicio - Reseteando estado y cargando modificaciones');
      
      // Primero resetear el estado
      setModificacion({
        horasExtras: [],
        cobrosAdicionales: [],
        descuentos: [],
        observaciones: '',
        totalHorasExtras: 0,
        totalCobrosAdicionales: 0,
        totalDescuentos: 0,
        totalModificaciones: 0
      });
      setNuevoCobro({ concepto: '', monto: 0 });
      setNuevoDescuento({ concepto: '', monto: 0 });
      setNuevaHoraExtra({ cantidad: 0 });
      
      // Luego cargar las modificaciones existentes
      cargarModificacionesExistentes();
    }
  }, [isOpen, pedido]);

  const cargarModificacionesExistentes = async () => {
    if (!pedido) return;
    
    console.log('🔍 ModalModificacionesServicio - Cargando modificaciones existentes para pedido:', pedido.id);
    
    try {
      const modificacionExistente = await modificacionesService.obtenerModificacionPorPedido(pedido.id);
      console.log('🔍 ModalModificacionesServicio - Modificación existente encontrada:', modificacionExistente);
      
      if (modificacionExistente) {
        // Migrar formato antiguo de horasExtras a nuevo formato
        let horasExtrasMigradas = modificacionExistente.horasExtras || [];
        
        // Si horasExtras es un objeto (formato antiguo), convertirlo a array
        if (modificacionExistente.horasExtras && !Array.isArray(modificacionExistente.horasExtras)) {
          const horasAntiguas = modificacionExistente.horasExtras as any;
          if (horasAntiguas.cantidad > 0) {
            horasExtrasMigradas = [{
              concepto: `${horasAntiguas.cantidad} hora${horasAntiguas.cantidad > 1 ? 's' : ''} adicional${horasAntiguas.cantidad > 1 ? 'es' : ''}`,
              cantidad: horasAntiguas.cantidad,
              precioUnitario: horasAntiguas.precioUnitario,
              total: horasAntiguas.total
            }];
          } else {
            horasExtrasMigradas = [];
          }
        }
        
        const modificacionMigrada = {
          ...modificacionExistente,
          horasExtras: horasExtrasMigradas
        };
        
        console.log('🔍 ModalModificacionesServicio - Modificación migrada:', modificacionMigrada);
        setModificacion(modificacionMigrada);
        if (modificacionExistente.cambioPlan) {
          setCambioPlan(modificacionExistente.cambioPlan);
        }
        console.log('✅ ModalModificacionesServicio - Modificaciones cargadas exitosamente');
      } else {
        console.log('ℹ️ ModalModificacionesServicio - No se encontraron modificaciones existentes');
      }
    } catch (error) {
      console.error('❌ Error al cargar modificaciones existentes:', error);
    }
  };

  // Calcular totales
  useEffect(() => {
    // Asegurar que horasExtras sea un array
    const horasExtrasArray = Array.isArray(modificacion.horasExtras) ? modificacion.horasExtras : [];
    
    const totalHorasExtras = horasExtrasArray.reduce((sum, hora) => sum + hora.total, 0);
    const totalCobrosAdicionales = modificacion.cobrosAdicionales?.reduce((sum, cobro) => sum + cobro.monto, 0) || 0;
    const totalDescuentos = modificacion.descuentos?.reduce((sum, descuento) => sum + descuento.monto, 0) || 0;
    const totalModificaciones = totalHorasExtras + totalCobrosAdicionales - totalDescuentos + cambioPlan.diferencia;

    console.log('🧮 Calculando totales:');
    console.log('  - Horas extras:', totalHorasExtras);
    console.log('  - Cobros adicionales:', totalCobrosAdicionales);
    console.log('  - Descuentos:', totalDescuentos);
    console.log('  - Diferencia plan:', cambioPlan.diferencia);
    console.log('  - Total modificaciones:', totalModificaciones);
    console.log('  - Horas extras array:', horasExtrasArray);
    console.log('  - Cobros array:', modificacion.cobrosAdicionales);
    console.log('  - Descuentos array:', modificacion.descuentos);

    setModificacion(prev => ({
      ...prev,
      totalHorasExtras,
      totalCobrosAdicionales,
      totalDescuentos,
      totalModificaciones
    }));
  }, [modificacion.horasExtras, modificacion.cobrosAdicionales, modificacion.descuentos, cambioPlan.diferencia]);

  // Calcular diferencia de plan
  useEffect(() => {
    if (cambioPlan.planAnterior !== cambioPlan.planNuevo) {
      const planAnterior = planes.find(p => p.id === cambioPlan.planAnterior);
      const planNuevo = planes.find(p => p.id === cambioPlan.planNuevo);
      
      if (planAnterior && planNuevo) {
        const diferencia = planNuevo.price - planAnterior.price;
        setCambioPlan(prev => ({ ...prev, diferencia }));
      }
    } else {
      setCambioPlan(prev => ({ ...prev, diferencia: 0 }));
    }
  }, [cambioPlan.planAnterior, cambioPlan.planNuevo, planes]);

  const handleAgregarHoraExtra = () => {
    if (nuevaHoraExtra.cantidad > 0) {
      const total = nuevaHoraExtra.cantidad * precioHoraExtra;
      const concepto = nuevaHoraExtra.cantidad === 1 ? '1 hora adicional' : `${nuevaHoraExtra.cantidad} horas extras`;
      
      const nuevaEntrada = {
        concepto: concepto,
        cantidad: nuevaHoraExtra.cantidad,
        precioUnitario: precioHoraExtra,
        total: total
      };
      
      setModificacion(prev => ({
        ...prev,
        horasExtras: [...(prev.horasExtras || []), nuevaEntrada]
      }));
      
      setNuevaHoraExtra({ cantidad: 0 });
    }
  };

  const handleEliminarHoraExtra = (index: number) => {
    setModificacion(prev => ({
      ...prev,
      horasExtras: prev.horasExtras?.filter((_, i) => i !== index) || []
    }));
  };

  const agregarCobroAdicional = () => {
    if (nuevoCobro.concepto.trim() && nuevoCobro.monto > 0) {
      setModificacion(prev => ({
        ...prev,
        cobrosAdicionales: [...(prev.cobrosAdicionales || []), { ...nuevoCobro }]
      }));
      setNuevoCobro({ concepto: '', monto: 0 });
    }
  };

  const eliminarCobroAdicional = (index: number) => {
    setModificacion(prev => ({
      ...prev,
      cobrosAdicionales: prev.cobrosAdicionales?.filter((_, i) => i !== index) || []
    }));
  };

  const agregarDescuento = () => {
    if (nuevoDescuento.concepto.trim() && nuevoDescuento.monto > 0) {
      setModificacion(prev => ({
        ...prev,
        descuentos: [...(prev.descuentos || []), { ...nuevoDescuento }]
      }));
      setNuevoDescuento({ concepto: '', monto: 0 });
    }
  };

  const eliminarDescuento = (index: number) => {
    setModificacion(prev => ({
      ...prev,
      descuentos: prev.descuentos?.filter((_, i) => i !== index) || []
    }));
  };

  const handleConfirmar = async () => {
    if (!pedido) return;

    try {
      // Calcular diferencia real si hay cambio de plan
      let diferenciaReal = 0;
      let precioPlanFinal = pedido.plan.price;
      if (cambioPlan.planAnterior !== cambioPlan.planNuevo) {
        const nuevoPlan = planes.find(p => p.id === cambioPlan.planNuevo);
        const planActual = pedido.plan;
        if (nuevoPlan) {
          const precioActual = Number(planActual.price) || 0;
          const precioNuevo = Number(nuevoPlan.price) || 0;
          diferenciaReal = precioNuevo - precioActual;
          precioPlanFinal = precioNuevo;
        }
      }

      // Calcular total final del servicio
      const totalModificaciones = (modificacion.totalHorasExtras || 0) + 
        (modificacion.totalCobrosAdicionales || 0) - 
        (modificacion.totalDescuentos || 0);
      const totalFinalServicio = precioPlanFinal + totalModificaciones;

      // Preparar datos para Firebase (sin campos undefined)
      const modificacionCompleta: any = {
        pedidoId: pedido.id,
        horasExtras: modificacion.horasExtras!,
        cobrosAdicionales: modificacion.cobrosAdicionales || [],
        descuentos: modificacion.descuentos || [],
        observaciones: modificacion.observaciones || '',
        totalHorasExtras: modificacion.totalHorasExtras || 0,
        totalCobrosAdicionales: modificacion.totalCobrosAdicionales || 0,
        totalDescuentos: modificacion.totalDescuentos || 0,
        totalModificaciones: totalModificaciones,
        aplicadoPor: (() => {
          try {
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
              const user = JSON.parse(userStr);
              return user.name || 'Usuario desconocido';
            }
          } catch (error) {
            console.error('Error al obtener nombre del usuario:', error);
          }
          return 'Usuario desconocido';
        })(), // ✅ Nombre del usuario que aplicó la modificación
        fecha: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Solo agregar cambioPlan si hay un cambio real
      if (cambioPlan.planAnterior !== cambioPlan.planNuevo) {
        modificacionCompleta.cambioPlan = {
          ...cambioPlan,
          diferencia: diferenciaReal
        };
      }

      await modificacionesService.guardarModificacion(modificacionCompleta);
      
      // Si hay cambio de plan, actualizar el pedido
      if (cambioPlan.planAnterior !== cambioPlan.planNuevo) {
        const nuevoPlan = planes.find(p => p.id === cambioPlan.planNuevo);
        const planActual = pedido.plan;
        
        console.log('🔄 Debug cambio de plan:');
        console.log('  - Plan anterior ID:', cambioPlan.planAnterior);
        console.log('  - Plan nuevo ID:', cambioPlan.planNuevo);
        console.log('  - Plan actual:', planActual);
        console.log('  - Nuevo plan encontrado:', nuevoPlan);
        console.log('  - Diferencia del estado:', cambioPlan.diferencia);
        
        if (nuevoPlan) {
          // Recalcular la diferencia directamente
          const precioActual = Number(planActual.price) || 0;
          const precioNuevo = Number(nuevoPlan.price) || 0;
          const diferenciaReal = precioNuevo - precioActual;
          
          console.log('🔄 Recalculando diferencia:');
          console.log('  - Precio actual:', precioActual);
          console.log('  - Precio nuevo:', precioNuevo);
          console.log('  - Diferencia real:', diferenciaReal);
          
          console.log('🔄 Actualizando pedido con nuevo plan:', nuevoPlan);
          
          // Actualizar el pedido con el nuevo plan y precio
          const { pedidoService } = await import('../services/firebaseService');
          const { calculatePickupDate } = await import('../utils/dateUtils');
          
          // Calcular nueva fecha de recogida si hay fecha de entrega
          let fechaRecogidaCalculada = undefined;
          if (pedido.fechaEntrega) {
            // Debug: verificar tipo de fechaEntrega
            console.log('🔍 Debug fechaEntrega:', {
              fechaEntrega: pedido.fechaEntrega,
              tipo: typeof pedido.fechaEntrega,
              esDate: pedido.fechaEntrega instanceof Date,
              tieneToDate: typeof (pedido.fechaEntrega as any).toDate === 'function'
            });
            
            // Manejar tanto Date como Timestamp
            const fechaEntrega = pedido.fechaEntrega instanceof Date 
              ? pedido.fechaEntrega 
              : (pedido.fechaEntrega as any).toDate();
            
            console.log('🔍 FechaEntrega procesada:', fechaEntrega);
            
            // Calcular total de horas extras de las modificaciones
            const totalHorasExtras = modificacion.horasExtras?.reduce((sum, h) => sum + h.cantidad, 0) || 0;
            
            fechaRecogidaCalculada = calculatePickupDate(
              fechaEntrega, 
              nuevoPlan, 
              totalHorasExtras
            );
            
            console.log('🔍 Nueva fechaRecogidaCalculada:', fechaRecogidaCalculada);
          }
          
          await pedidoService.updatePedido(pedido.id, {
            plan: nuevoPlan,
            subtotal: nuevoPlan.price,
            total: totalFinalServicio, // El total incluye el plan + modificaciones
            fechaRecogidaCalculada: fechaRecogidaCalculada // Actualizar fecha de recogida
          });
          
          console.log('✅ Pedido actualizado exitosamente con nuevo plan');
          alert(`Cambios realizados satisfactoriamente.`);
        }
      } else {
        // Si no hay cambio de plan pero sí hay modificaciones, actualizar el total y fecha de recogida
        if (totalModificaciones !== 0) {
          const { pedidoService } = await import('../services/firebaseService');
          const { calculatePickupDate } = await import('../utils/dateUtils');
          
          // Calcular total de horas extras de las modificaciones
          const totalHorasExtras = modificacion.horasExtras?.reduce((sum, h) => sum + h.cantidad, 0) || 0;
          
          // Recalcular fecha de recogida si hay fecha de entrega y horas extras
          let fechaRecogidaCalculada = undefined;
          if (pedido.fechaEntrega && totalHorasExtras > 0) {
            // Manejar tanto Date como Timestamp
            const fechaEntrega = pedido.fechaEntrega instanceof Date 
              ? pedido.fechaEntrega 
              : (pedido.fechaEntrega as any).toDate();
            
            fechaRecogidaCalculada = calculatePickupDate(
              fechaEntrega, 
              pedido.plan, 
              totalHorasExtras
            );
            
            console.log('🔍 Recalculando fecha de recogida con horas extras:', {
              fechaEntrega,
              plan: pedido.plan.name,
              totalHorasExtras,
              nuevaFechaRecogida: fechaRecogidaCalculada
            });
          }
          
          const updateData: any = {
            total: totalFinalServicio
          };
          
          // Solo actualizar fechaRecogidaCalculada si se calculó
          if (fechaRecogidaCalculada) {
            updateData.fechaRecogidaCalculada = fechaRecogidaCalculada;
          }
          
          await pedidoService.updatePedido(pedido.id, updateData);
          console.log('✅ Pedido actualizado con modificaciones (sin cambio de plan)');
          alert(`Cambios realizados satisfactoriamente.`);
        }
      }
      
      onModificacionAplicada();
      onClose();
    } catch (error) {
      console.error('Error al guardar modificaciones:', error);
      alert('Error al guardar modificaciones: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleClose = () => {
    setModificacion({
      horasExtras: [],
      cobrosAdicionales: [],
      descuentos: [],
      observaciones: '',
      totalHorasExtras: 0,
      totalCobrosAdicionales: 0,
      totalDescuentos: 0,
      totalModificaciones: 0
    });
    setCambioPlan({
      planAnterior: pedido?.planId || '',
      planNuevo: pedido?.planId || '',
      diferencia: 0
    });
    setNuevoCobro({ concepto: '', monto: 0 });
    setNuevoDescuento({ concepto: '', monto: 0 });
    setNuevaHoraExtra({ cantidad: 0 });
    onClose();
  };

  if (!isOpen || !pedido) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">Modificaciones del Servicio</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Información del pedido */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">Cliente:</span>
                <span className="font-medium">{pedido.cliente.name}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Plan:</span>
                <span className="font-medium">{pedido.plan.name}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Precio:</span>
                <span className="font-semibold text-blue-600">${pedido.plan.price?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Estado:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium capitalize">
                  {pedido.status}
                </span>
              </div>
            </div>
          </div>

          {/* Cambio de Plan */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 mr-2 text-blue-600" />
                Cambio de Plan
              </h3>
              {cambioPlan.diferencia !== 0 && !isNaN(cambioPlan.diferencia) && (
                <span className="text-sm font-medium text-green-800 bg-green-100 px-2 py-1 rounded-full">
                  {cambioPlan.diferencia > 0 ? '+' : ''}${cambioPlan.diferencia.toLocaleString()}
                </span>
              )}
            </div>
            
            <select
              value={cambioPlan.planNuevo}
              onChange={(e) => {
                const nuevoPlanId = e.target.value;
                const nuevoPlan = planes.find(p => p.id === nuevoPlanId);
                const planActual = pedido.plan;
                
                console.log('🔄 Debug selector cambio de plan:');
                console.log('  - Nuevo plan ID seleccionado:', nuevoPlanId);
                console.log('  - Nuevo plan encontrado:', nuevoPlan);
                console.log('  - Plan actual:', planActual);
                
                if (nuevoPlan) {
                  const precioActual = Number(planActual.price) || 0;
                  const precioNuevo = Number(nuevoPlan.price) || 0;
                  const diferencia = precioNuevo - precioActual;
                  console.log('  - Precio actual:', precioActual);
                  console.log('  - Precio nuevo:', precioNuevo);
                  console.log('  - Diferencia calculada:', diferencia);
                  console.log('  - ¿Es NaN?', isNaN(diferencia));
                  
                  setCambioPlan(prev => {
                    const nuevoEstado = { 
                      ...prev, 
                      planAnterior: planActual.id,
                      planNuevo: nuevoPlanId,
                      diferencia: diferencia
                    };
                    console.log('🔄 Nuevo estado cambioPlan:', nuevoEstado);
                    return nuevoEstado;
                  });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value={pedido.plan.id}>Mantener plan actual ({pedido.plan.name} - ${pedido.plan.price?.toLocaleString() || '0'})</option>
              {planes.filter(plan => plan.id !== pedido.plan.id).map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - ${plan.price?.toLocaleString() || '0'}
                </option>
              ))}
            </select>
          </div>

          {/* Horas Extras */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-orange-600" />
              Horas Extras
            </h3>
            
            {/* Lista de horas extras existentes */}
            {modificacion.horasExtras && modificacion.horasExtras.length > 0 && (
              <div className="space-y-2 mb-4">
                {modificacion.horasExtras.map((hora, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-orange-900">{hora.concepto}</div>
                      <div className="text-xs text-orange-700">
                        {hora.cantidad}h × ${hora.precioUnitario.toLocaleString()} = ${hora.total.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEliminarHoraExtra(index)}
                      className="ml-2 p-1 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Formulario para agregar nueva hora extra */}
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={nuevaHoraExtra.cantidad || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const cantidad = value === '' ? 0 : parseInt(value) || 0;
                  setNuevaHoraExtra(prev => ({ ...prev, cantidad }));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Cantidad de horas"
              />
              <button
                onClick={handleAgregarHoraExtra}
                disabled={nuevaHoraExtra.cantidad <= 0}
                className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            
            <div className="text-xs text-gray-500 mt-1">
              Precio por hora: <span className="font-medium text-orange-600">${precioHoraExtra.toLocaleString()}</span>
            </div>
          </div>

          {/* Cobros Adicionales */}
          <div className="border rounded-lg p-3">
            <h3 className="font-medium text-gray-900 mb-2 flex items-center">
              <PlusIcon className="h-5 w-5 mr-2" />
              Cobros Adicionales
            </h3>
            
            {/* Lista de cobros existentes */}
            {modificacion.cobrosAdicionales && modificacion.cobrosAdicionales.length > 0 && (
              <div className="space-y-1 mb-2">
                {modificacion.cobrosAdicionales.map((cobro, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div className="flex-1">
                      <span className="font-medium">{cobro.concepto}</span>
                      <span className="ml-2 text-gray-600">${cobro.monto?.toLocaleString() || '0'}</span>
                    </div>
                    <button
                      onClick={() => eliminarCobroAdicional(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar nuevo cobro */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Concepto del cobro"
                  value={nuevoCobro.concepto}
                  onChange={(e) => setNuevoCobro(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Monto"
                  value={nuevoCobro.monto || ''}
                  onChange={(e) => setNuevoCobro(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={agregarCobroAdicional}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Descuentos */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center">
              <MinusIcon className="h-5 w-5 mr-2" />
              Descuentos
            </h3>
            
            {/* Lista de descuentos existentes */}
            {modificacion.descuentos && modificacion.descuentos.length > 0 && (
              <div className="space-y-2 mb-4">
                {modificacion.descuentos.map((descuento, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div className="flex-1">
                      <span className="font-medium">{descuento.concepto}</span>
                      <span className="ml-2 text-gray-600">${descuento.monto?.toLocaleString() || '0'}</span>
                    </div>
                    <button
                      onClick={() => eliminarDescuento(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar nuevo descuento */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Concepto del descuento"
                  value={nuevoDescuento.concepto}
                  onChange={(e) => setNuevoDescuento(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Monto"
                  value={nuevoDescuento.monto || ''}
                  onChange={(e) => setNuevoDescuento(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={agregarDescuento}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="border rounded-lg p-3">
            <h3 className="font-medium text-gray-900 mb-2">Observaciones</h3>
            <textarea
              value={modificacion.observaciones || ''}
              onChange={(e) => setModificacion(prev => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Observaciones sobre las modificaciones..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Resumen de Totales */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 shadow-sm">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Resumen de Modificaciones
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-700">Precio del plan:</span>
                <span className="font-semibold text-gray-900">
                  ${(cambioPlan.planNuevo !== cambioPlan.planAnterior ? 
                    planes.find(p => p.id === cambioPlan.planNuevo)?.price?.toLocaleString() || '0' : 
                    pedido?.plan.price?.toLocaleString() || '0')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-700">Horas extras:</span>
                <span className="font-semibold text-orange-600">
                  ${(modificacion.totalHorasExtras || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-700">Cobros adicionales:</span>
                <span className="font-semibold text-green-600">
                  ${(modificacion.totalCobrosAdicionales || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-700">Descuentos:</span>
                <span className="font-semibold text-red-600">
                  -${(modificacion.totalDescuentos || 0).toLocaleString()}
                </span>
              </div>
              <div className="border-t border-blue-200 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-blue-900">Total del servicio:</span>
                  <span className="text-xl font-bold text-blue-900">
                    ${(() => {
                      const precioPlan = cambioPlan.planNuevo !== cambioPlan.planAnterior ? 
                        (planes.find(p => p.id === cambioPlan.planNuevo)?.price || 0) : 
                        (pedido?.plan.price || 0);
                      const totalModificaciones = (modificacion.totalHorasExtras || 0) + 
                        (modificacion.totalCobrosAdicionales || 0) - 
                        (modificacion.totalDescuentos || 0);
                      return (precioPlan + totalModificaciones).toLocaleString();
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-3 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-sm"
          >
            Aplicar Modificaciones
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalModificacionesServicio;

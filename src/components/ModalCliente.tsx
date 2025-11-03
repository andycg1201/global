import React, { useState, useEffect } from 'react';
import { XMarkIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { clienteService } from '../services/firebaseService';
import { Cliente } from '../types';
import LocationPicker from './LocationPicker';
import { formatColombianPhone, isValidColombianCellphone } from '../utils/dateUtils';

interface ModalClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteCreated: (cliente: Cliente) => void;
  clienteEditando?: Cliente | null;
  title?: string;
}

const ModalCliente: React.FC<ModalClienteProps> = ({ 
  isOpen, 
  onClose, 
  onClienteCreated, 
  clienteEditando = null,
  title 
}) => {
  const [loading, setLoading] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    ubicacionGPS: undefined as { lat: number; lng: number } | undefined
  });
  const [getCurrentMapCenter, setGetCurrentMapCenter] = useState<(() => { lat: number; lng: number }) | null>(null);
  const [contactsSupported, setContactsSupported] = useState(false);
  const [telefonoAdvertencia, setTelefonoAdvertencia] = useState<string>('');

  // Verificar si la API de contactos está disponible
  useEffect(() => {
    if (isOpen) {
      // Verificar de múltiples formas para diferentes navegadores
      const hasContactsAPI = Boolean(
        ('contacts' in navigator && navigator.contacts) ||
        ('ContactsManager' in window) ||
        (window.ContactsManager !== undefined)
      );
      
      setContactsSupported(hasContactsAPI);
      
      // Debug: log para ver qué está disponible
      if (hasContactsAPI) {
        console.log('✅ API de contactos disponible');
        console.log('navigator.contacts:', navigator.contacts);
        console.log('window.ContactsManager:', window.ContactsManager);
      } else {
        console.log('❌ API de contactos NO disponible');
        console.log('navigator.contacts:', navigator.contacts);
        console.log('window.ContactsManager:', window.ContactsManager);
      }
    }
  }, [isOpen]);

  // Actualizar el estado cuando se abre el modal con un cliente para editar
  useEffect(() => {
    if (isOpen && clienteEditando) {
      setNuevoCliente({
        name: clienteEditando.name || '',
        phone: clienteEditando.phone || '',
        address: clienteEditando.address || '',
        notes: clienteEditando.notes || '',
        ubicacionGPS: clienteEditando.ubicacionGPS || undefined
      });
    } else if (isOpen && !clienteEditando) {
      // Limpiar el formulario para nuevo cliente
      setNuevoCliente({
        name: '',
        phone: '',
        address: '',
        notes: '',
        ubicacionGPS: undefined
      });
      setTelefonoAdvertencia('');
    }
  }, [isOpen, clienteEditando]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar y limpiar datos antes de guardar
      const nombreLimpio = (nuevoCliente.name || '').trim();
      const telefonoLimpio = (nuevoCliente.phone || '').trim();
      
      // Validar campos requeridos
      if (!nombreLimpio) {
        alert('Por favor, ingresa el nombre del cliente');
        setLoading(false);
        return;
      }
      
      if (!telefonoLimpio) {
        alert('Por favor, ingresa el teléfono del cliente');
        setLoading(false);
        return;
      }

      // Asegurar que el teléfono esté formateado correctamente
      let telefonoFormateado = telefonoLimpio;
      try {
        telefonoFormateado = formatColombianPhone(telefonoLimpio);
      } catch (formatError) {
        console.warn('No se pudo formatear el teléfono, usando el original:', formatError);
        // Si falla el formateo, usar el teléfono limpio tal cual
      }

      // Preparar datos limpios para guardar
      const clienteDataLimpio: any = {
        name: nombreLimpio,
        phone: telefonoFormateado,
        address: (nuevoCliente.address || '').trim(),
        notes: (nuevoCliente.notes || '').trim()
      };

      // Solo incluir ubicacionGPS si está definida (es opcional)
      if (nuevoCliente.ubicacionGPS && 
          typeof nuevoCliente.ubicacionGPS === 'object' && 
          nuevoCliente.ubicacionGPS.lat && 
          nuevoCliente.ubicacionGPS.lng) {
        clienteDataLimpio.ubicacionGPS = nuevoCliente.ubicacionGPS;
        console.log('📍 Ubicación GPS incluida:', clienteDataLimpio.ubicacionGPS);
      } else {
        console.log('📍 Ubicación GPS NO incluida (opcional y no está definida)');
      }

      console.log('💾 Intentando guardar cliente con datos:', clienteDataLimpio);
      console.log('💾 Datos validados:');
      console.log('   - Nombre:', nombreLimpio, '(válido:', !!nombreLimpio, ')');
      console.log('   - Teléfono:', telefonoFormateado, '(válido:', !!telefonoFormateado, ')');
      console.log('   - Dirección:', clienteDataLimpio.address);
      console.log('   - Notas:', clienteDataLimpio.notes);

      if (clienteEditando) {
        // Actualizar cliente existente
        const clienteActualizado = {
          ...clienteEditando,
          ...clienteDataLimpio,
          updatedAt: new Date()
        };
        await clienteService.updateCliente(clienteEditando.id, clienteActualizado);
        onClienteCreated(clienteActualizado);
      } else {
        // Crear nuevo cliente
        const clienteData = {
          ...clienteDataLimpio,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };
        const clienteId = await clienteService.createCliente(clienteData);
        const clienteCreado = {
          id: clienteId,
          ...clienteData
        };
        onClienteCreated(clienteCreado);
      }
      
      console.log('✅ Cliente guardado correctamente');
      
      // Limpiar formulario
      setNuevoCliente({
        name: '',
        phone: '',
        address: '',
        notes: '',
        ubicacionGPS: undefined
      });
      setTelefonoAdvertencia('');
      onClose();
    } catch (error: any) {
      console.error('❌ Error completo al guardar cliente:', error);
      console.error('Tipo de error:', error?.constructor?.name);
      console.error('Mensaje del error:', error?.message);
      console.error('Stack:', error?.stack);
      console.error('Código del error:', error?.code);
      
      // Mostrar mensaje de error más descriptivo
      let errorMessage = 'Error al guardar el cliente';
      
      if (error?.message) {
        errorMessage += `:\n\n${error.message}`;
      } else if (error?.code) {
        errorMessage += `:\n\nCódigo de error: ${error.code}`;
      }
      
      // Mensajes específicos para errores comunes de Firebase
      if (error?.code === 'permission-denied') {
        errorMessage = 'No tienes permiso para crear clientes. Verifica tus permisos de usuario.';
      } else if (error?.code === 'unavailable') {
        errorMessage = 'El servicio no está disponible en este momento. Por favor, intenta nuevamente.';
      } else if (error?.code === 'invalid-argument') {
        errorMessage = 'Los datos ingresados no son válidos. Por favor, verifica el nombre y teléfono.';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
      // Limpiar formulario al cerrar
      setNuevoCliente({
        name: '',
        phone: '',
        address: '',
        notes: '',
        ubicacionGPS: undefined
      });
      setTelefonoAdvertencia('');
      onClose();
  };

  const handleImportarContacto = async () => {
    try {
      console.log('🔍 Iniciando importación de contacto...');
      
      // Detectar si es Brave browser (tiene problemas con Contacts API)
      const userAgent = navigator.userAgent;
      let isBraveBrowser = userAgent.includes('Brave');
      
      // Intentar detectar Brave de forma más precisa (puede fallar silenciosamente)
      try {
        if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
          const braveCheck = await (navigator as any).brave.isBrave();
          isBraveBrowser = isBraveBrowser || braveCheck;
        }
      } catch (e) {
        // Ignorar errores en la detección de Brave
      }
      
      if (isBraveBrowser) {
        console.warn('⚠️ Brave browser detectado - puede tener restricciones con Contacts API');
      }
      
      // Intentar obtener el ContactsManager de diferentes formas
      let contactsManager: ContactsManager | null = null;
      
      // Método 1: navigator.contacts
      if ('contacts' in navigator && navigator.contacts) {
        console.log('📱 Usando navigator.contacts');
        contactsManager = navigator.contacts;
      }
      // Método 2: window.ContactsManager
      else if (window.ContactsManager) {
        console.log('📱 Usando window.ContactsManager');
        contactsManager = window.ContactsManager as any;
      }
      // Método 3: Crear desde la clase si está disponible
      else if ('ContactsManager' in window && (window as any).ContactsManager) {
        console.log('📱 Usando ContactsManager desde window');
        contactsManager = new (window as any).ContactsManager() as ContactsManager;
      }

      if (!contactsManager) {
        console.error('❌ ContactsManager no disponible');
        alert('La importación de contactos no está disponible en este navegador o dispositivo.\n\nRequisitos:\n- Android: Chrome/Edge actualizado\n- iOS: Safari 16.4+\n- Debe estar en HTTPS o localhost');
        return;
      }

      console.log('✅ ContactsManager encontrado:', contactsManager);
      
      // Especificar qué propiedades queremos del contacto
      const props = ['name', 'tel'];
      const opts = { multiple: false }; // Solo permitir un contacto a la vez

      console.log('📋 Solicitando contacto con propiedades:', props);
      
      // Intentar abrir el selector de contactos nativo
      // Envolver en un try-catch específico para manejar el error de Brave
      let contacts;
      try {
        contacts = await contactsManager.select(props, opts);
      } catch (selectError: any) {
        // Si es el error específico de "Unable to open", puede ser Brave bloqueando
        if (selectError.message && selectError.message.includes('Unable to open')) {
          console.error('❌ Error al abrir selector - posible bloqueo de navegador');
          if (isBraveBrowser) {
            throw new Error('Brave browser bloquea la API de contactos por privacidad. Por favor, usa Chrome o Edge para esta funcionalidad.');
          } else {
            throw new Error('No se pudo abrir el selector de contactos. Verifica los permisos del navegador o intenta con Chrome/Edge.');
          }
        }
        throw selectError; // Re-lanzar si es otro error
      }

      console.log('📞 Contactos recibidos:', contacts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        console.log('👤 Contacto seleccionado completo:', JSON.stringify(contact, null, 2));
        console.log('👤 Tipo de contact.tel:', typeof contact.tel);
        console.log('👤 Es array?', Array.isArray(contact.tel));
        
        // Extraer nombre y limpiar
        let nombre = '';
        if (contact.name) {
          if (Array.isArray(contact.name) && contact.name.length > 0) {
            nombre = String(contact.name[0] || '').trim();
          } else if (typeof contact.name === 'string') {
            nombre = String(contact.name).trim();
          }
        }
        console.log('📝 Nombre extraído:', nombre);

        // Extraer teléfono (tomar el primero si hay múltiples) y limpiar
        let telefono = '';
        let tieneMultiplesNumeros = false;
        
        if (contact.tel) {
          let phoneNumber = '';
          
          // Verificar si es un array con múltiples números
          if (Array.isArray(contact.tel)) {
            console.log(`📞 Contacto tiene ${contact.tel.length} número(s) telefónico(s)`);
            if (contact.tel.length > 0) {
              // Tomar siempre el primer número disponible
              phoneNumber = String(contact.tel[0] || '').trim();
              tieneMultiplesNumeros = contact.tel.length > 1;
              
              if (tieneMultiplesNumeros) {
                console.log(`ℹ️ Contacto tiene ${contact.tel.length} números, se importará el primero: ${phoneNumber}`);
              }
            }
          } else if (typeof contact.tel === 'string') {
            phoneNumber = String(contact.tel).trim();
          }
          
          if (phoneNumber) {
            // Remover caracteres no numéricos excepto el +
            telefono = phoneNumber.replace(/[^\d+]/g, '');
            console.log('📱 Teléfono limpio (solo números):', telefono);
            
            // Validar que el teléfono no esté vacío después de limpiar
            if (telefono && telefono.length > 0) {
              // Formatear según formato colombiano (convierte 0057... a +57...)
              try {
                telefono = formatColombianPhone(telefono);
                console.log('📱 Teléfono formateado:', telefono);
                
                // Validar si es un celular colombiano válido
                const validacion = isValidColombianCellphone(telefono);
                if (!validacion.isValid && validacion.message) {
                  console.warn('⚠️ Advertencia de validación:', validacion.message);
                  setTelefonoAdvertencia(validacion.message);
                } else {
                  setTelefonoAdvertencia('');
                }
              } catch (formatError) {
                console.warn('⚠️ Error al formatear teléfono, usando sin formatear:', formatError);
                // Si falla el formateo, usar el teléfono limpio
                setTelefonoAdvertencia('');
              }
            } else {
              console.warn('⚠️ El teléfono quedó vacío después de limpiarlo');
              setTelefonoAdvertencia('');
            }
          } else {
            console.warn('⚠️ No se pudo extraer un número telefónico válido');
            setTelefonoAdvertencia('');
          }
        }

        if (!nombre && !telefono) {
          console.warn('⚠️ No se pudo extraer nombre ni teléfono del contacto');
          alert('El contacto seleccionado no tiene nombre ni teléfono disponibles.');
          return;
        }

        // Mostrar mensaje informativo si hay múltiples números pero importar igual
        if (tieneMultiplesNumeros && telefono) {
          console.log(`ℹ️ Importando primer número de ${contact.tel?.length || 0} números disponibles`);
          // Opcional: mostrar un mensaje breve al usuario
          // No usamos alert para no interrumpir, pero se puede agregar si es necesario
        }

        if (!nombre) {
          console.warn('⚠️ El contacto no tiene nombre, solo teléfono');
        }

        if (!telefono) {
          console.warn('⚠️ El contacto no tiene teléfono, solo nombre');
          alert('El contacto seleccionado no tiene un número telefónico válido.');
          return;
        }

        // Actualizar el formulario con los datos del contacto (limpiar y validar)
        setNuevoCliente(prev => ({
          ...prev,
          name: nombre || prev.name || '',
          phone: telefono || prev.phone || ''
        }));
        
        console.log('✅ Contacto importado correctamente');
        console.log('   - Nombre:', nombre || '(sin nombre)');
        console.log('   - Teléfono:', telefono);
        if (tieneMultiplesNumeros) {
          console.log('   - Nota: Se importó el primer número de múltiples disponibles');
        }
      } else {
        console.warn('⚠️ No se recibieron contactos');
      }
    } catch (error: any) {
      console.error('❌ Error completo al importar contacto:', error);
      console.error('Tipo de error:', error.constructor.name);
      console.error('Nombre del error:', error.name);
      console.error('Mensaje del error:', error.message);
      console.error('Stack:', error.stack);
      
      // El usuario canceló la selección
      if (error.name === 'AbortError' || error.name === 'NotFoundError') {
        console.log('ℹ️ Usuario canceló la selección de contacto');
        return; // No mostrar error si el usuario canceló
      }
      
      // Otros errores - mostrar mensaje específico si es Brave o error genérico
      const errorMessage = error.message || 'Error desconocido';
      let userMessage = errorMessage;
      
      // Mensaje específico para Brave
      if (errorMessage.includes('Brave browser bloquea')) {
        userMessage = errorMessage;
      } else if (errorMessage.includes('Unable to open')) {
        userMessage = 'No se pudo abrir el selector de contactos.\n\nPosibles causas:\n- Tu navegador está bloqueando el acceso a contactos por privacidad (Brave, Firefox)\n- Los permisos del navegador no están configurados\n\nSolución: Prueba con Chrome o Edge en Android.';
      }
      
      alert(`Error al importar el contacto:\n\n${userMessage}\n\nPor favor, verifica que tu navegador soporte la API de contactos y que estés usando HTTPS.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {title || (clienteEditando ? 'Editar Cliente' : 'Crear Nuevo Cliente')}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                className="input-field"
                value={nuevoCliente.name}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Teléfono *
                </label>
                {!clienteEditando && contactsSupported && (
                  <button
                    type="button"
                    onClick={handleImportarContacto}
                    className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-800 transition-colors"
                    title="Importar contacto desde el dispositivo"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    <span className="text-xs">Importar contacto</span>
                  </button>
                )}
              </div>
              <input
                type="tel"
                className="input-field"
                value={nuevoCliente.phone}
                onChange={(e) => {
                  // Solo actualizar el valor sin formatear mientras se escribe
                  setNuevoCliente(prev => ({ ...prev, phone: e.target.value }));
                  // Limpiar advertencia mientras se escribe
                  setTelefonoAdvertencia('');
                }}
                onBlur={(e) => {
                  // Formatear solo cuando el usuario termine de escribir (onBlur)
                  const formattedPhone = formatColombianPhone(e.target.value);
                  setNuevoCliente(prev => ({ ...prev, phone: formattedPhone }));
                  
                  // Validar si es un celular colombiano válido
                  if (formattedPhone) {
                    const validacion = isValidColombianCellphone(formattedPhone);
                    if (!validacion.isValid && validacion.message) {
                      setTelefonoAdvertencia(validacion.message);
                    } else {
                      setTelefonoAdvertencia('');
                    }
                  } else {
                    setTelefonoAdvertencia('');
                  }
                }}
                required
                placeholder="Ej: 3001234567 o 3172478520"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se formateará automáticamente a formato colombiano (+57)
              </p>
              {telefonoAdvertencia && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  ⚠️ <strong>Advertencia:</strong> {telefonoAdvertencia}
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                className="input-field"
                value={nuevoCliente.address}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ej: Calle 123 #45-67, Barrio Centro"
              />
            </div>
            <div className="md:col-span-2">
              <LocationPicker
                onLocationSelect={(lat, lng) => {
                  setNuevoCliente(prev => ({
                    ...prev,
                    ubicacionGPS: { lat, lng }
                  }));
                }}
                initialLocation={nuevoCliente.ubicacionGPS}
                label="Ubicación GPS (Opcional)"
                getCurrentMapCenter={(getCenterFn) => {
                  setGetCurrentMapCenter(() => getCenterFn);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 <strong>Nota:</strong> La ubicación GPS es opcional. Si deseas guardarla, haz clic en el botón "Mi Ubicación GPS" arriba. 
                {nuevoCliente.ubicacionGPS ? (
                  <span className="text-green-600 font-medium"> ✓ Ubicación guardada</span>
                ) : (
                  <span className="text-gray-400"> No se ha guardado ubicación</span>
                )}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                className="input-field"
                rows={3}
                value={nuevoCliente.notes}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Información adicional sobre el cliente..."
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Guardando...' : (clienteEditando ? 'Actualizar Cliente' : 'Crear Cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCliente;

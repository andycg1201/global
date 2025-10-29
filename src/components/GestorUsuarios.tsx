import React, { useState, useEffect } from 'react';
import {
  UserIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { usuarioService, permisosPorDefectoOperador, permisosAdmin, permisosPorDefectoManager } from '../services/usuarioService';
import { User, UserRole, Permisos } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface GestorUsuariosProps {
  onClose?: () => void;
}

const GestorUsuarios: React.FC<GestorUsuariosProps> = ({ onClose }) => {
  const { user: currentUser, esAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<User | null>(null);
  const [mostrarConfirmacionRestablecer, setMostrarConfirmacionRestablecer] = useState(false);
  const [usuarioParaRestablecer, setUsuarioParaRestablecer] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'operador' as UserRole,
    permisos: permisosPorDefectoOperador
  });

  useEffect(() => {
    if (esAdmin()) {
      cargarUsuarios();
    }
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const usuariosData = await usuarioService.getAllUsuarios();
      setUsuarios(usuariosData);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const abrirFormulario = (usuario?: User) => {
    if (usuario) {
      setUsuarioEditando(usuario);
      setFormData({
        email: usuario.email,
        password: '', // No mostrar contraseña
        name: usuario.name,
        role: usuario.role,
        permisos: usuario.permisos || (usuario.role === 'manager' ? permisosPorDefectoManager : permisosPorDefectoOperador)
      });
    } else {
      setUsuarioEditando(null);
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'operador',
        permisos: permisosPorDefectoOperador
      });
    }
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setUsuarioEditando(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'operador',
      permisos: permisosPorDefectoOperador
    });
  };

  const handleRolChange = (rol: UserRole) => {
    setFormData(prev => {
      let permisosActualizados: Permisos;
      
      if (rol === 'admin') {
        permisosActualizados = permisosAdmin;
      } else if (rol === 'operador') {
        permisosActualizados = permisosPorDefectoOperador;
      } else if (rol === 'manager') {
        permisosActualizados = permisosPorDefectoManager;
      } else {
        // Fallback
        permisosActualizados = permisosPorDefectoOperador;
      }
      
      return {
        ...prev,
        role: rol,
        permisos: permisosActualizados
      };
    });
  };

  const handlePermisoChange = (permiso: keyof Permisos) => {
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [permiso]: !prev.permisos[permiso]
      }
    }));
  };

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;

    try {
      if (usuarioEditando) {
        // Actualizar usuario existente
        await usuarioService.actualizarUsuario(
          usuarioEditando.id,
          {
            name: formData.name,
            role: formData.role,
            permisos: formData.role === 'manager' ? formData.permisos : undefined,
            isActive: true
          },
          currentUser.id
        );
        alert('Usuario actualizado exitosamente');
      } else {
        // Crear nuevo usuario
        if (!formData.password || formData.password.length < 6) {
          alert('La contraseña debe tener al menos 6 caracteres');
          return;
        }
        
        await usuarioService.crearUsuario(
          formData.email,
          formData.password,
          formData.name,
          formData.role,
          currentUser.id,
          formData.role === 'manager' ? formData.permisos : undefined
        );
        alert('Usuario creado exitosamente');
      }
      
      await cargarUsuarios();
      cerrarFormulario();
    } catch (error: any) {
      console.error('Error al guardar usuario:', error);
      alert(error.message || 'Error al guardar usuario');
    }
  };

  const eliminarUsuario = async (usuario: User) => {
    if (!confirm(`¿Estás seguro de que quieres desactivar al usuario "${usuario.name}"?`)) {
      return;
    }

    if (!currentUser) return;

    try {
      await usuarioService.eliminarUsuario(usuario.id, currentUser.id);
      alert('Usuario desactivado exitosamente');
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      alert('Error al desactivar usuario');
    }
  };

  const abrirConfirmacionRestablecer = (usuario: User) => {
    setUsuarioParaRestablecer(usuario);
    setMostrarConfirmacionRestablecer(true);
  };

  const restablecerContraseña = async () => {
    if (!usuarioParaRestablecer || !currentUser) return;

    try {
      await usuarioService.restablecerContraseña(
        usuarioParaRestablecer.email,
        '',
        currentUser.id
      );
      alert('Email de restablecimiento enviado exitosamente');
      setMostrarConfirmacionRestablecer(false);
      setUsuarioParaRestablecer(null);
    } catch (error: any) {
      console.error('Error al restablecer contraseña:', error);
      alert(error.message || 'Error al restablecer contraseña');
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'operador':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!esAdmin()) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">No tienes permisos para gestionar usuarios.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <UserIcon className="h-6 w-6 text-primary-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-900">Gestión de Usuarios</h3>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => abrirFormulario()}
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nuevo Usuario
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="space-y-3">
        {usuarios.map(usuario => (
          <div
            key={usuario.id}
            className={`border rounded-lg p-4 ${
              usuario.isActive ? 'border-gray-200' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-lg font-medium text-primary-600">
                        {usuario.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">{usuario.name}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(usuario.role)}`}>
                        {usuario.role}
                      </span>
                      {!usuario.isActive && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{usuario.email}</p>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => abrirFormulario(usuario)}
                  className="text-warning-600 hover:text-warning-700"
                  title="Editar"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => abrirConfirmacionRestablecer(usuario)}
                  className="text-blue-600 hover:text-blue-700"
                  title="Restablecer contraseña"
                >
                  <KeyIcon className="h-5 w-5" />
                </button>
                {usuario.isActive && (
                  <button
                    onClick={() => eliminarUsuario(usuario)}
                    className="text-danger-600 hover:text-danger-700"
                    title="Desactivar"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {usuarios.length === 0 && (
        <div className="text-center py-8">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No hay usuarios registrados</p>
          <button
            onClick={() => abrirFormulario()}
            className="btn-primary"
          >
            Crear Primer Usuario
          </button>
        </div>
      )}

      {/* Modal de formulario */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {usuarioEditando ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button
                onClick={cerrarFormulario}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={guardarUsuario} className="space-y-4">
              {/* Datos básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    disabled={!!usuarioEditando}
                  />
                  {usuarioEditando && (
                    <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar</p>
                  )}
                </div>

                {!usuarioEditando && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    className="input-field"
                    value={formData.role}
                    onChange={(e) => handleRolChange(e.target.value as UserRole)}
                    required
                  >
                    <option value="operador">Operador</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {/* Permisos (solo para manager) */}
              {formData.role === 'manager' && (
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Permisos</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Navegación */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold text-gray-700">Navegación</h5>
                      {(['verDashboard', 'verPedidos', 'verClientes', 'verInventario', 'verGastos', 'verCapital', 'verReportes', 'verConfiguracion', 'verAuditoria'] as (keyof Permisos)[]).map(permiso => (
                        <label key={permiso} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permisos[permiso]}
                            onChange={() => handlePermisoChange(permiso)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{permiso.replace('ver', 'Ver ')}</span>
                        </label>
                      ))}
                    </div>

                    {/* Acciones Servicios */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold text-gray-700">Servicios</h5>
                      {(['crearServicios', 'modificarServicios', 'eliminarServicios', 'entregarServicios', 'recogerServicios'] as (keyof Permisos)[]).map(permiso => (
                        <label key={permiso} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permisos[permiso]}
                            onChange={() => handlePermisoChange(permiso)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{permiso.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </label>
                      ))}
                    </div>

                    {/* Otras acciones */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold text-gray-700">Otras Acciones</h5>
                      {(['crearClientes', 'editarClientes', 'eliminarClientes', 'gestionarInventario', 'crearGastos', 'eliminarGastos', 'crearPagos', 'eliminarPagos', 'gestionarCapital', 'exportarReportes', 'verFiltrosReportes', 'gestionarUsuarios', 'verIndicadoresAuditoria'] as (keyof Permisos)[]).map(permiso => (
                        <label key={permiso} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permisos[permiso]}
                            onChange={() => handlePermisoChange(permiso)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{permiso.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={cerrarFormulario}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {usuarioEditando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para restablecer contraseña */}
      {mostrarConfirmacionRestablecer && usuarioParaRestablecer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <KeyIcon className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">
                Restablecer Contraseña
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">
                Se enviará un email de restablecimiento a:
              </p>
              <p className="text-sm font-medium text-gray-900">
                {usuarioParaRestablecer.email}
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setMostrarConfirmacionRestablecer(false);
                  setUsuarioParaRestablecer(null);
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={restablecerContraseña}
                className="btn-primary"
              >
                Enviar Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorUsuarios;


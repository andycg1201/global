import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { User, Permisos, UserRole } from '../types';
import { auditoriaService } from './auditoriaService';

// Permisos por defecto para operador
export const permisosPorDefectoOperador: Permisos = {
  verDashboard: true,
  verPedidos: true,
  verClientes: true,
  verInventario: false,
  verGastos: true,
  verCapital: false,
  verReportes: false, // Operador no puede ver reportes
  verConfiguracion: false,
  verAuditoria: false,
  verPagos: true, // Operador puede ver pagos
  
  crearServicios: true,
  modificarServicios: true,
  eliminarServicios: false, // Operador no puede eliminar servicios
  entregarServicios: true,
  recogerServicios: true,
  
  crearClientes: true,
  editarClientes: true,
  eliminarClientes: false,
  
  gestionarInventario: false,
  
  crearGastos: true,
  eliminarGastos: false, // Operador no puede eliminar gastos
  
  crearPagos: true, // Operador puede crear pagos
  eliminarPagos: false, // Operador no puede eliminar pagos
  
  gestionarCapital: false,
  
  exportarReportes: false,
  verFiltrosReportes: false, // No puede ver reportes
  
  gestionarUsuarios: false,
  
  verIndicadoresAuditoria: false
};

// Permisos por defecto para un manager
export const permisosPorDefectoManager: Permisos = {
  verDashboard: true,
  verPedidos: true,
  verClientes: true,
  verInventario: true,
  verGastos: true,
  verCapital: true,
  verReportes: true,
  verConfiguracion: false, // Manager no puede gestionar usuarios
  verAuditoria: true,
  verPagos: true, // Manager puede ver pagos
  
  crearServicios: true,
  modificarServicios: true,
  eliminarServicios: true,
  entregarServicios: true,
  recogerServicios: true,
  
  crearClientes: true,
  editarClientes: true,
  eliminarClientes: true,
  
  gestionarInventario: true,
  
  crearGastos: true,
  eliminarGastos: true, // Manager puede eliminar gastos
  
  crearPagos: true, // Manager puede crear pagos
  eliminarPagos: true, // Manager puede eliminar pagos
  
  gestionarCapital: true,
  
  exportarReportes: true,
  verFiltrosReportes: true,
  
  gestionarUsuarios: false, // Manager no puede gestionar usuarios
  verIndicadoresAuditoria: true
};

// Todos los permisos en true (para admin)
export const permisosAdmin: Permisos = {
  verDashboard: true,
  verPedidos: true,
  verClientes: true,
  verInventario: true,
  verGastos: true,
  verCapital: true,
  verReportes: true,
  verConfiguracion: true,
  verAuditoria: true,
  verPagos: true, // Admin puede ver pagos
  
  crearServicios: true,
  modificarServicios: true,
  eliminarServicios: true,
  entregarServicios: true,
  recogerServicios: true,
  
  crearClientes: true,
  editarClientes: true,
  eliminarClientes: true,
  
  gestionarInventario: true,
  
  crearGastos: true,
  eliminarGastos: true, // Admin puede eliminar gastos
  
  crearPagos: true, // Admin puede crear pagos
  eliminarPagos: true, // Admin puede eliminar pagos
  
  gestionarCapital: true,
  
  exportarReportes: true,
  verFiltrosReportes: true,
  
  gestionarUsuarios: true,
  
  verIndicadoresAuditoria: true
};

class UsuarioService {
  private collectionName = 'users';

  // Obtener todos los usuarios
  async getAllUsuarios(): Promise<User[]> {
    try {
      const q = query(collection(db, this.collectionName));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          name: data.name,
          role: data.role as UserRole,
          permisos: data.permisos as Permisos | undefined,
          createdAt: data.createdAt?.toDate() || new Date(),
          isActive: data.isActive ?? true,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        } as User;
      });
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }

  // Obtener un usuario por ID
  async getUsuarioById(usuarioId: string): Promise<User | null> {
    try {
      const docRef = doc(db, this.collectionName, usuarioId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        id: docSnap.id,
        email: data.email,
        name: data.name,
        role: data.role as UserRole,
        permisos: data.permisos as Permisos | undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        isActive: data.isActive ?? true,
        updatedAt: data.updatedAt?.toDate(),
        updatedBy: data.updatedBy
      } as User;
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      throw error;
    }
  }

  // Crear nuevo usuario
  async crearUsuario(
    email: string,
    password: string,
    name: string,
    role: UserRole,
    createdBy: string,
    permisos?: Permisos
  ): Promise<string> {
    try {
      // Crear usuario en Firebase Auth
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Determinar permisos según el rol
      let permisosFinales: Permisos | undefined;
      if (role === 'admin') {
        permisosFinales = permisosAdmin;
      } else if (role === 'operador') {
        permisosFinales = permisosPorDefectoOperador;
      } else if (role === 'manager') {
        permisosFinales = permisos || permisosPorDefectoOperador;
      }

      // Crear documento en Firestore
      const usuarioData = {
        email: firebaseUser.email,
        name,
        role,
        permisos: permisosFinales,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: createdBy
      };

      await setDoc(doc(db, this.collectionName, firebaseUser.uid), usuarioData);

      // Registrar en auditoría
      await auditoriaService.registrarAccion({
        tipoAccion: 'crear_usuario',
        entidadId: firebaseUser.uid,
        entidadTipo: 'usuario',
        detalles: `Usuario ${name} creado con rol ${role}`,
        valoresNuevos: { email, name, role, permisos: permisosFinales }
      });

      return firebaseUser.uid;
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  // Actualizar usuario
  async actualizarUsuario(
    usuarioId: string,
    updates: {
      name?: string;
      role?: UserRole;
      permisos?: Permisos;
      isActive?: boolean;
    },
    updatedBy: string
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, usuarioId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const valoresAnteriores = docSnap.data();
      
      // Si cambia el rol, actualizar permisos
      if (updates.role) {
        if (updates.role === 'admin') {
          updates.permisos = permisosAdmin;
        } else if (updates.role === 'operador') {
          updates.permisos = permisosPorDefectoOperador;
        }
        // Si es manager, mantener los permisos proporcionados o los existentes
      }

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
        updatedBy
      });

      // Registrar en auditoría
      await auditoriaService.registrarAccion({
        tipoAccion: 'editar_usuario',
        entidadId: usuarioId,
        entidadTipo: 'usuario',
        detalles: `Usuario actualizado`,
        valoresAnteriores,
        valoresNuevos: updates
      });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  }

  // Restablecer contraseña
  async restablecerContraseña(
    email: string,
    newPassword: string,
    restablecidoPor: string
  ): Promise<void> {
    try {
      // Buscar usuario por email
      const q = query(collection(db, this.collectionName), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Usuario no encontrado');
      }

      const usuarioDoc = querySnapshot.docs[0];
      const usuarioId = usuarioDoc.id;

      // Enviar email de restablecimiento
      await sendPasswordResetEmail(auth, email);

      // Registrar en auditoría
      await auditoriaService.registrarAccion({
        tipoAccion: 'restablecer_contraseña',
        entidadId: usuarioId,
        entidadTipo: 'usuario',
        detalles: `Contraseña restablecida para ${email}`,
        valoresNuevos: { email }
      });
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      throw error;
    }
  }

  // Eliminar usuario (desactivar)
  async eliminarUsuario(usuarioId: string, eliminadoPor: string): Promise<void> {
    try {
      await this.actualizarUsuario(usuarioId, { isActive: false }, eliminadoPor);

      // Registrar en auditoría
      await auditoriaService.registrarAccion({
        tipoAccion: 'eliminar_usuario',
        entidadId: usuarioId,
        entidadTipo: 'usuario',
        detalles: 'Usuario desactivado',
        valoresNuevos: { isActive: false }
      });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  }
}

export const usuarioService = new UsuarioService();


import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, Permisos } from '../types';
import { permisosAdmin, permisosPorDefectoOperador, permisosPorDefectoManager } from '../services/usuarioService';
import { auditoriaService } from '../services/auditoriaService';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  permisos: Permisos;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  tienePermiso: (permiso: keyof Permisos) => boolean;
  esAdmin: () => boolean;
  esManager: () => boolean;
  esOperador: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permisos, setPermisos] = useState<Permisos>(permisosPorDefectoOperador);

  // Función para calcular permisos según el rol del usuario
  const calcularPermisos = (user: User | null): Permisos => {
    if (!user || !user.isActive) {
      return permisosPorDefectoOperador; // Permisos mínimos
    }

    if (user.role === 'admin') {
      return permisosAdmin;
    }

    if (user.role === 'operador') {
      return permisosPorDefectoOperador;
    }

    // Manager: usar permisos específicos o por defecto del manager
    if (user.role === 'manager') {
      return user.permisos || permisosPorDefectoManager;
    }

    return permisosPorDefectoOperador;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        console.log('Buscando usuario en Firestore:', firebaseUser.uid);
        // Obtener datos del usuario desde Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        console.log('Documento encontrado:', userDoc.exists());
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Datos del usuario:', userData);
          
          const usuario: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            name: userData.name,
            role: userData.role,
            permisos: userData.permisos,
            createdAt: userData.createdAt?.toDate() || new Date(),
            isActive: userData.isActive ?? true,
            updatedAt: userData.updatedAt?.toDate(),
            updatedBy: userData.updatedBy
          };

          setUser(usuario);
          
          // Calcular y establecer permisos
          const permisosCalculados = calcularPermisos(usuario);
          setPermisos(permisosCalculados);
          
          // Guardar usuario en localStorage para auditoría
          auditoriaService.setCurrentUser({
            id: usuario.id,
            name: usuario.name,
            email: usuario.email
          });
        } else {
          console.log('Usuario no encontrado en Firestore');
          setUser(null);
          setPermisos(permisosPorDefectoOperador);
          auditoriaService.setCurrentUser(null);
        }
      } else {
        setUser(null);
        setPermisos(permisosPorDefectoOperador);
        auditoriaService.setCurrentUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Intentando login con:', email);
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login exitoso:', result.user.uid);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      auditoriaService.setCurrentUser(null);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  // Funciones helper para verificar permisos
  const tienePermiso = (permiso: keyof Permisos): boolean => {
    return permisos[permiso] === true;
  };

  const esAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  const esManager = (): boolean => {
    return user?.role === 'manager';
  };

  const esOperador = (): boolean => {
    return user?.role === 'operador';
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    permisos,
    login,
    logout,
    tienePermiso,
    esAdmin,
    esManager,
    esOperador
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

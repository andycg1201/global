import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createUser: (email: string, password: string, name: string, role: 'admin' | 'empleado') => Promise<void>;
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
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            name: userData.name,
            role: userData.role,
            createdAt: userData.createdAt?.toDate() || new Date(),
            isActive: userData.isActive
          });
        } else {
          console.log('Usuario no encontrado en Firestore');
        }
      } else {
        setUser(null);
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
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  const createUser = async (
    email: string, 
    password: string, 
    name: string, 
    role: 'admin' | 'empleado'
  ) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Crear documento de usuario en Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        email: newUser.email,
        name,
        role,
        isActive: true,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    login,
    logout,
    createUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

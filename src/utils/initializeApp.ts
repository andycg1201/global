import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  addDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  initialPlans, 
  initialConceptosGastos, 
  initialConfiguracion,
  initialAdminUser,
  initialEmployeeUser
} from '../data/initialData';

export const initializeApp = async () => {
  try {
    console.log('Inicializando aplicación...');

    // Verificar si ya existen planes
    const planesSnapshot = await getDocs(collection(db, 'planes'));
    if (planesSnapshot.empty) {
      console.log('Creando planes iniciales...');
      for (const plan of initialPlans) {
        await addDoc(collection(db, 'planes'), {
          ...plan,
          createdAt: Timestamp.now()
        });
      }
    }

    // Verificar si ya existen conceptos de gastos
    const conceptosSnapshot = await getDocs(collection(db, 'conceptosGastos'));
    if (conceptosSnapshot.empty) {
      console.log('Creando conceptos de gastos iniciales...');
      for (const concepto of initialConceptosGastos) {
        await addDoc(collection(db, 'conceptosGastos'), {
          ...concepto,
          createdAt: Timestamp.now()
        });
      }
    }

    // Verificar si ya existe configuración
    const configDoc = doc(db, 'configuracion', 'general');
    const configSnapshot = await getDocs(collection(db, 'configuracion'));
    if (configSnapshot.empty) {
      console.log('Creando configuración inicial...');
      await setDoc(configDoc, {
        ...initialConfiguracion,
        updatedAt: Timestamp.now()
      });
    }

    console.log('Aplicación inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    return false;
  }
};

// Función para crear usuarios iniciales (solo para desarrollo)
export const createInitialUsers = async () => {
  try {
    console.log('Creando usuarios iniciales...');
    
    // Nota: Los usuarios se crean a través de Firebase Auth
    // Esta función solo documenta los usuarios que deben crearse manualmente
    
    console.log('Usuarios a crear manualmente:');
    console.log('Admin:', initialAdminUser);
    console.log('Empleado:', initialEmployeeUser);
    
    return true;
  } catch (error) {
    console.error('Error al crear usuarios iniciales:', error);
    return false;
  }
};





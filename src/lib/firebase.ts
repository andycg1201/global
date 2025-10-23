import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

// Suprimir errores de BloomFilter de Firebase (errores internos que no afectan funcionalidad)
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args[0];
  if (typeof message === 'string' && message.includes('BloomFilter error')) {
    return; // Suprimir este error específico
  }
  originalConsoleWarn.apply(console, args);
};

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCfvWZ3JSNunOOjXo3hrVBPITcNcgmsYzk",
  authDomain: "global-da5ac.firebaseapp.com",
  projectId: "global-da5ac",
  storageBucket: "global-da5ac.firebasestorage.app",
  messagingSenderId: "775771166181",
  appId: "1:775771166181:web:8e3e67f4b87fa033778b0c",
  measurementId: "G-JZJS38Y5DG"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Inicializar Analytics solo en el navegador
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;

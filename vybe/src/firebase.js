import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDemoKey123456789", // Reemplazar después
  authDomain: "tu-proyecto.firebaseapp.com", // Reemplazar después
  projectId: "tu-proyecto-id", // Reemplazar después
  storageBucket: "tu-proyecto.appspot.com", // Reemplazar después
  messagingSenderId: "123456789", // Reemplazar después
  appId: "1:123456789:web:abcdef123456"  // Reemplazar después
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Authentication
export const auth = getAuth(app);

// Inicializar Firestore
export const db = getFirestore(app);

export default app;
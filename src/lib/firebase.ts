import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1Y6zek-7UH9jc9Z--lQVgvO0ASPkqjfo",
  authDomain: "trackstar-4dcbc.firebaseapp.com",
  projectId: "trackstar-4dcbc",
  storageBucket: "trackstar-4dcbc.firebasestorage.app",
  messagingSenderId: "5594430367",
  appId: "1:5594430367:web:9dac3d6f15f394fcee5baa",
  measurementId: "G-JLW2T3QFS5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

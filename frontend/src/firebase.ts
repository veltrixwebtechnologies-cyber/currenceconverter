import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyATyNrrj05w2_pGnTM_LXX-aE0xrOVPWQA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "currenceconverter.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "currenceconverter",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "currenceconverter.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "51172455960",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:51172455960:web:7920472e086a74c32f356d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LMF8ZVQP2S"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
  signInWithPopup,
  signInWithRedirect,
  firebaseSignOut,
  onAuthStateChanged,
  type User
};

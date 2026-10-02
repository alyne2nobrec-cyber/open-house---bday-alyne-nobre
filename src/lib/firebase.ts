import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyDZa0MSjqjotOZHNQIdbZrIIbxrXgvLACc",
  authDomain: "cha-casa-nova-2f3f3.firebaseapp.com",
  projectId: "cha-casa-nova-2f3f3",
  storageBucket: "cha-casa-nova-2f3f3.firebasestorage.app",
  messagingSenderId: "1050577282920",
  appId: "1:1050577282920:web:e1d3fe61c38e88996f58dd",
  measurementId: "G-S10LLW1PTY"
};

// Initialize Firebase only once
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

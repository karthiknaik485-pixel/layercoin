// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * FIREBASE CONFIGURATION
 * 
 * Replace the values below with your own project configuration from the Firebase Console.
 * To get this: Firebase Console -> Project Settings -> General -> Your Apps -> Web App SDK Setup
 */
const firebaseConfig = {
    apiKey: "AIzaSyANkbVrBtZDTapeXZLdGzipE8xUzuF-_Hg",
    authDomain: "layercoin-5caf6.firebaseapp.com",
    projectId: "layercoin-5caf6",
    storageBucket: "layercoin-5caf6.firebasestorage.app",
    messagingSenderId: "1037237106875",
    appId: "1:1037237106875:web:765b901e316ef7d5e1519e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export instances to use in other files
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

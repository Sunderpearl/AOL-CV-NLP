// ========================================
// FreshScan GPT — Firebase Configuration
// Uses Firebase Compat SDK (loaded via CDN <script> tags)
// DO NOT use ES module imports here — they break on file:// protocol
// ========================================

const firebaseConfig = {
  apiKey: "AIzaSyAHdJnpojBxnbNVH7hE8ADyO8W1a8Osi9E",
  authDomain: "cv-nlp-ai.firebaseapp.com",
  projectId: "cv-nlp-ai",
  storageBucket: "cv-nlp-ai.firebasestorage.app",
  messagingSenderId: "469908726817",
  appId: "1:469908726817:web:74247acf2986bcb39eaf60",
  measurementId: "G-G567M4W6YK"
};

// Initialize Firebase (using compat SDK global loaded via <script> tags)
firebase.initializeApp(firebaseConfig);

// Auth service
const auth = firebase.auth();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

console.log('🔥 Firebase initialized for project:', firebaseConfig.projectId);

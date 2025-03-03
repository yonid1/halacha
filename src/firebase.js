import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBCkPOvQqA3zdSUBLnypb-MOhgW9NhHoH0",
  authDomain: "status-deyli.firebaseapp.com",
  projectId: "status-deyli",
  storageBucket: "status-deyli.firebasestorage.app",
  messagingSenderId: "873525007411",
  appId: "1:873525007411:web:723c50a76129b96261ff46",
  measurementId: "G-MPZE983695"
};

// אתחול Firebase
const app = initializeApp(firebaseConfig);

// אתחול Analytics
const analytics = getAnalytics(app);

// אתחול Firestore
const db = getFirestore(app);

export { db, analytics };
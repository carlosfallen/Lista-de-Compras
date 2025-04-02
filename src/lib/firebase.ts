import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDULf3XSwiiFQZ7q_M9YNieDbWZNLnO7Nw",
  authDomain: "myapp-415315.firebaseapp.com",
  databaseURL: "https://myapp-415315-default-rtdb.firebaseio.com",
  projectId: "myapp-415315",
  storageBucket: "myapp-415315.appspot.com",
  messagingSenderId: "103002319588",
  appId: "1:103002319588:web:6905204b85109b6d4e1af1",
  measurementId: "G-1Y5QTRJTYP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAiF6124uf2z7gPvAaifhV0Hi-yk5s5c9w",
  authDomain: "nyambox-c7568.firebaseapp.com",
  projectId: "nyambox-c7568",
  storageBucket: "nyambox-c7568.firebasestorage.app",
  messagingSenderId: "298214286518",
  appId: "1:298214286518:web:16d87159b7b4db1b923217",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId;
console.log(`[Firebase] Initialization -> Project: ${firebaseConfig.projectId}, DB: ${databaseId || '(default)'}`);

export const db = getFirestore(app, databaseId || undefined);

export const auth = getAuth(app);

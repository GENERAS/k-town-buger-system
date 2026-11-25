import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firebaseConfig.firestoreDatabaseId for Enterprise / named Firestore databases
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAPPED_ADMIN_EMAIL = 'generaskagiraneza@gmail.com';

export async function testConnection(): Promise<{ ok: boolean; offline: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, offline: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const offline = msg.includes('the client is offline');
    if (offline) {
      console.error('Please check your Firebase configuration.', msg);
    }
    return { ok: false, offline, error: msg };
  }
}

void testConnection();

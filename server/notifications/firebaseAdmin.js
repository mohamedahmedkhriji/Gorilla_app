import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let messagingInstance;
let configurationChecked = false;

export const getFirebaseMessaging = () => {
  if (configurationChecked) return messagingInstance || null;
  configurationChecked = true;

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin credentials are not configured. Push delivery is disabled.');
    return null;
  }

  const app = getApps()[0] || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  messagingInstance = getMessaging(app);
  return messagingInstance;
};

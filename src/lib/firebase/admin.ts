import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId) {
    throw new Error("Thiếu FIREBASE_PROJECT_ID trong .env.local");
  }

  if (!clientEmail) {
    throw new Error("Thiếu FIREBASE_CLIENT_EMAIL trong .env.local");
  }

  if (!privateKey) {
    throw new Error("Thiếu FIREBASE_PRIVATE_KEY trong .env.local");
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket,
  });
}

export function getAdminDb() {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}

export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}
export function getAdminStorageBucket() {
  const app = getFirebaseAdminApp();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error(
      "Thiếu FIREBASE_STORAGE_BUCKET hoặc NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET trong .env.local"
    );
  }

  return getStorage(app).bucket(bucketName);
}

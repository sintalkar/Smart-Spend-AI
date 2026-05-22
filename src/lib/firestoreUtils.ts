import { auth } from '../firebase';
import { doc, getDocFromServer, Firestore } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  
  let errorMessage = "Unknown error";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    errorMessage = JSON.stringify(error);
  } else {
    errorMessage = String(error);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo, null, 2);
  console.error(`[Firestore Error] Op: ${operationType}, Path: ${path}`);
  console.error('Auth Context:', {
    loggedIn: !!currentUser,
    uid: currentUser?.uid,
    email: currentUser?.email
  });
  console.error('Full Error Details:', errorJson);
  throw new Error(errorJson);
}

export async function testFirestoreConnection(db: Firestore) {
  try {
    console.log("[Firestore] Testing connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection check: Success");
  } catch (error: any) {
    console.error("[Firestore] Connection test failed:", error);
    if (error.code === 'permission-denied') {
      console.log("Firestore connection check: Connected but access denied (expected if no 'test' doc)");
    } else if (error.message?.includes('offline') || error.code === 'unavailable') {
      console.error("Firestore connection check: Client is offline or database unavailable. Check Firebase config.");
    } else {
      console.error("Firestore connection check: Error type:", typeof error, "Code:", error.code);
    }
  }
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db as firestoreDb } from '../../firebase';
import AuthScreen from '../../features/auth/AuthScreen';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { db } from '../../db/database';
import { syncService } from '../../services/FirebaseSyncService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem('smartspend_demo_auth');
  }, []);

  const logout = async () => {
    try {
      syncService.stopSync();
      await auth.signOut();
      await db.clearAllData();
      localStorage.removeItem('initial_balance');
      localStorage.removeItem('ai_greeting_cache');
      console.log('[AuthProvider] User signed out and local data cleared');
    } catch (error) {
      console.error('[AuthProvider] Sign out error:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      const handleAuthState = async () => {
        try {
          if (u) {
            console.log(`[AuthProvider] User logged in: ${u.uid} (${u.email})`);
            const userDocPath = `users/${u.uid}`;

            try {
              const userDocRef = doc(firestoreDb, userDocPath);
              await setDoc(
                userDocRef,
                {
                  uid: u.uid,
                  email: u.email,
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  emailVerified: u.emailVerified,
                  lastLogin: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (error: any) {
              console.error(`[AuthProvider] Failed to write to ${userDocPath}`, error);
              try {
                handleFirestoreError(error, OperationType.WRITE, userDocPath);
              } catch {}
            }

            syncService.startSync();
          } else {
            syncService.stopSync();
          }

          setUser(u);
          setLoading(false);
        } catch (err) {
          console.error('[AuthProvider] Unhandled error in auth state change:', err);
          setLoading(false);
        }
      };

      handleAuthState().catch((err) => {
        console.error('[AuthProvider] Critical unhandled promise rejection:', err);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthProvider';
import { db as firestoreDb } from '../../firebase';

export interface SubscriptionInfo {
  plan: 'lite' | 'pro';
  validUntil: number | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo>({ plan: 'lite', validUntil: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription({ plan: 'lite', validUntil: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    const userDocRef = doc(firestoreDb, `users/${user.uid}`);
    
    // Subscribe to real-time subscription changes in Firestore
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const sub = data.subscription || {};
        setSubscription({
          plan: sub.plan === 'pro' ? 'pro' : 'lite',
          validUntil: sub.validUntil ? (typeof sub.validUntil.toMillis === 'function' ? sub.validUntil.toMillis() : sub.validUntil) : null
        });
      } else {
        setSubscription({ plan: 'lite', validUntil: null });
      }
      setLoading(false);
    }, (error) => {
      console.error("[useSubscription] Failed to fetch subscription:", error);
      setSubscription({ plan: 'lite', validUntil: null });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const isPro = subscription.plan === 'pro';

  return {
    plan: subscription.plan,
    validUntil: subscription.validUntil,
    isPro,
    loading
  };
}

import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db as firestoreDb } from '../firebase';
import { db } from '../db/database';
import { TransactionEntity } from '../db/models';

class FirebaseSyncService {
  private unsubscribe: (() => void) | null = null;
  public isSyncingFromFirebase = false;

  public async startSync() {
    const user = auth.currentUser;
    if (!user) return;

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const txRef = collection(firestoreDb, `users/${user.uid}/transactions`);
    
    // Perform initial one-time fetch to quickly populate local DB if empty
    try {
      const localCount = await db.transactions.count();
      if (localCount === 0) {
         console.log("[Sync] Local DB empty, fetching from cloud...");
         this.isSyncingFromFirebase = true;
         const snapshot = await getDocs(txRef);
         const cloudTxs: TransactionEntity[] = [];
         snapshot.forEach(doc => cloudTxs.push(doc.data() as TransactionEntity));
         if (cloudTxs.length > 0) {
            await db.transactions.bulkPut(cloudTxs);
         }
         this.isSyncingFromFirebase = false;
      }
    } catch (e) {
      console.error("[Sync] Initial fetch failed:", e);
      this.isSyncingFromFirebase = false;
    }

    // Start real-time listener
    this.unsubscribe = onSnapshot(txRef, async (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return; // Ignore local writes echoed back
      
      this.isSyncingFromFirebase = true;
      try {
        const changes = snapshot.docChanges();
        for (const change of changes) {
          if (change.type === 'added' || change.type === 'modified') {
            await db.transactions.put(change.doc.data() as TransactionEntity);
          }
          if (change.type === 'removed') {
            await db.transactions.delete(change.doc.id);
          }
        }
      } catch (err) {
        console.error("[Sync] Failed to process incoming changes", err);
      } finally {
        this.isSyncingFromFirebase = false;
      }
    });
  }

  public stopSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  public async pushTransaction(tx: TransactionEntity) {
    if (this.isSyncingFromFirebase) return; // Prevent infinite loop
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const docRef = doc(firestoreDb, `users/${user.uid}/transactions`, tx.id);
      await setDoc(docRef, tx);
    } catch (e) {
      console.error("[Sync] Failed to push transaction:", e);
    }
  }

  public async deleteTransaction(id: string) {
    if (this.isSyncingFromFirebase) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(firestoreDb, `users/${user.uid}/transactions`, id);
      await deleteDoc(docRef);
    } catch (e) {
      console.error("[Sync] Failed to delete transaction from cloud:", e);
    }
  }
}

export const syncService = new FirebaseSyncService();

// Attach hooks to Dexie to catch all local changes and push them to the cloud
db.transactions.hook('creating', (primKey, obj) => {
  syncService.pushTransaction(obj).catch(err =>
    console.error('[Sync] Hook: failed to push created transaction', err)
  );
});

db.transactions.hook('updating', (modifications, primKey, obj) => {
  syncService.pushTransaction({ ...obj, ...modifications } as TransactionEntity).catch(err =>
    console.error('[Sync] Hook: failed to push updated transaction', err)
  );
});

db.transactions.hook('deleting', (primKey) => {
  if (typeof primKey === 'string') {
    syncService.deleteTransaction(primKey).catch(err =>
      console.error('[Sync] Hook: failed to delete transaction from cloud', err)
    );
  }
});

import { db as firestoreDb, auth } from '../../firebase';
import {
  doc, collection, onSnapshot, setDoc, getDoc,
  getDocs, query, orderBy, limit, addDoc
} from 'firebase/firestore';

export interface AdminFeatureToggles {
  voiceEntry: boolean;
  receiptScanner: boolean;
  aiParsing: boolean;
  smsDetection: boolean;
  analyticsCollection: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export interface AppAnnouncement {
  active: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  expiresAt: number | null;
  updatedAt: number;
}

export interface AppEvent {
  id?: string;
  userId: string;
  eventType: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

export interface AdminUser {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  lastLogin?: number;
  initialBalance?: number;
  updatedAt?: number;
}

const DEFAULT_TOGGLES: AdminFeatureToggles = {
  voiceEntry: true,
  receiptScanner: true,
  aiParsing: true,
  smsDetection: true,
  analyticsCollection: false,
  maintenanceMode: false,
  maintenanceMessage: 'The app is under maintenance. Please check back soon.',
};

const DEFAULT_ANNOUNCEMENT: AppAnnouncement = {
  active: false,
  title: '',
  message: '',
  type: 'info',
  expiresAt: null,
  updatedAt: 0,
};

class AdminService {
  private toggles: AdminFeatureToggles = { ...DEFAULT_TOGGLES };
  private announcement: AppAnnouncement = { ...DEFAULT_ANNOUNCEMENT };
  private toggleSubscribers = new Set<() => void>();
  private announcementSubscribers = new Set<() => void>();

  constructor() {
    this.initListeners();
  }

  // ─── Real-time Firestore listeners (run for every connected client) ────────

  private initListeners() {
    // Feature flags — every user session gets instant updates when admin changes a toggle
    onSnapshot(
      doc(firestoreDb, 'config', 'features'),
      (snap) => {
        if (snap.exists()) {
          this.toggles = { ...DEFAULT_TOGGLES, ...snap.data() } as AdminFeatureToggles;
          this.toggleSubscribers.forEach(fn => fn());
        }
      },
      (err) => console.warn('[AdminService] features listener error:', err.code)
    );

    // Announcement banner — all users see new banners immediately
    onSnapshot(
      doc(firestoreDb, 'config', 'announcement'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AppAnnouncement;
          const expired = data.expiresAt && Date.now() > data.expiresAt;
          this.announcement = expired ? { ...DEFAULT_ANNOUNCEMENT } : data;
          this.announcementSubscribers.forEach(fn => fn());
        }
      },
      (err) => console.warn('[AdminService] announcement listener error:', err.code)
    );
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  getToggles(): AdminFeatureToggles {
    return { ...this.toggles };
  }

  getAnnouncement(): AppAnnouncement {
    return { ...this.announcement };
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  subscribe(cb: () => void): () => void {
    this.toggleSubscribers.add(cb);
    return () => this.toggleSubscribers.delete(cb);
  }

  subscribeAnnouncement(cb: () => void): () => void {
    this.announcementSubscribers.add(cb);
    return () => this.announcementSubscribers.delete(cb);
  }

  // ─── Admin write APIs (admin panel only) ──────────────────────────────────

  async updateToggles(patch: Partial<AdminFeatureToggles>): Promise<void> {
    const ref = doc(firestoreDb, 'config', 'features');
    await setDoc(ref, { ...this.toggles, ...patch, updatedAt: Date.now() }, { merge: true });
  }

  async updateAnnouncement(announcement: AppAnnouncement): Promise<void> {
    const ref = doc(firestoreDb, 'config', 'announcement');
    await setDoc(ref, { ...announcement, updatedAt: Date.now() });
  }

  async fetchUsers(): Promise<AdminUser[]> {
    const snap = await getDocs(collection(firestoreDb, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser));
  }

  async fetchEvents(n = 100): Promise<AppEvent[]> {
    const q = query(
      collection(firestoreDb, 'appEvents'),
      orderBy('createdAt', 'desc'),
      limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppEvent));
  }

  async getAdminPinHash(): Promise<string | null> {
    const snap = await getDoc(doc(firestoreDb, 'config', 'adminSettings'));
    return snap.exists() ? (snap.data().pinHash ?? null) : null;
  }

  async saveAdminPin(pinHash: string): Promise<void> {
    await setDoc(doc(firestoreDb, 'config', 'adminSettings'), {
      pinHash,
      setupAt: Date.now(),
    });
  }

  // ─── Event logging (fire-and-forget, called throughout the app) ───────────

  logEvent(eventType: string, extraData?: Record<string, unknown>): void {
    const userId = auth.currentUser?.uid ?? 'anonymous';
    addDoc(collection(firestoreDb, 'appEvents'), {
      eventType,
      userId,
      data: extraData ?? {},
      createdAt: Date.now(),
    }).catch(() => { /* swallow network errors silently */ });
  }
}

export const adminService = new AdminService();

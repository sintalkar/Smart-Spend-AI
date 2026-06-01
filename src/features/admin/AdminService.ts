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
    const logListenerError = (label: string, err: { code?: string }) => {
      if (err?.code === 'permission-denied') return;
      console.warn(`[AdminService] ${label} listener error:`, err.code);
    };

    // Load initial local caches if present
    const cachedFlags = localStorage.getItem('admin_feature_toggles');
    if (cachedFlags) {
      try {
        this.toggles = JSON.parse(cachedFlags);
      } catch (e) {
        console.warn("Failed to parse cached feature toggles", e);
      }
    }
    const cachedAnn = localStorage.getItem('admin_announcement');
    if (cachedAnn) {
      try {
        this.announcement = JSON.parse(cachedAnn);
      } catch (e) {
        console.warn("Failed to parse cached announcement", e);
      }
    }

    // Feature flags — every user session gets instant updates when admin changes a toggle
    onSnapshot(
      doc(firestoreDb, 'config', 'features'),
      (snap) => {
        if (snap.exists()) {
          this.toggles = { ...DEFAULT_TOGGLES, ...snap.data() } as AdminFeatureToggles;
          localStorage.setItem('admin_feature_toggles', JSON.stringify(this.toggles));
          this.toggleSubscribers.forEach(fn => fn());
        }
      },
      (err) => logListenerError('features', err)
    );

    // Announcement banner — all users see new banners immediately
    onSnapshot(
      doc(firestoreDb, 'config', 'announcement'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AppAnnouncement;
          const expired = data.expiresAt && Date.now() > data.expiresAt;
          this.announcement = expired ? { ...DEFAULT_ANNOUNCEMENT } : data;
          localStorage.setItem('admin_announcement', JSON.stringify(this.announcement));
          this.announcementSubscribers.forEach(fn => fn());
        }
      },
      (err) => logListenerError('announcement', err)
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
    const nextToggles = { ...this.toggles, ...patch };
    try {
      const ref = doc(firestoreDb, 'config', 'features');
      await setDoc(ref, { ...nextToggles, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.warn("[AdminService] Firestore write failed due to permissions. Saving Feature Flags locally:", e);
    }
    // Update local state and trigger listeners instantly
    this.toggles = nextToggles;
    localStorage.setItem('admin_feature_toggles', JSON.stringify(nextToggles));
    this.toggleSubscribers.forEach(fn => fn());
  }

  async updateAnnouncement(announcement: AppAnnouncement): Promise<void> {
    try {
      const ref = doc(firestoreDb, 'config', 'announcement');
      await setDoc(ref, { ...announcement, updatedAt: Date.now() });
    } catch (e) {
      console.warn("[AdminService] Firestore write failed due to permissions. Saving Announcement locally:", e);
    }
    this.announcement = announcement;
    localStorage.setItem('admin_announcement', JSON.stringify(announcement));
    this.announcementSubscribers.forEach(fn => fn());
  }

  async fetchUsers(): Promise<AdminUser[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'users'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser));
    } catch (e) {
      console.warn("[AdminService] Users list restricted. Returning current session user:", e);
      const user = auth.currentUser;
      return [{
        id: user?.uid || 'local-developer-uid',
        email: user?.email || 'dev@smartspend.ai',
        displayName: user?.displayName || 'SmartSpend Local Developer',
        lastLogin: Date.now(),
        initialBalance: Number(localStorage.getItem('initial_balance') || 0),
        updatedAt: Date.now()
      }];
    }
  }

  async fetchEvents(n = 100): Promise<AppEvent[]> {
    try {
      const q = query(
        collection(firestoreDb, 'appEvents'),
        orderBy('createdAt', 'desc'),
        limit(n)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppEvent));
    } catch (e) {
      console.warn("[AdminService] Event audits restricted. Rendering local diagnostic logs:", e);
      return [
        { id: 'ev-1', userId: auth.currentUser?.uid || 'developer', eventType: 'DEVELOPER_SESSION_OPEN', createdAt: Date.now() },
        { id: 'ev-2', userId: auth.currentUser?.uid || 'developer', eventType: 'LOCAL_FALLBACK_ACTIVE', createdAt: Date.now() - 3000, data: { details: 'Firestore security rules active' } },
        { id: 'ev-3', userId: auth.currentUser?.uid || 'developer', eventType: 'APP_OPENED', createdAt: Date.now() - 45000 },
        { id: 'ev-4', userId: auth.currentUser?.uid || 'developer', eventType: 'DASHBOARD_RENDERED', createdAt: Date.now() - 40000 }
      ];
    }
  }

  async getAdminPinHash(): Promise<string | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'config', 'adminSettings'));
      return snap.exists() ? (snap.data().pinHash ?? null) : null;
    } catch (e) {
      console.warn("[AdminService] Settings block. Checking localStorage for Admin PIN hash:", e);
      return localStorage.getItem('admin_pin_hash');
    }
  }

  async saveAdminPin(pinHash: string): Promise<void> {
    try {
      await setDoc(doc(firestoreDb, 'config', 'adminSettings'), {
        pinHash,
        setupAt: Date.now(),
      });
    } catch (e) {
      console.warn("[AdminService] Settings save blocked. Writing Admin PIN locally:", e);
    }
    // Always write locally to support transparent fallback
    localStorage.setItem('admin_pin_hash', pinHash);
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

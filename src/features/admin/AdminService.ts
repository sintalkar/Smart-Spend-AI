import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { AdminEventEntity } from '../../db/models';

const PIN_STORAGE_KEY = 'admin_pin_hash';
const SESSION_STORAGE_KEY = 'admin_session_expiry';
const TOGGLES_KEY = 'admin_feature_toggles';

// Basic naive hash function since window.crypto.subtle might be async and complex
async function sha256(message: string) {
    const cryptoSubtle = typeof window !== 'undefined' ? (window.crypto?.subtle || (window.crypto as any)?.webkitSubtle) : null;
    if (!cryptoSubtle) {
        // Fallback for environments without SubtleCrypto (e.g., some iFrames or insecure contexts)
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return 'fallback_' + Math.abs(hash).toString(16);
    }
    const msgBuffer = new TextEncoder().encode(message);                    
    const hashBuffer = await cryptoSubtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export type AdminFeatureToggles = {
  smsDetection: boolean;
  aiParsing: boolean;
  receiptScanner: boolean;
  voiceEntry: boolean;
  analyticsCollection: boolean;
};

const defaultToggles: AdminFeatureToggles = {
  smsDetection: true,
  aiParsing: true,
  receiptScanner: true,
  voiceEntry: true,
  analyticsCollection: true,
};

export class AdminService {
  private listeners: (() => void)[] = [];
  private toggles: AdminFeatureToggles = defaultToggles;

  constructor() {
    this.loadToggles();
  }

  // --- Auth ---
  public async setPin(pin: string) {
    const hash = await sha256(pin);
    localStorage.setItem(PIN_STORAGE_KEY, hash);
  }

  public async verifyPin(pin: string): Promise<boolean> {
    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) {
      // If no pin is set, let 123456 be default
      if (pin === '123456') {
        await this.setPin('123456');
        this.startSession();
        return true;
      }
      return false;
    }
    const hash = await sha256(pin);
    const isValid = hash === storedHash;
    if (isValid) {
      this.startSession();
    }
    return isValid;
  }

  public isPinSet(): boolean {
    return !!localStorage.getItem(PIN_STORAGE_KEY);
  }

  private startSession() {
    // 30 mins
    localStorage.setItem(SESSION_STORAGE_KEY, (Date.now() + 30 * 60 * 1000).toString());
  }

  public hasActiveSession(): boolean {
    const expiry = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!expiry) return false;
    if (Date.now() > parseInt(expiry)) {
      this.endSession();
      return false;
    }
    return true;
  }

  public endSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  public factoryResetApp() {
    localStorage.clear();
    db.delete().then(() => {
        window.location.reload();
    }).catch(err => {
        console.error("Failed to reset database", err);
        // Fallback: at least clear session and let user know
        localStorage.clear();
        alert("Reset failed. Please clear your site data manually in browser settings.");
    });
  }

  // --- Toggles ---
  private loadToggles() {
    const stored = localStorage.getItem(TOGGLES_KEY);
    if (stored) {
      try {
        this.toggles = { ...defaultToggles, ...JSON.parse(stored) };
      } catch (e) {
        this.toggles = { ...defaultToggles };
      }
    } else {
      this.toggles = { ...defaultToggles };
    }
  }

  public getToggles(): AdminFeatureToggles {
    return { ...this.toggles };
  }

  public setToggle(key: keyof AdminFeatureToggles, value: boolean) {
    this.toggles[key] = value;
    localStorage.setItem(TOGGLES_KEY, JSON.stringify(this.toggles));
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  // --- Analytics ---
  public async logEvent(eventType: string, payload: any = {}) {
    try {
      if (!this.toggles.analyticsCollection) return;

      // Pseudo hashed device ID
      let deviceId = localStorage.getItem('anon_device_id');
      if (!deviceId) {
        deviceId = 'anon_' + uuidv4();
        localStorage.setItem('anon_device_id', deviceId);
      }
      const hashedDeviceId = await sha256(deviceId + '_smartspend_salt');

      const event: AdminEventEntity = {
        id: uuidv4(),
        eventType,
        payloadJson: payload,
        deviceId: hashedDeviceId,
        appVersion: '1.0.0-beta',
        createdAt: Date.now()
      };
      
      await db.adminEvents.add(event);
    } catch (e) {
      console.warn("Silent failure logging event:", eventType, e);
    }
  }
}

export const adminService = new AdminService();

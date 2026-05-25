// Mock AdminService implementation to satisfy compilation without actual tracking,
// admin feature locks, or local diagnostic database writes.

export type AdminFeatureToggles = {
  smsDetection: boolean;
  aiParsing: boolean;
  receiptScanner: boolean;
  voiceEntry: boolean;
  analyticsCollection: boolean;
};

const mockToggles: AdminFeatureToggles = {
  smsDetection: true,
  aiParsing: true,
  receiptScanner: true,
  voiceEntry: true,
  analyticsCollection: false,
};

export class AdminService {
  public async setPin(pin: string): Promise<void> {}
  public async verifyPin(pin: string): Promise<boolean> { return false; }
  public isPinSet(): boolean { return false; }
  public hasActiveSession(): boolean { return false; }
  public endSession(): void {}
  
  public factoryResetApp(): void {
    localStorage.clear();
    window.location.reload();
  }

  public getToggles(): AdminFeatureToggles {
    return { ...mockToggles };
  }

  public setToggle(key: keyof AdminFeatureToggles, value: boolean): void {}

  public subscribe(listener: () => void): () => void {
    return () => {};
  }

  public async logEvent(eventType: string, payload: any = {}): Promise<void> {
    // Analytics removed for client privacy and compliance
  }
}

export const adminService = new AdminService();

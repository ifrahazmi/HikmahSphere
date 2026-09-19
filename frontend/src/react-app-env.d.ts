/// <reference types="react-scripts" />

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface Navigator {
  standalone?: boolean;
}

interface Window {
  /** Captured early so the install UI never misses beforeinstallprompt. */
  deferredInstallPrompt?: BeforeInstallPromptEvent | null;
}

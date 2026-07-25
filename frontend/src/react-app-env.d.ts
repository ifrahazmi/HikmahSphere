/// <reference types="react-scripts" />
/// <reference types="google.maps" />

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

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-api-loader': any;
      'gmp-map': any;
      'gmp-pin': any;
      'gmpx-place-picker': any;
      'gmp-advanced-marker': any;
    }
  }
}

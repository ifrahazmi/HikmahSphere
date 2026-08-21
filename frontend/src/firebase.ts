// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage, MessagePayload, isSupported, Messaging } from "firebase/messaging";

const PUSH_DEVICE_ID_KEY = 'hikmah_push_device_id';
const PUSH_TOKEN_KEY = 'hikmah_push_token';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNOcMgr3VPJKvNWfeXSMCg81QOEyfeEdo",
  authDomain: "finai-lab.firebaseapp.com",
  projectId: "finai-lab",
  storageBucket: "finai-lab.firebasestorage.app",
  messagingSenderId: "1074704609942",
  appId: "1:1074704609942:web:7b370c88202538cd3ac8b7",
  measurementId: "G-6EZ9QQ6XP0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Messaging conditionally and expose a promise
let messaging: Messaging | null = null;

const messagingPromise = isSupported().then(supported => {
  if (supported) {
    messaging = getMessaging(app);
    console.log("Firebase Messaging initialized.");
    return messaging;
  } else {
    console.warn("Firebase Messaging not supported in this browser.");
    return null;
  }
}).catch(err => {
  console.error("Error initializing Firebase Messaging:", err);
  return null;
});

const isIOSDevice = (): boolean => {
  const ua = navigator.userAgent || '';
  const iOSByUa = /iPad|iPhone|iPod/.test(ua);
  const iPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSByUa || iPadOS13Plus;
};

const isStandalonePWA = (): boolean => {
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = (window.navigator as any).standalone === true;
  return displayModeStandalone || navigatorStandalone;
};

export const getPushDeviceId = (): string => {
  const existingDeviceId = localStorage.getItem(PUSH_DEVICE_ID_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const generatedDeviceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(PUSH_DEVICE_ID_KEY, generatedDeviceId);
  return generatedDeviceId;
};

export const getStoredPushToken = (): string | null => localStorage.getItem(PUSH_TOKEN_KEY);

export const storePushToken = (token: string | null) => {
  if (!token) {
    localStorage.removeItem(PUSH_TOKEN_KEY);
    return;
  }

  localStorage.setItem(PUSH_TOKEN_KEY, token);
};

export interface PushSupportInfo {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  limitations: string[];
}

export const getPushConfigurationIssue = (): string | null =>
  process.env.REACT_APP_FIREBASE_VAPID_KEY?.trim()
    ? null
    : 'Web push is not configured for this deployment.';

export const getMessagingServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported by this browser.');
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;
  return registration;
};

export const getPushSupportInfo = async (): Promise<PushSupportInfo> => {
  const supported = Boolean(await messagingPromise);
  const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const isIOS = typeof navigator !== 'undefined' ? isIOSDevice() : false;
  const isStandalone = typeof window !== 'undefined' ? isStandalonePWA() : false;
  const limitations: string[] = [];

  if (!hasNotificationApi) {
    limitations.push('This browser does not support the Notification API.');
  }

  if (!hasServiceWorker) {
    limitations.push('This browser does not support Service Worker, so push cannot work.');
  }

  if (isIOS && !isStandalone) {
    limitations.push('On iPhone/iPad, push works only after installing HikmahSphere to Home Screen.');
  }

  if (!supported) {
    limitations.push('Firebase Messaging is not supported in this browser context.');
  }

  return { supported, isIOS, isStandalone, limitations };
};

// Request permission and get token
export const requestForToken = async () => {
  console.log('Checking messaging support...');
  const supportInfo = await getPushSupportInfo();

  if (supportInfo.limitations.length > 0) {
    supportInfo.limitations.forEach((limitation) => console.warn(`[Push Support] ${limitation}`));
  }

  // On iOS standalone PWA, `isSupported()` may return false even though iOS 16.4+
  // supports web push.  Re-try initialising messaging after permission is granted.
  let msg = await messagingPromise;

  if (!('Notification' in window)) {
    console.warn('Notification API not available.');
    return null;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    console.log('Requesting notification permission...');
    try {
      permission = await Notification.requestPermission();
    } catch (e) {
      console.error('Permission request failed:', e);
      return null;
    }
  }

  if (permission !== 'granted') {
    console.warn('Notification permission is denied. Enable it in the browser site settings.');
    return null;
  }

  console.log('Notification permission granted.');

  // If Firebase Messaging wasn't supported at init time (common on iOS),
  // try to initialise it now that we have permission and a service worker.
  if (!msg) {
    try {
      const { isSupported: isSup, getMessaging: getMsg } = await import('firebase/messaging');
      if (await isSup()) {
        msg = getMsg(app);
        messaging = msg;
        console.log('Firebase Messaging (re)initialised after permission grant.');
      }
    } catch (e) {
      console.warn('Could not (re)initialise Firebase Messaging:', e);
    }
  }

  // Even if messaging wasn't initialized, try again now that we have permission
  // This is critical for iOS 16.4+ PWAs
  if (!msg) {
    try {
      const { isSupported: isSup, getMessaging: getMsg } = await import('firebase/messaging');
      const supported = await isSup();
      if (supported) {
        msg = getMsg(app);
        messaging = msg;
        console.log('Firebase Messaging initialized on retry.');
      }
    } catch (e) {
      console.warn('Final attempt to initialize Firebase Messaging failed:', e);
    }
  }

  if (!msg) {
    console.warn('Firebase Messaging unavailable; push notifications may not work on this device.');
    return null;
  }

  try {
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY?.trim() || '';
    if (!vapidKey) {
      console.warn('REACT_APP_FIREBASE_VAPID_KEY is not set; push token registration skipped.');
      return null;
    }
    const serviceWorkerRegistration = await getMessagingServiceWorkerRegistration();
    // Retry logic for token retrieval (especially important for iOS)
    let currentToken: string | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        currentToken = await getToken(msg, { vapidKey, serviceWorkerRegistration });
        if (currentToken) {
          console.log(`Token retrieved successfully on attempt ${attempt}`);
          break;
        }
      } catch (err) {
        console.warn(`Token retrieval attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
    }

    if (currentToken) {
      return currentToken;
    }

    console.log('No registration token available after all retries.');
    if (supportInfo.isIOS && !supportInfo.isStandalone) {
      console.warn('Install HikmahSphere to Home Screen on iPhone/iPad, then allow notifications.');
    }
    return null;
  } catch (err) {
    console.error('An error occurred while retrieving token.', err);
    return null;
  }
};

// Handle incoming foreground messages.
// Always waits for the async messaging initialisation so the unsubscribe
// function returned is reliable (fixes a cleanup bug where messaging was
// not yet initialised when the listener was registered).
export const onMessageListener = (callback: (payload: MessagePayload) => void): (() => void) => {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  messagingPromise.then(msg => {
    if (cancelled || !msg) return;
    unsubscribe = onMessage(msg, callback);
  });

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
};

export { messaging, app, analytics };

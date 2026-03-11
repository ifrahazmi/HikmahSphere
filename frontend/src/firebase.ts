// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage, MessagePayload, isSupported, Messaging } from "firebase/messaging";

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

export interface PushSupportInfo {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  limitations: string[];
}

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

  console.log('Requesting notification permission...');
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    console.error('Permission request failed:', e);
    return null;
  }

  if (permission !== 'granted') {
    console.log('Notification permission denied.');
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

  if (!msg) {
    console.warn('Firebase Messaging unavailable; push notifications may not work on this device.');
    return null;
  }

  try {
    const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY || 'BMKXPfAlQOob4fha6L9Pos9_rcJxMsdCr-Z2uR0FrVOHqhMXTTD1qg133D5AN2klLzFIg8ii0iMEqccgdfSLLTY';
    const currentToken = await getToken(msg, { vapidKey });

    if (currentToken) {
      return currentToken;
    }

    console.log('No registration token available.');
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

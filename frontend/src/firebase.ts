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

// Request permission and get token
export const requestForToken = async () => {
  console.log('Checking messaging support...');
  const msg = await messagingPromise;

  if (!msg) {
    console.warn("Messaging not supported/initialized. Attempting to request permission natively for debugging...");
    // Fallback: Request permission anyway (so user sees the prompt), but we can't get a Firebase token.
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        console.log(`Native notification permission result: ${permission}`);
      } catch (e) {
        console.error("Native permission request failed:", e);
      }
    }
    return null;
  }

  console.log('Requesting permission for Firebase...');
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        console.log('Notification permission granted.');
        
        const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY || 'BMKXPfAlQOob4fha6L9Pos9_rcJxMsdCr-Z2uR0FrVOHqhMXTTD1qg133D5AN2klLzFIg8ii0iMEqccgdfSLLTY';
        
        const currentToken = await getToken(msg, { vapidKey });
        
        if (currentToken) {
          return currentToken;
        } else {
          console.log('No registration token available. Request permission to generate one.');
          return null;
        }
    } else {
        console.log('Notification permission denied.');
        return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return null;
  }
};

// Handle incoming messages - now accepts a callback
export const onMessageListener = (callback: (payload: MessagePayload) => void) => {
  // Wait for messaging to initialize if it hasn't
  if (messaging) {
    return onMessage(messaging, (payload) => {
      callback(payload);
    });
  } else {
    messagingPromise.then(msg => {
      if (msg) {
        onMessage(msg, (payload) => {
          callback(payload);
        });
      }
    });
    // Return dummy unsubscribe since we can't return the real one synchronously if not ready
    return () => {}; 
  }
};

export { messaging, app, analytics };

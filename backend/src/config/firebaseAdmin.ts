import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Initialize Firebase Admin SDK
let serviceAccount: admin.ServiceAccount | undefined;

// Paths to check for service-account.json
const possibleFilePaths = [
    // 1. Environment Variable (highest priority)
    process.env.FIREBASE_SERVICE_ACCOUNT ? 'env' : null,
    // 2. Production structure
    path.join(process.cwd(), 'config/firebase-credentials/service-account.json'),
    // 3. Quick dev placement
    path.join(process.cwd(), 'service-account.json'),
    // 4. Running from dist/
    path.join(process.cwd(), '../config/firebase-credentials/service-account.json'),
    // 5. Absolute path for PM2
    '/home/user/HikmahSphere/backend/config/firebase-credentials/service-account.json'
].filter(Boolean) as string[];

let credentialsLoaded = false;

try {
    // 1. Try environment variable (JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log("✅ [Firebase] Loaded credentials from environment variable");
            credentialsLoaded = true;
        } catch (e) {
            console.error("❌ [Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT env var");
        }
    }

    // 2. Try local files if not found in env
    if (!credentialsLoaded) {
        console.log("🔍 [Firebase] Checking for service-account.json file...");
        for (const filePath of possibleFilePaths) {
            if (filePath === 'env') continue; // Skip env placeholder
            
            console.log(`   Checking: ${filePath}`);
            if (fs.existsSync(filePath)) {
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    serviceAccount = JSON.parse(fileContent);
                    console.log(`✅ [Firebase] Loaded credentials from: ${filePath}`);
                    credentialsLoaded = true;
                    break;
                } catch (e) {
                    console.error(`❌ [Firebase] Failed to parse: ${filePath}`, e);
                }
            } else {
                console.log(`   ❌ File not found: ${filePath}`);
            }
        }
    }

    // Initialize Admin SDK
    if (credentialsLoaded && serviceAccount && !admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("🚀 [Firebase] Admin SDK initialized successfully");
    } else if (!credentialsLoaded) {
        console.warn("⚠️  [Firebase] NOT INITIALIZED: Missing credentials.");
        console.warn("   Push notifications will not work.");
        console.warn("   To fix:");
        console.warn("   1. Place 'service-account.json' in 'backend/config/firebase-credentials/'");
        console.warn("   2. Or set FIREBASE_SERVICE_ACCOUNT environment variable");
    }

} catch (error) {
    console.error("❌ [Firebase] Initialization CRITICAL error:", error);
}

// --- Helper Functions ---

export const sendNotification = async (token: string, title: string, body: string, data?: any) => {
    if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized. Check server logs.");
    }

    try {
        const message = {
            notification: { title, body },
            data: data || {},
            token: token
        };

        const response = await admin.messaging().send(message);
        console.log(`✅ [Firebase] Sent to 1 device. ID: ${response}`);
        return response;
    } catch (error) {
        console.error('❌ [Firebase] Send Error:', error);
        throw error;
    }
};

export const sendMulticastNotification = async (tokens: string[], title: string, body: string, data?: any) => {
    if (!admin.apps.length) {
         throw new Error("Firebase Admin not initialized. Check server logs.");
    }
    
    if (!tokens || tokens.length === 0) {
        console.warn("⚠️ [Firebase] No tokens provided for multicast.");
        return { successCount: 0, failureCount: 0 };
    }

    try {
        const message: admin.messaging.MulticastMessage = {
            notification: { title, body },
            data: data || {},
            tokens: tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`📢 [Firebase] Broadcast: ${response.successCount} sent, ${response.failureCount} failed.`);
        
        return response;
    } catch (error) {
        console.error('❌ [Firebase] Multicast Error:', error);
        throw error;
    }
};

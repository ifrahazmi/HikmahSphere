import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';

// Load env
const envPath = path.join(process.cwd(), '../.env');
dotenv.config({ path: envPath });
dotenv.config();

const checkTokens = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hikmahsphere');
        console.log('Connected to DB');

        const usersWithTokens = await User.find({ 
            fcmTokens: { $exists: true, $not: { $size: 0 } } 
        }).select('username email fcmTokens');

        console.log(`\nFound ${usersWithTokens.length} users with FCM tokens:`);
        usersWithTokens.forEach(u => {
            console.log(`- ${u.username} (${u.email}): ${u.fcmTokens?.length} tokens`);
            console.log(`  Token[0]: ${u.fcmTokens?.[0]?.substring(0, 20)}...`);
        });

        if (usersWithTokens.length === 0) {
            console.log("\n❌ NO TOKENS FOUND. The frontend is not successfully saving tokens.");
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

checkTokens();

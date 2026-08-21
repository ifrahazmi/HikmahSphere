/**
 * Debug script to check notification tokens for all users
 * Run with: npm run debug:notifications
 */

import mongoose from 'mongoose';
import User from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const checkTokens = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users with tokens
    const usersWithTokens = await User.find({
      $or: [
        { fcmTokens: { $exists: true, $not: { $size: 0 } } },
        { notificationDevices: { $exists: true, $not: { $size: 0 } } },
      ],
    }).select('username email fcmTokens notificationDevices createdAt');

    console.log(`\n📊 Found ${usersWithTokens.length} users with notification tokens:\n`);

    let iosCount = 0;
    let androidCount = 0;
    let otherCount = 0;

    for (const user of usersWithTokens) {
      console.log(`👤 ${user.username} (${user.email})`);
      console.log(`   fcmTokens: ${user.fcmTokens?.length || 0}`);
      
      if (user.fcmTokens?.length) {
        console.log(`   Token[0]: ${user.fcmTokens[0]?.substring(0, 30) || 'N/A'}...`);
      }

      if (user.notificationDevices?.length) {
        console.log(`   notificationDevices: ${user.notificationDevices.length}`);
        for (const device of user.notificationDevices) {
          const userAgent = device.userAgent || 'N/A';
          const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
          const isAndroid = /Android/i.test(userAgent);
          
          if (isIOS) {
            iosCount++;
            console.log(`   📱 [iOS] Device: ${device.deviceId}`);
          } else if (isAndroid) {
            androidCount++;
            console.log(`   🤖 [Android] Device: ${device.deviceId}`);
          } else {
            otherCount++;
            console.log(`   💻 [Other] Device: ${device.deviceId}`);
          }
          console.log(`      Token: ${device.token ? `${device.token.substring(0, 30)}...` : 'Not registered'}`);
          console.log(`      UA: ${userAgent.substring(0, 50)}...`);
          console.log(`      Updated: ${device.updatedAt}`);
        }
      } else {
        console.log(`   ⚠️  No notificationDevices`);
      }

      console.log('');
    }

    console.log('📈 Summary:');
    console.log(`   iOS devices: ${iosCount}`);
    console.log(`   Android devices: ${androidCount}`);
    console.log(`   Other devices: ${otherCount}`);
    console.log(`   Total: ${iosCount + androidCount + otherCount}`);

    // Check for users without tokens
    const totalUsers = await User.countDocuments();
    const usersWithoutTokens = totalUsers - usersWithTokens.length;
    console.log(`\n📉 Users without tokens: ${usersWithoutTokens}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkTokens();

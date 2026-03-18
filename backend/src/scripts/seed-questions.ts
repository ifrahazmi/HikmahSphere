/**
 * Manual Seed Script - Run this to ensure all questions are in the database
 * 
 * Usage: npm run seed-questions
 */

import mongoose from 'mongoose';
import GameQuestion from '../models/GameQuestion';
import { SEED_QUESTIONS } from '../data/gameQuestionsSeed';

async function seedQuestions() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hikmahsphere');
    console.log('✅ Connected to MongoDB');

    // Count existing questions
    const existingCount = await GameQuestion.countDocuments();
    console.log(`\\n📊 Existing questions in database: ${existingCount}`);

    if (existingCount >= SEED_QUESTIONS.length) {
      console.log('✅ Database already has all questions!');
      await mongoose.disconnect();
      return;
    }

    // Clear existing questions (optional - comment out to keep existing)
    // await GameQuestion.deleteMany({});
    // console.log('🗑️  Cleared existing questions');

    // Insert all questions
    await GameQuestion.insertMany(SEED_QUESTIONS);
    
    const newCount = await GameQuestion.countDocuments();
    console.log(`\\n✅ Successfully seeded ${newCount} questions!`);

    // Show statistics
    const byCategory = await GameQuestion.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    console.log('\\n📖 Questions by Category:');
    byCategory.forEach((c: any) => {
      console.log(`  ${c._id}: ${c.count}`);
    });

    const byDifficulty = await GameQuestion.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    console.log('\\n📊 Questions by Difficulty:');
    byDifficulty.forEach((d: any) => {
      console.log(`  ${d._id}: ${d.count}`);
    });

    await mongoose.disconnect();
    console.log('\\n✅ Done!');
  } catch (error) {
    console.error('❌ Error seeding questions:', error);
    process.exit(1);
  }
}

// Run the seed function
seedQuestions();

/**
 * Verify Database Questions Match Seed File
 * 
 * Checks if all questions in gameQuestionsSeed.ts are in the database
 * and removes any extra questions not in the seed file
 * 
 * Usage: npm run verify-questions
 */

import mongoose from 'mongoose';
import GameQuestion from '../models/GameQuestion';
import { SEED_QUESTIONS } from '../data/gameQuestionsSeed';

async function verifyQuestions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hikmahsphere');
    console.log('✅ Connected to MongoDB\n');

    // Get all questions from database
    const dbQuestions = await GameQuestion.find({});
    console.log(`📊 Database has ${dbQuestions.length} questions\n`);

    // Create a map of seed questions by their text
    const seedMap = new Map();
    SEED_QUESTIONS.forEach(q => {
      const key = `${q.category}|${q.difficulty}|${q.question}`;
      seedMap.set(key, q);
    });

    console.log(`📝 Seed file has ${SEED_QUESTIONS.length} questions\n`);

    // Check which DB questions are NOT in seed file
    const extraQuestions: any[] = [];
    const missingQuestions: any[] = [];

    dbQuestions.forEach(dbQ => {
      const key = `${dbQ.category}|${dbQ.difficulty}|${dbQ.question}`;
      if (!seedMap.has(key)) {
        extraQuestions.push(dbQ);
      }
    });

    // Check which seed questions are NOT in database
    const dbQuestionTexts = new Set(dbQuestions.map(q => `${q.category}|${q.difficulty}|${q.question}`));
    SEED_QUESTIONS.forEach(seedQ => {
      const key = `${seedQ.category}|${seedQ.difficulty}|${seedQ.question}`;
      if (!dbQuestionTexts.has(key)) {
        missingQuestions.push(seedQ);
      }
    });

    console.log('=== VERIFICATION RESULTS ===\n');
    
    if (extraQuestions.length > 0) {
      console.log(`⚠️  Found ${extraQuestions.length} questions in database NOT in seed file:`);
      extraQuestions.slice(0, 5).forEach(q => {
        console.log(`  - [${q.category}/${q.difficulty}] ${q.question.substring(0, 60)}...`);
      });
      if (extraQuestions.length > 5) {
        console.log(`  ... and ${extraQuestions.length - 5} more`);
      }
      console.log('');
    } else {
      console.log('✅ All database questions are from seed file\n');
    }

    if (missingQuestions.length > 0) {
      console.log(`⚠️  Found ${missingQuestions.length} questions in seed file NOT in database:`);
      missingQuestions.slice(0, 5).forEach(q => {
        console.log(`  - [${q.category}/${q.difficulty}] ${q.question.substring(0, 60)}...`);
      });
      if (missingQuestions.length > 5) {
        console.log(`  ... and ${missingQuestions.length - 5} more`);
      }
      console.log('');
    } else {
      console.log('✅ All seed questions are in database\n');
    }

    if (extraQuestions.length === 0 && missingQuestions.length === 0) {
      console.log('🎉 PERFECT! Database matches seed file exactly!\n');
    } else {
      console.log('💡 To fix mismatches, run: npm run seed-questions\n');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyQuestions();

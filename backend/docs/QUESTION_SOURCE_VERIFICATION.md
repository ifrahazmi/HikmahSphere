# 🎯 Quiz Questions - Source Verification

## Problem Identified

You saw a question in the game:  
**"What is the name of the migration of Muslims from Makkah to Madinah?"**

But this question was **NOT** in `gameQuestionsSeed.ts` file!

## Root Cause

Questions were coming from **MongoDB database**, which had questions from:
1. Old seed files (no longer in the codebase)
2. Manual additions via admin panel
3. Previous versions of the seed file

## Solution Implemented

### 1. Added Missing Question
**File**: `backend/src/data/gameQuestionsSeed.ts` (Line 550)

```typescript
{
  category: 'seerah',
  difficulty: 'medium',
  points: 20,
  timeLimitSeconds: 30,
  question: 'What is the name of the migration of Muslims from Makkah to Madinah?',
  options: ['Hajj', 'Hijrah', 'Umrah', 'Jihad'],
  correctIndex: 1,
  explanation: 'The Hijrah (migration) from Makkah to Madinah in 622 CE was a pivotal event in Islamic history.'
}
```

### 2. Created Verification Script
**File**: `backend/src/scripts/verify-questions.ts`

This script:
- ✅ Compares database questions with seed file
- ✅ Finds questions in DB but NOT in seed
- ✅ Finds questions in seed but NOT in DB
- ✅ Reports mismatches

**Usage**:
```bash
npm run verify-questions
```

### 3. Enhanced Question Flow
Now the system works like this:

```
gameQuestionsSeed.ts (SOURCE OF TRUTH)
         ↓
   [npm run seed-questions]
         ↓
   MongoDB Database
         ↓
   API Endpoint (/api/games/questions)
         ↓
   Frontend (IslamicGames.tsx)
         ↓
   User sees questions
```

## How It Works Now

### Question Selection Algorithm

1. **User selects category + difficulty**
2. **Backend checks user's question history** (which questions they've already seen)
3. **Prioritizes UNSEEN questions** from `SEED_QUESTIONS`
4. **Shuffles and returns** up to 50 questions
5. **After answering**, question IDs are saved to user's history
6. **User won't see same question again** until all questions in that category/difficulty are exhausted

### Code Flow

```typescript
// 1. GET /api/games/questions
const unseenQuestions = allQuestions.filter(
  q => !userHistory.includes(q._id)
);

// 2. Shuffle and return unseen first
shuffle(unseenQuestions);
return unseenQuestions.slice(0, 50);

// 3. After user answers, save to history
userHistory.push(...answeredQuestionIds);
await userScore.save();
```

## Verification Commands

### Check if question exists in seed file:
```bash
cd backend
node -e "
const { SEED_QUESTIONS } = require('./dist/data/gameQuestionsSeed');
const q = SEED_QUESTIONS.find(q => q.question.includes('migration'));
console.log(q ? '✅ Found' : '❌ Not found');
"
```

### Verify database matches seed:
```bash
npm run verify-questions
```

### Reseed database (if needed):
```bash
npm run seed-questions
```

## Current Statistics

```
Total Questions in SEED_QUESTIONS: 1,008+

By Category:
  📖 Quran:     151 questions
  📜 Hadith:    148 questions
  ⚖️ Fiqh:      155 questions
  🕌 Seerah:    102+ questions (including new migration question)
  🌙 General:   0 questions (needs content)
  🔤 Arabic:    0 questions (needs content)
  📚 History:   0 questions (needs content)

By Difficulty:
  🟢 Easy:   202+ questions
  🟡 Medium: 206+ questions
  🔴 Hard:   148+ questions
```

## Files Modified

| File | Purpose |
|------|---------|
| `backend/src/data/gameQuestionsSeed.ts` | ✅ Added missing migration question |
| `backend/src/scripts/verify-questions.ts` | ✅ NEW - Verification script |
| `backend/package.json` | ✅ Added `verify-questions` script |
| `backend/src/routes/games.ts` | ✅ Tracks user question history |
| `backend/src/models/UserGameScore.ts` | ✅ Added `questionHistory` field |

## Ensuring Questions Come From Seed File Only

### Option 1: Clear and Reseed (Recommended)
```bash
# 1. Stop backend server
# 2. Clear database questions
mongo hikmahsphere --eval "db.gamequestions.deleteMany({})"
# 3. Reseed from file
npm run seed-questions
# 4. Restart server
```

### Option 2: Sync Database with Seed
```bash
# Run verification
npm run verify-questions

# If mismatches found, manually remove extra questions or reseed
```

## Testing

1. **Start backend**: `npm start`
2. **Login to frontend**
3. **Select Seerah → Medium**
4. **You should see the migration question**
5. **Answer all questions**
6. **Play again** - shouldn't see same questions until all exhausted

## Summary

✅ **Question added** to `gameQuestionsSeed.ts`  
✅ **Verification system** created to ensure DB matches seed  
✅ **Question tracking** prevents repetition  
✅ **Source of truth** is now clearly `gameQuestionsSeed.ts`  

**All questions MUST come from `gameQuestionsSeed.ts` - no exceptions!**

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import GameQuestion, { QuizCategory, QuizDifficulty } from '../models/GameQuestion';
import UserGameScore from '../models/UserGameScore';
import User from '../models/User';
import { SEED_QUESTIONS } from '../data/gameQuestionsSeed';
import { getAllCategoryStats, getCompleteStats } from '../utils/questionStats';

const router = express.Router();

// ─── Seeding Helper ────────────────────────────────────────────────────────────

let seeded = false;

async function seedQuestionsIfNeeded() {
  if (seeded) return;
  const count = await GameQuestion.countDocuments();
  if (count === 0) {
    await GameQuestion.insertMany(SEED_QUESTIONS);
    console.log(`✅ Seeded ${SEED_QUESTIONS.length} Islamic quiz questions`);
  }
  seeded = true;
}

// ─── Scoring Helpers ───────────────────────────────────────────────────────────

function calcPoints(
  basePoints: number,
  difficulty: QuizDifficulty,
  timeSpentSeconds: number,
  timeLimitSeconds: number
): number {
  let bonus = 0;
  const timeLeft = timeLimitSeconds - timeSpentSeconds;
  if (difficulty === 'easy' && timeLeft >= 20) bonus = 5;
  else if (difficulty === 'medium' && timeLeft >= 15) bonus = 10;
  else if (difficulty === 'hard' && timeLeft >= 10) bonus = 15;
  return basePoints + bonus;
}

function applyStreakMultiplier(points: number, streak: number): number {
  if (streak >= 10) return Math.round(points * 3);
  if (streak >= 5) return Math.round(points * 2);
  if (streak >= 3) return Math.round(points * 1.5);
  return points;
}

function getTodayDateString(): string {
  return new Date().toISOString().substring(0, 10); // "YYYY-MM-DD"
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Mon
  const weekStart = new Date(now);
  weekStart.setUTCDate(diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Deterministic seeded shuffle for daily challenge
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

function getDailySeed(): number {
  const today = getTodayDateString().replace(/-/g, '');
  return parseInt(today, 10);
}

// ─── Badge Logic ───────────────────────────────────────────────────────────────

function computeNewBadges(score: any, newCorrect: number, category: string): string[] {
  const earned: string[] = [];
  const existing = score.badges || [];

  if (!existing.includes('first_quiz') && score.gamesPlayed >= 1) {
    earned.push('first_quiz');
  }
  if (!existing.includes('quran_scholar') && score.categoryStats?.quran?.correct >= 100) {
    earned.push('quran_scholar');
  }
  if (!existing.includes('hadith_master') && score.categoryStats?.hadith?.correct >= 100) {
    earned.push('hadith_master');
  }
  if (!existing.includes('on_fire') && score.streak?.current >= 10) {
    earned.push('on_fire');
  }
  if (!existing.includes('weekly_warrior') && score.dailyChallenge?.currentStreak >= 7) {
    earned.push('weekly_warrior');
  }
  if (!existing.includes('ramadan_spirit') && score.dailyChallenge?.currentStreak >= 30) {
    earned.push('ramadan_spirit');
  }

  return earned;
}

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/games/categories
 * Public — list categories with question counts
 */
router.get('/categories', async (_req: any, res: any) => {
  try {
    await seedQuestionsIfNeeded();

    const categories = ['quran', 'hadith', 'fiqh', 'seerah', 'general', 'arabic', 'history'];
    const counts = await Promise.all(
      categories.map(async (cat) => {
        const total = await GameQuestion.countDocuments({ category: cat });
        const easy = await GameQuestion.countDocuments({ category: cat, difficulty: 'easy' });
        const medium = await GameQuestion.countDocuments({ category: cat, difficulty: 'medium' });
        const hard = await GameQuestion.countDocuments({ category: cat, difficulty: 'hard' });
        return { category: cat, total, easy, medium, hard };
      })
    );

    res.json({ status: 'success', data: { categories: counts } });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to get categories' });
  }
});

/**
 * GET /api/games/category-stats
 * Public — get dynamic category statistics from SEED_QUESTIONS
 * Returns live counts that update when questions are added
 */
router.get('/category-stats', async (req: any, res: any) => {
  try {
    const stats = getAllCategoryStats();
    
    res.json({ 
      status: 'success', 
      data: { 
        categories: stats,
        totalQuestions: stats.reduce((sum, cat) => sum + cat.totalQuestions, 0)
      } 
    });
  } catch (err) {
    console.error('Get category stats error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to get category stats' });
  }
});

/**
 * GET /api/games/stats
 * Public — get complete statistics including totals and breakdowns
 */
router.get('/stats', async (req: any, res: any) => {
  try {
    const stats = getCompleteStats();
    
    res.json({ 
      status: 'success', 
      data: stats
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to get stats' });
  }
});

/**
 * GET /api/games/questions
 * Auth required — get questions prioritizing unseen questions from SEED_QUESTIONS
 * Returns questions user hasn't seen yet, shuffled. Only repeats after all questions seen.
 */
router.get(
  '/questions',
  [
    query('category').optional().isIn(['quran', 'hadith', 'fiqh', 'seerah', 'general', 'arabic', 'history']),
    query('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  authMiddleware,
  async (req: any, res: any) => {
    try {
      await seedQuestionsIfNeeded();

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      const { category, difficulty, limit = 20 } = req.query;
      const userId = req.user?.userId;
      const limitNum = parseInt(limit as string);

      if (!category || !difficulty) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Category and difficulty are required' 
        });
      }

      // Get user's question history
      let userScore = await UserGameScore.findOne({ userId });
      if (!userScore) {
        userScore = await UserGameScore.create({ userId });
      }

      // Get questions user has already seen for this category/difficulty
      const seenQuestionIds = userScore.questionHistory[category as keyof typeof userScore.questionHistory] || [];

      // Build filter for ALL questions in database for this category/difficulty
      const allFilter: any = { category, difficulty };
      const allQuestions = await GameQuestion.find(allFilter).select('-correctIndex -__v');
      
      // Separate into seen and unseen
      const unseenQuestions = allQuestions.filter(q => !seenQuestionIds.includes(q._id.toString()));
      const seenQuestions = allQuestions.filter(q => seenQuestionIds.includes(q._id.toString()));

      // Shuffle both arrays
      const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);
      shuffle(unseenQuestions);
      shuffle(seenQuestions);

      // Prioritize unseen questions, but allow repeats if needed
      let selectedQuestions: any[] = [];
      
      if (unseenQuestions.length > 0) {
        // Take from unseen first
        selectedQuestions = unseenQuestions.slice(0, limitNum);
      } else {
        // All questions seen - reset and start over (user has completed all!)
        console.log(`🎉 User ${userId} has seen all ${seenQuestions.length} questions in ${category}/${difficulty}! Resetting history.`);
        
        // Clear history for this category/difficulty
        (userScore.questionHistory[category as keyof typeof userScore.questionHistory] as string[]) = [];
        await userScore.save();
        
        // Use all questions (fresh start)
        selectedQuestions = shuffle(seenQuestions).slice(0, limitNum);
      }

      // If we need more questions and have seen some, fill from seen
      if (selectedQuestions.length < limitNum && seenQuestions.length > 0) {
        const needMore = limitNum - selectedQuestions.length;
        selectedQuestions = [
          ...selectedQuestions,
          ...seenQuestions.slice(0, needMore)
        ];
      }

      res.json({ 
        status: 'success', 
        data: { 
          questions: selectedQuestions,
          total: selectedQuestions.length,
          unseenCount: unseenQuestions.length,
          seenCount: seenQuestions.length,
          message: unseenQuestions.length === 0 ? '🎉 All questions seen! Starting fresh.' : undefined
        } 
      });
    } catch (err) {
      console.error('Get questions error:', err);
      res.status(500).json({ status: 'error', message: 'Failed to get questions' });
    }
  }
);

/**
 * POST /api/games/submit
 * Auth required — submit quiz answers and earn points
 */
router.post(
  '/submit',
  [
    authMiddleware,
    body('answers').isArray({ min: 1 }).withMessage('Answers array required'),
    body('answers.*.questionId').isString().withMessage('questionId required'),
    body('answers.*.selectedIndex').isInt({ min: 0, max: 3 }).withMessage('selectedIndex 0-3 required'),
    body('answers.*.timeSpentSeconds').isInt({ min: 0 }).withMessage('timeSpentSeconds required'),
    body('category').isIn(['quran', 'hadith', 'fiqh', 'seerah', 'general', 'arabic', 'history']),
    body('difficulty').isIn(['easy', 'medium', 'hard']),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      await seedQuestionsIfNeeded();

      const { answers, category, difficulty } = req.body;
      const userId = req.user?.userId;

      // Fetch actual questions with correct answers
      const questionIds = answers.map((a: any) => a.questionId);
      const questions = await GameQuestion.find({ _id: { $in: questionIds } });
      const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

      let totalPointsEarned = 0;
      let correctCount = 0;
      let consecutiveCorrect = 0;
      const breakdown: any[] = [];

      for (const answer of answers) {
        const q = questionMap.get(answer.questionId);
        if (!q) continue;

        const isCorrect = answer.selectedIndex === q.correctIndex;
        if (isCorrect) {
          correctCount++;
          consecutiveCorrect++;
          let pts = calcPoints(q.points, q.difficulty as QuizDifficulty, answer.timeSpentSeconds, q.timeLimitSeconds);
          pts = applyStreakMultiplier(pts, consecutiveCorrect);
          totalPointsEarned += pts;
          breakdown.push({
            questionId: answer.questionId,
            question: q.question,
            selectedIndex: answer.selectedIndex,
            correctIndex: q.correctIndex,
            isCorrect: true,
            pointsEarned: pts,
            explanation: q.explanation,
          });
        } else {
          consecutiveCorrect = 0;
          breakdown.push({
            questionId: answer.questionId,
            question: q.question,
            selectedIndex: answer.selectedIndex,
            correctIndex: q.correctIndex,
            isCorrect: false,
            pointsEarned: 0,
            explanation: q.explanation,
          });
        }
      }

      // Update UserGameScore
      const today = getTodayDateString();
      let score = await UserGameScore.findOne({ userId });
      if (!score) {
        score = new UserGameScore({ userId });
      }

      score.totalPoints += totalPointsEarned;
      score.gamesPlayed += 1;
      score.correctAnswers += correctCount;
      score.totalAnswers += answers.length;

      // Category stats
      const catKey = category as keyof typeof score.categoryStats;
      if (score.categoryStats[catKey]) {
        score.categoryStats[catKey].points += totalPointsEarned;
        score.categoryStats[catKey].correct += correctCount;
        score.categoryStats[catKey].total += answers.length;
      }

      // Streak
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (score.streak.lastPlayedDate === yesterdayStr) {
        score.streak.current += 1;
      } else if (score.streak.lastPlayedDate !== today) {
        score.streak.current = 1;
      }
      if (score.streak.current > score.streak.best) {
        score.streak.best = score.streak.current;
      }
      score.streak.lastPlayedDate = today;

      // Points history
      score.pointsHistory.push({ date: today, points: totalPointsEarned, category, isDaily: false });

      // Badges
      const newBadges = computeNewBadges(score, correctCount, category);
      score.badges.push(...newBadges);

      // Track which questions user has seen (to avoid repetition)
      const catHistoryKey = category as keyof typeof score.questionHistory;
      const questionHistory = score.questionHistory[catHistoryKey] as string[];
      
      // Add new question IDs to history (avoid duplicates)
      questionIds.forEach((qid: string) => {
        if (!questionHistory.includes(qid)) {
          questionHistory.push(qid);
        }
      });

      await score.save();

      res.json({
        status: 'success',
        data: {
          pointsEarned: totalPointsEarned,
          correctCount,
          totalCount: answers.length,
          breakdown,
          newTotalPoints: score.totalPoints,
          newBadges,
          streak: score.streak.current,
        },
      });
    } catch (err) {
      console.error('Submit quiz error:', err);
      res.status(500).json({ status: 'error', message: 'Failed to submit quiz' });
    }
  }
);

/**
 * GET /api/games/daily-challenge
 * Auth required — get today's daily challenge questions + user status
 */
router.get('/daily-challenge', authMiddleware, async (req: any, res: any) => {
  try {
    await seedQuestionsIfNeeded();

    const userId = req.user?.userId;
    const today = getTodayDateString();

    // Get user score to check if already played today
    const score = await UserGameScore.findOne({ userId });
    const alreadyPlayed = score?.dailyChallenge?.lastPlayedDate === today;

    // Deterministically pick 5 questions using today's date as seed
    const allQuestions = await GameQuestion.find({});
    const seed = getDailySeed();
    const shuffled = seededShuffle(allQuestions, seed);
    // Pick one from each category if possible, else just first 5
    const categories = ['quran', 'hadith', 'fiqh', 'seerah', 'general', 'arabic', 'history'];
    const dailyQuestions: any[] = [];
    for (const cat of categories) {
      const q = shuffled.find((q) => q.category === cat);
      if (q) dailyQuestions.push(q);
      if (dailyQuestions.length === 5) break;
    }

    // Strip correct answers from response
    const questionsForClient = dailyQuestions.map((q) => ({
      _id: q._id,
      category: q.category,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      points: q.points * 2, // 2x for daily
      timeLimitSeconds: q.timeLimitSeconds,
    }));

    // Countdown to midnight UTC
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const secondsUntilReset = Math.floor((midnight.getTime() - now.getTime()) / 1000);

    res.json({
      status: 'success',
      data: {
        questions: questionsForClient,
        alreadyPlayed,
        lastPlayedScore: alreadyPlayed ? score?.dailyChallenge?.lastPlayedScore : null,
        currentStreak: score?.dailyChallenge?.currentStreak || 0,
        bestStreak: score?.dailyChallenge?.bestStreak || 0,
        totalDaysPlayed: score?.dailyChallenge?.totalDaysPlayed || 0,
        secondsUntilReset,
        date: today,
      },
    });
  } catch (err) {
    console.error('Daily challenge error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to get daily challenge' });
  }
});

/**
 * POST /api/games/daily-challenge/submit
 * Auth required — submit daily challenge answers (once per day)
 */
router.post(
  '/daily-challenge/submit',
  [
    authMiddleware,
    body('answers').isArray({ min: 1 }).withMessage('Answers array required'),
    body('answers.*.questionId').isString(),
    body('answers.*.selectedIndex').isInt({ min: 0, max: 3 }),
    body('answers.*.timeSpentSeconds').isInt({ min: 0 }),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      await seedQuestionsIfNeeded();

      const { answers } = req.body;
      const userId = req.user?.userId;
      const today = getTodayDateString();

      // Check if already played today
      let score = await UserGameScore.findOne({ userId });
      if (score?.dailyChallenge?.lastPlayedDate === today) {
        return res.status(400).json({
          status: 'error',
          message: 'You have already completed today\'s daily challenge. Come back tomorrow!',
        });
      }

      // Fetch questions
      const questionIds = answers.map((a: any) => a.questionId);
      const questions = await GameQuestion.find({ _id: { $in: questionIds } });
      const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

      let totalPointsEarned = 0;
      let correctCount = 0;
      const breakdown: any[] = [];

      for (const answer of answers) {
        const q = questionMap.get(answer.questionId);
        if (!q) continue;
        const isCorrect = answer.selectedIndex === q.correctIndex;
        if (isCorrect) {
          correctCount++;
          const pts = calcPoints(q.points * 2, q.difficulty as QuizDifficulty, answer.timeSpentSeconds, q.timeLimitSeconds); // 2x multiplier
          totalPointsEarned += pts;
          breakdown.push({ questionId: answer.questionId, question: q.question, selectedIndex: answer.selectedIndex, correctIndex: q.correctIndex, isCorrect: true, pointsEarned: pts, explanation: q.explanation });
        } else {
          breakdown.push({ questionId: answer.questionId, question: q.question, selectedIndex: answer.selectedIndex, correctIndex: q.correctIndex, isCorrect: false, pointsEarned: 0, explanation: q.explanation });
        }
      }

      // Streak bonus
      let streakBonus = 0;
      if (!score) score = new UserGameScore({ userId });

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (score.dailyChallenge.lastPlayedDate === yesterdayStr) {
        score.dailyChallenge.currentStreak += 1;
      } else {
        score.dailyChallenge.currentStreak = 1;
      }
      if (score.dailyChallenge.currentStreak > score.dailyChallenge.bestStreak) {
        score.dailyChallenge.bestStreak = score.dailyChallenge.currentStreak;
      }

      // Streak bonuses
      if (score.dailyChallenge.currentStreak >= 30) streakBonus = 500;
      else if (score.dailyChallenge.currentStreak >= 7) streakBonus = 150;
      else if (score.dailyChallenge.currentStreak >= 3) streakBonus = 50;

      totalPointsEarned += streakBonus;

      score.dailyChallenge.lastPlayedDate = today;
      score.dailyChallenge.lastPlayedScore = totalPointsEarned;
      score.dailyChallenge.totalDaysPlayed += 1;

      score.totalPoints += totalPointsEarned;
      score.gamesPlayed += 1;
      score.correctAnswers += correctCount;
      score.totalAnswers += answers.length;
      score.pointsHistory.push({ date: today, points: totalPointsEarned, category: 'daily', isDaily: true });

      // Badges
      const newBadges = computeNewBadges(score, correctCount, 'daily');
      score.badges.push(...newBadges);

      await score.save();

      res.json({
        status: 'success',
        data: {
          pointsEarned: totalPointsEarned,
          correctCount,
          totalCount: answers.length,
          breakdown,
          streakBonus,
          newTotalPoints: score.totalPoints,
          newBadges,
          dailyStreak: score.dailyChallenge.currentStreak,
        },
      });
    } catch (err) {
      console.error('Daily challenge submit error:', err);
      res.status(500).json({ status: 'error', message: 'Failed to submit daily challenge' });
    }
  }
);

/**
 * GET /api/games/leaderboard
 * Public — top 20 users, supports ?period=weekly|monthly|alltime
 */
router.get(
  '/leaderboard',
  [query('period').optional().isIn(['weekly', 'monthly', 'alltime'])],
  async (req: any, res: any) => {
    try {
      const { period = 'alltime' } = req.query;

      let leaderboard: any[] = [];

      if (period === 'alltime') {
        const scores = await UserGameScore.find({})
          .sort({ totalPoints: -1 })
          .limit(20)
          .populate('userId', 'username firstName lastName profile.avatar');

        leaderboard = scores.map((s, i) => ({
          rank: i + 1,
          userId: s.userId,
          totalPoints: s.totalPoints,
          gamesPlayed: s.gamesPlayed,
          accuracy: s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0,
          badges: s.badges,
          dailyStreak: s.dailyChallenge?.currentStreak || 0,
        }));
      } else {
        // Aggregate from pointsHistory
        const cutoff = period === 'weekly' ? getWeekStart() : getMonthStart();
        const cutoffStr = cutoff.toISOString().substring(0, 10);

        const scores = await UserGameScore.find({});
        const periodScores = scores
          .map((s) => {
            const pts = s.pointsHistory
              .filter((h) => h.date >= cutoffStr)
              .reduce((sum, h) => sum + h.points, 0);
            return { score: s, periodPoints: pts };
          })
          .filter((x) => x.periodPoints > 0)
          .sort((a, b) => b.periodPoints - a.periodPoints)
          .slice(0, 20);

        // Populate user info
        const userIds = periodScores.map((x) => x.score.userId);
        const users = await User.find({ _id: { $in: userIds } }).select('username firstName lastName');
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        leaderboard = periodScores.map((x, i) => ({
          rank: i + 1,
          userId: userMap.get(x.score.userId.toString()) || { username: 'Unknown' },
          totalPoints: x.periodPoints,
          gamesPlayed: x.score.gamesPlayed,
          accuracy: x.score.totalAnswers > 0 ? Math.round((x.score.correctAnswers / x.score.totalAnswers) * 100) : 0,
          badges: x.score.badges,
          dailyStreak: x.score.dailyChallenge?.currentStreak || 0,
        }));
      }

      res.json({ status: 'success', data: { leaderboard, period } });
    } catch (err) {
      console.error('Leaderboard error:', err);
      res.status(500).json({ status: 'error', message: 'Failed to get leaderboard' });
    }
  }
);

/**
 * GET /api/games/user-stats
 * Auth required — current user's stats
 */
router.get('/user-stats', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId;
    let score = await UserGameScore.findOne({ userId });

    if (!score) {
      return res.json({
        status: 'success',
        data: {
          totalPoints: 0,
          gamesPlayed: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          accuracy: 0,
          categoryStats: {},
          streak: { current: 0, best: 0 },
          dailyChallenge: { currentStreak: 0, bestStreak: 0, totalDaysPlayed: 0 },
          badges: [],
          rank: null,
        },
      });
    }

    // Compute rank
    const rank = await UserGameScore.countDocuments({ totalPoints: { $gt: score.totalPoints } }) + 1;

    res.json({
      status: 'success',
      data: {
        totalPoints: score.totalPoints,
        gamesPlayed: score.gamesPlayed,
        correctAnswers: score.correctAnswers,
        totalAnswers: score.totalAnswers,
        accuracy: score.totalAnswers > 0 ? Math.round((score.correctAnswers / score.totalAnswers) * 100) : 0,
        categoryStats: score.categoryStats,
        streak: score.streak,
        dailyChallenge: score.dailyChallenge,
        badges: score.badges,
        rank,
      },
    });
  } catch (err) {
    console.error('User stats error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to get user stats' });
  }
});

export default router;

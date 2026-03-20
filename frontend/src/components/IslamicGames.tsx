import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'quran' | 'hadith' | 'fiqh' | 'seerah' | 'general' | 'arabic' | 'history';
type Difficulty = 'easy' | 'medium' | 'hard';
type QuizRequestCategory = Category | 'mixed';
type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';
type GameView = 'home' | 'category' | 'difficulty' | 'questionCount' | 'quiz' | 'summary' | 'leaderboard';
type QuizStartSource = 'category' | 'quickPlay' | null;

interface Question {
  _id: string;
  category: Category;
  difficulty: Difficulty;
  question: string;
  options: string[];
  points: number;
  timeLimitSeconds: number;
}

interface AnswerRecord {
  questionId: string;
  selectedIndex: number;
  timeSpentSeconds: number;
}

interface BreakdownItem {
  questionId: string;
  question: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  pointsEarned: number;
  explanation: string;
}

interface QuizResult {
  pointsEarned: number;
  correctCount: number;
  totalCount: number;
  breakdown: BreakdownItem[];
  newTotalPoints: number;
  newBadges: string[];
  streak: number;
  streakBonus?: number;
  dailyStreak?: number;
  endedEarly?: boolean;
  attemptedCount?: number;
  requestedCount?: number;
}

interface CategoryStats {
  id: string;
  name: string;
  icon: string;
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
}

interface UserStats {
  totalPoints: number;
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number;
  streak: { current: number; best: number };
  dailyChallenge: { currentStreak: number; bestStreak: number; totalDaysPlayed: number };
  badges: string[];
  rank: number | null;
}

interface LeaderboardUser {
  _id?: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: LeaderboardUser;
  totalPoints: number;
  gamesPlayed: number;
  accuracy: number;
  badges: string[];
  dailyStreak: number;
}

interface DailyChallenge {
  questions: Question[];
  alreadyPlayed: boolean;
  lastPlayedScore: number | null;
  currentStreak: number;
  bestStreak: number;
  totalDaysPlayed: number;
  secondsUntilReset: number;
  date: string;
}

interface CategoryInfo {
  category: Category;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<Category, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  quran:   { label: 'Quran Knowledge',       icon: '📖', color: 'text-emerald-700', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-300' },
  hadith:  { label: 'Hadith & Sunnah',        icon: '📜', color: 'text-teal-700',    bgColor: 'bg-teal-50',     borderColor: 'border-teal-300' },
  fiqh:    { label: 'Fiqh (Islamic Law)',     icon: '⚖️', color: 'text-blue-700',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-300' },
  seerah:  { label: 'Seerah (Prophet\'s Life)', icon: '🕌', color: 'text-purple-700', bgColor: 'bg-purple-50',   borderColor: 'border-purple-300' },
  general: { label: 'General Islamic',        icon: '🌙', color: 'text-amber-700',   bgColor: 'bg-amber-50',    borderColor: 'border-amber-300' },
  arabic:  { label: 'Arabic Language',        icon: '🔤', color: 'text-rose-700',    bgColor: 'bg-rose-50',     borderColor: 'border-rose-300' },
  history: { label: 'Islamic History',        icon: '📚', color: 'text-indigo-700',  bgColor: 'bg-indigo-50',   borderColor: 'border-indigo-300' },
};

const DIFFICULTY_META: Record<Difficulty, { label: string; color: string; bgColor: string; points: number }> = {
  easy:   { label: 'Easy',   color: 'text-green-700',  bgColor: 'bg-green-100',  points: 10 },
  medium: { label: 'Medium', color: 'text-amber-700',  bgColor: 'bg-amber-100',  points: 20 },
  hard:   { label: 'Hard',   color: 'text-red-700',    bgColor: 'bg-red-100',    points: 30 },
};

const BADGE_META: Record<string, { label: string; icon: string; description: string }> = {
  first_quiz:      { label: 'First Quiz',       icon: '🌟', description: 'Completed your first quiz' },
  quran_scholar:   { label: 'Quran Scholar',    icon: '📖', description: '100 correct Quran answers' },
  hadith_master:   { label: 'Hadith Master',    icon: '📜', description: '100 correct Hadith answers' },
  on_fire:         { label: 'On Fire',          icon: '🔥', description: '10-answer streak' },
  weekly_warrior:  { label: 'Weekly Warrior',   icon: '🗓️', description: '7-day daily challenge streak' },
  ramadan_spirit:  { label: 'Ramadan Spirit',   icon: '🌙', description: '30-day daily challenge streak' },
  champion:        { label: 'Champion',         icon: '🏆', description: 'Reached top 10 leaderboard' },
};

const QUESTION_COUNT_PRESETS = [5, 10, 20, 50];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatPointsLabel(points: number): string {
  return `${points > 0 ? '+' : ''}${points}`;
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const BadgeChip: React.FC<{ badgeId: string }> = ({ badgeId }) => {
  const meta = BADGE_META[badgeId];
  if (!meta) return null;
  return (
    <span
      title={meta.description}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold border border-amber-300"
    >
      {meta.icon} {meta.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const IslamicGames: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<GameView>('home');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [quizRequestCategory, setQuizRequestCategory] = useState<QuizRequestCategory | null>(null);
  const [quizStartSource, setQuizStartSource] = useState<QuizStartSource>(null);
  const [requestedQuestionCount, setRequestedQuestionCount] = useState<number | null>(null);
  const [customQuestionCount, setCustomQuestionCount] = useState('');
  const [isDaily, setIsDaily] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [quitSummaryMeta, setQuitSummaryMeta] = useState<{ endedEarly: boolean; attemptedCount: number }>({
    endedEarly: false,
    attemptedCount: 0,
  });

  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPreview, setLeaderboardPreview] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('alltime');
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);
  const [pausedQuestionElapsedMs, setPausedQuestionElapsedMs] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef<AnswerRecord[]>([]);

  const clearQuizTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetQuestionCountSelection = () => {
    setRequestedQuestionCount(null);
    setCustomQuestionCount('');
  };

  const resetQuizState = () => {
    clearQuizTimer();
    setQuestions([]);
    setAnswers([]);
    answersRef.current = [];
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setTimeLeft(30);
    setPausedQuestionElapsedMs(0);
    setShowQuitConfirm(false);
  };

  const goHome = () => {
    resetQuizState();
    setView('home');
    setQuizResult(null);
    setError(null);
    setQuitSummaryMeta({ endedEarly: false, attemptedCount: 0 });
    setIsDaily(false);
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/games/categories`);
      setCategories(res.data.data.categories);
    } catch {
      // silently fail
    }
  }, []);

  const fetchCategoryStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/games/category-stats`);
      setCategoryStats(res.data.data.categories);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUserStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_URL}/games/user-stats`, { headers: getAuthHeaders() });
      setUserStats(res.data.data);
    } catch {
      // silently fail
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async (period: LeaderboardPeriod) => {
    try {
      const res = await axios.get(`${API_URL}/games/leaderboard?period=${period}`);
      setLeaderboard(res.data.data.leaderboard);
    } catch {
      // silently fail
    }
  }, []);

  const fetchLeaderboardPreview = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/games/leaderboard?period=alltime`);
      setLeaderboardPreview((res.data.data.leaderboard || []).slice(0, 3));
    } catch {
      // silently fail
    }
  }, []);

  const fetchDailyChallenge = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_URL}/games/daily-challenge`, { headers: getAuthHeaders() });
      setDailyChallenge(res.data.data);
      setCountdown(res.data.data.secondsUntilReset);
    } catch {
      // silently fail
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
    fetchCategoryStats();
    fetchLeaderboardPreview();
    if (user) {
      fetchUserStats();
      fetchDailyChallenge();
    } else {
      setUserStats(null);
      setDailyChallenge(null);
      setCountdown(0);
    }
  }, [user, fetchCategories, fetchCategoryStats, fetchUserStats, fetchDailyChallenge, fetchLeaderboardPreview]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (countdown <= 0) return;
    countdownRef.current = setInterval(() => {
      setCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown]);

  const startTimer = useCallback((limit: number, elapsedMs: number = 0) => {
    clearQuizTimer();
    setTimeLeft(limit);
    setQuestionStartTime(Date.now() - elapsedMs);
    timerRef.current = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearQuizTimer();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, []);

  const getAvailableCountForCategory = (category: Category, difficulty: Difficulty): number => {
    const stat = categoryStats.find((entry) => entry.id === category);
    if (stat) {
      return difficulty === 'easy'
        ? stat.easyCount
        : difficulty === 'medium'
          ? stat.mediumCount
          : stat.hardCount;
    }

    const info = categories.find((entry) => entry.category === category);
    if (!info) return 0;
    return difficulty === 'easy' ? info.easy : difficulty === 'medium' ? info.medium : info.hard;
  };

  const getAvailableQuestionCount = (category: QuizRequestCategory | null, difficulty: Difficulty | null): number => {
    if (!category || !difficulty) return 0;

    if (category === 'mixed') {
      const totalAvailable = (Object.keys(CATEGORY_META) as Category[]).reduce(
        (sum, currentCategory) => sum + getAvailableCountForCategory(currentCategory, difficulty),
        0,
      );
      return Math.min(100, totalAvailable);
    }

    return Math.min(100, getAvailableCountForCategory(category, difficulty));
  };

  const getDefaultQuestionCount = (maxCount: number): number | null => {
    const preferredCount = [10, 5, 20, 50].find((count) => count <= maxCount);
    if (preferredCount) return preferredCount;
    return maxCount > 0 ? maxCount : null;
  };

  const openQuestionCountStep = (category: QuizRequestCategory, difficulty: Difficulty, source: QuizStartSource) => {
    const maxCount = getAvailableQuestionCount(category, difficulty);
    setQuizRequestCategory(category);
    setSelectedDifficulty(difficulty);
    setQuizStartSource(source);
    setQuizResult(null);
    setQuitSummaryMeta({ endedEarly: false, attemptedCount: 0 });
    setError(null);
    setIsDaily(false);

    const defaultCount = getDefaultQuestionCount(maxCount);
    setRequestedQuestionCount(defaultCount);
    setCustomQuestionCount('');
    setView('questionCount');
  };

  const startQuiz = async (
    category: QuizRequestCategory,
    difficulty: Difficulty,
    questionCount: number,
    daily = false,
  ) => {
    if (!user && !daily) {
      setError('Please log in to play quiz games');
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    setQuizResult(null);
    setQuitSummaryMeta({ endedEarly: false, attemptedCount: 0 });

    try {
      let loadedQuestions: Question[];
      if (daily && dailyChallenge) {
        loadedQuestions = dailyChallenge.questions;
      } else {
        const res = await axios.get(
          `${API_URL}/games/questions?category=${category}&difficulty=${difficulty}&limit=${questionCount}`,
          { headers: getAuthHeaders() },
        );
        loadedQuestions = res.data.data.questions;
      }

      if (!loadedQuestions || loadedQuestions.length === 0) {
        setError('No questions available for this selection. Try another category or difficulty.');
        return;
      }

      setQuizRequestCategory(category);
      setSelectedDifficulty(difficulty);
      setRequestedQuestionCount(daily ? loadedQuestions.length : questionCount);
      setQuestions(loadedQuestions);
      setAnswers([]);
      answersRef.current = [];
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setPausedQuestionElapsedMs(0);
      setShowQuitConfirm(false);
      setIsDaily(daily);
      setView('quiz');
      startTimer(loadedQuestions[0].timeLimitSeconds);
    } catch {
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async (finalAnswers: AnswerRecord[], endedEarly = false) => {
    setLoading(true);
    setQuitSummaryMeta({ endedEarly, attemptedCount: finalAnswers.length });

    try {
      const endpoint = isDaily ? `${API_URL}/games/daily-challenge/submit` : `${API_URL}/games/submit`;
      const body: any = { answers: finalAnswers };

      if (!isDaily) {
        body.category = quizRequestCategory;
        body.difficulty = selectedDifficulty;
      }

      const res = await axios.post(endpoint, body, { headers: getAuthHeaders() });
      setQuizResult({
        ...res.data.data,
        endedEarly,
        attemptedCount: finalAnswers.length,
        requestedCount: requestedQuestionCount || finalAnswers.length,
      });
      setView('summary');
      fetchUserStats();
      fetchLeaderboardPreview();
      if (isDaily) fetchDailyChallenge();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit quiz.';
      setError(msg);
      setView('summary');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    clearQuizTimer();

    const currentQuizQuestion = questions[currentQuestionIndex];
    if (!currentQuizQuestion) return;

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    const newAnswer: AnswerRecord = {
      questionId: currentQuizQuestion._id,
      selectedIndex: index >= 0 ? index : 0,
      timeSpentSeconds: timeSpent,
    };

    setSelectedAnswer(index);
    setShowExplanation(true);
    setPausedQuestionElapsedMs(0);
    setAnswers((prev) => {
      const updated = [...prev, newAnswer];
      answersRef.current = updated;
      return updated;
    });
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= questions.length) {
      submitQuiz([...answersRef.current]);
      return;
    }

    setCurrentQuestionIndex(nextIndex);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setPausedQuestionElapsedMs(0);
    startTimer(questions[nextIndex].timeLimitSeconds);
  };

  const handleQuitQuiz = () => {
    clearQuizTimer();
    const attemptedAnswers = [...answersRef.current];

    if (attemptedAnswers.length === 0) {
      resetQuizState();
      setQuitSummaryMeta({ endedEarly: false, attemptedCount: 0 });
      setView('questionCount');
      return;
    }

    submitQuiz(attemptedAnswers, true);
  };

  const handleQuestionCountBack = () => {
    resetQuestionCountSelection();
    setError(null);

    if (quizStartSource === 'quickPlay') {
      setQuizRequestCategory(null);
      setSelectedDifficulty(null);
      setView('home');
      return;
    }

    setView('difficulty');
  };

  const handleLeaderboardPeriodChange = (period: LeaderboardPeriod) => {
    setLeaderboardPeriod(period);
    fetchLeaderboard(period);
  };

  const openLeaderboard = () => {
    fetchLeaderboard(leaderboardPeriod);
    setView('leaderboard');
  };

  useEffect(() => {
    if (timeLeft === 0 && view === 'quiz' && selectedAnswer === null) {
      handleAnswerSelect(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, view, selectedAnswer]);

  useEffect(() => (
    () => {
      clearQuizTimer();
    }
  ), []);

  const currentQuestion = questions[currentQuestionIndex];
  const timerPercent = currentQuestion ? (timeLeft / currentQuestion.timeLimitSeconds) * 100 : 100;
  const questionCountLimit = getAvailableQuestionCount(quizRequestCategory, selectedDifficulty);
  const questionCountValue = requestedQuestionCount || 0;
  const isQuestionCountValid = questionCountValue >= 1 && questionCountValue <= questionCountLimit;
  const questionCountContextLabel = quizRequestCategory === 'mixed'
    ? '⚡ Mixed Categories'
    : quizRequestCategory
      ? `${CATEGORY_META[quizRequestCategory].icon} ${CATEGORY_META[quizRequestCategory].label}`
      : 'Quiz Setup';
  const questionCountContextHint = quizRequestCategory === 'mixed'
    ? 'Quick Play • Medium difficulty across all categories'
    : selectedDifficulty
      ? `${DIFFICULTY_META[selectedDifficulty].label} difficulty`
      : '';

  if (view === 'leaderboard') {
    return (
      <LeaderboardView
        leaderboard={leaderboard}
        period={leaderboardPeriod}
        onPeriodChange={handleLeaderboardPeriodChange}
        onBack={() => setView('home')}
        currentUserId={user?.id || null}
      />
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <LeaderboardPreviewCard
          entries={leaderboardPreview}
          onOpen={openLeaderboard}
          currentUserId={null}
          rankText="Sign in to earn points and join the top 3."
        />

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-md p-8 border-2 border-emerald-200 text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Islamic Quiz Games</h2>
          <p className="text-gray-600 mb-2">Test your Islamic knowledge across 7 categories!</p>
          <ul className="text-sm text-gray-500 mb-6 space-y-1">
            <li>📖 Quran • 📜 Hadith • ⚖️ Fiqh • 🕌 Seerah</li>
            <li>🌙 General • 🔤 Arabic • 📚 Islamic History</li>
            <li>🔥 Daily Challenge with streak rewards</li>
            <li>🏆 Compete on the leaderboard</li>
          </ul>
          <button
            onClick={() => navigate(`/auth?redirect=${encodeURIComponent('/community?tab=games')}`)}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg"
          >
            Login to Play 🚀
          </button>
          <p className="text-xs text-gray-400 mt-3">Free account required to earn points and badges</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <div
                key={cat}
                className={`${meta.bgColor} ${meta.borderColor} border rounded-xl p-4 text-center opacity-75`}
              >
                <div className="text-3xl mb-1">{meta.icon}</div>
                <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'quiz' && currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{isDaily ? '⭐' : CATEGORY_META[currentQuestion.category]?.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {isDaily ? 'Daily Challenge' : CATEGORY_META[currentQuestion.category]?.label}
              </p>
              <p className="text-xs text-gray-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isDaily && (
              <button
                onClick={() => {
                  clearQuizTimer();
                  if (selectedAnswer === null) {
                    setPausedQuestionElapsedMs(Date.now() - questionStartTime);
                  }
                  setShowQuitConfirm(true);
                }}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Quit Quiz
              </button>
            )}
            <div className="text-right">
              <span className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`}>
                {timeLeft}s
              </span>
            </div>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              timerPercent > 50 ? 'bg-emerald-500' : timerPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${DIFFICULTY_META[currentQuestion.difficulty].bgColor} ${DIFFICULTY_META[currentQuestion.difficulty].color}`}>
              {DIFFICULTY_META[currentQuestion.difficulty].label}
            </span>
            <span className="text-xs text-gray-500">{currentQuestion.points} pts</span>
            {isDaily && <span className="text-xs text-amber-600 font-bold">2× Daily Bonus</span>}
          </div>
          <p className="text-lg font-semibold text-gray-900 leading-relaxed">{currentQuestion.question}</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {currentQuestion.options.map((option, idx) => {
            let btnClass = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-emerald-400 hover:bg-emerald-50';
            if (selectedAnswer !== null) {
              if (idx === selectedAnswer && selectedAnswer >= 0) {
                btnClass = 'bg-emerald-50 border-2 border-emerald-400 text-emerald-800';
              } else {
                btnClass = 'bg-gray-50 border-2 border-gray-200 text-gray-400 cursor-not-allowed';
              }
            }
            return (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(idx)}
                disabled={selectedAnswer !== null}
                className={`w-full text-left px-5 py-4 rounded-xl font-medium transition-all ${btnClass}`}
              >
                <span className="font-bold mr-3 text-gray-400">{String.fromCharCode(65 + idx)}.</span>
                {option}
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">💡 Explanation</p>
            <p className="text-sm text-blue-700">
              Keep going! The full explanation will be shown in your results.
            </p>
          </div>
        )}

        {selectedAnswer !== null && (
          <button
            onClick={handleNextQuestion}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg"
          >
            {currentQuestionIndex + 1 >= questions.length ? 'See Results 🎉' : 'Next Question →'}
          </button>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {showQuitConfirm && !isDaily && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-gray-900">Quit this quiz?</h3>
              <p className="mt-2 text-sm text-gray-600">
                {answersRef.current.length > 0
                  ? `You have answered ${answersRef.current.length} question${answersRef.current.length === 1 ? '' : 's'}. Quitting now will show results only for those attempted questions.`
                  : 'You have not answered any questions yet. Quitting now will discard this run.'}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowQuitConfirm(false);
                    if (selectedAnswer === null && timeLeft > 0) {
                      startTimer(timeLeft, pausedQuestionElapsedMs);
                    }
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Continue
                </button>
                <button
                  onClick={handleQuitQuiz}
                  className="rounded-xl bg-red-500 px-4 py-3 font-semibold text-white hover:bg-red-600"
                >
                  Quit Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'summary') {
    const summaryRequestedCount = quizResult?.requestedCount || requestedQuestionCount || quizResult?.totalCount || 0;
    const summaryAttemptedCount = quizResult?.attemptedCount || quitSummaryMeta.attemptedCount || quizResult?.totalCount || 0;

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-md p-6 border border-emerald-200 text-center">
          <div className="text-5xl mb-3">
            {quizResult && quizResult.correctCount / quizResult.totalCount >= 0.8 ? '🎉' :
             quizResult && quizResult.correctCount / quizResult.totalCount >= 0.5 ? '👍' : '📚'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {quizResult ? `${quizResult.correctCount}/${quizResult.totalCount} Correct!` : 'Quiz Complete!'}
          </h2>
	          {quizResult && (
	            <>
	              <p
	                className={`text-3xl font-extrabold mb-1 ${
	                  quizResult.pointsEarned > 0
	                    ? 'text-emerald-600'
	                    : quizResult.pointsEarned < 0
	                      ? 'text-red-600'
	                      : 'text-gray-600'
	                }`}
	              >
	                {formatPointsLabel(quizResult.pointsEarned)} pts
	              </p>
	              {quizResult.streakBonus && quizResult.streakBonus > 0 && (
	                <p className="text-sm text-amber-600 font-semibold">🔥 Streak Bonus: +{quizResult.streakBonus} pts</p>
	              )}
              <p className="text-sm text-gray-500 mt-1">Total Points: {quizResult.newTotalPoints.toLocaleString()}</p>
              {quizResult.streak > 0 && (
                <p className="text-sm text-orange-600 font-semibold mt-1">🔥 {quizResult.streak} answer streak!</p>
              )}
              {quizResult.dailyStreak && quizResult.dailyStreak > 0 && (
                <p className="text-sm text-purple-600 font-semibold">📅 {quizResult.dailyStreak} day daily streak!</p>
              )}
            </>
          )}
        </div>

        {!isDaily && quizResult && quizResult.endedEarly && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm font-bold text-amber-800">Quiz ended early</p>
            <p className="mt-1 text-sm text-amber-700">
              Attempted {summaryAttemptedCount} of {summaryRequestedCount} selected questions.
            </p>
          </div>
        )}

        {quizResult && quizResult.newBadges.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-800 mb-2">🏅 New Badges Earned!</p>
            <div className="flex flex-wrap gap-2">
              {quizResult.newBadges.map((badge) => <BadgeChip key={badge} badgeId={badge} />)}
            </div>
          </div>
        )}

        {quizResult && quizResult.breakdown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-4 border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">Question Breakdown</h3>
            <div className="space-y-3">
              {quizResult.breakdown.map((item, index) => (
                <div key={index} className={`rounded-xl p-3 border ${item.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{item.isCorrect ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 mb-1">{item.question}</p>
                      {!item.isCorrect && (
                        <p className="text-xs text-gray-600 mb-1">
                          Correct: <span className="font-semibold text-green-700">Option {String.fromCharCode(65 + item.correctIndex)}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-500 italic">{item.explanation}</p>
	                      {item.pointsEarned !== 0 && (
	                        <p
	                          className={`text-xs font-semibold mt-1 ${
	                            item.pointsEarned > 0 ? 'text-emerald-600' : 'text-red-600'
	                          }`}
	                        >
	                          {formatPointsLabel(item.pointsEarned)} pts
	                        </p>
	                      )}
	                    </div>
	                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={goHome}
            className="bg-white border-2 border-emerald-300 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-all"
          >
            🏠 Home
          </button>
          <button
            onClick={() => {
              if (quizRequestCategory && selectedDifficulty && !isDaily && requestedQuestionCount) {
                startQuiz(quizRequestCategory, selectedDifficulty, requestedQuestionCount);
              } else {
                goHome();
              }
            }}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 transition-all"
          >
            {isDaily ? '🏠 Back' : '🔄 Play Again'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'category') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">Choose a Category</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(CATEGORY_META) as Category[]).map((category) => {
            const meta = CATEGORY_META[category];
            const info = categories.find((entry) => entry.category === category);
            return (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setQuizRequestCategory(category);
                  setView('difficulty');
                }}
                className={`${meta.bgColor} ${meta.borderColor} border-2 rounded-2xl p-5 text-left hover:shadow-md transition-all hover:scale-105`}
              >
                <div className="text-4xl mb-2">{meta.icon}</div>
                <p className={`font-bold text-base ${meta.color}`}>{meta.label}</p>
                {info && (
                  <p className="text-xs text-gray-500 mt-1">{info.total} questions</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'difficulty' && selectedCategory) {
    const categoryMeta = CATEGORY_META[selectedCategory];
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('category')} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {categoryMeta.icon} {categoryMeta.label}
          </h2>
        </div>
        <p className="text-gray-600 text-sm">Choose your difficulty level:</p>
        <div className="space-y-3">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((difficulty) => {
            const difficultyMeta = DIFFICULTY_META[difficulty];
            return (
              <button
                key={difficulty}
                onClick={() => openQuestionCountStep(selectedCategory, difficulty, 'category')}
                className={`w-full ${difficultyMeta.bgColor} border-2 rounded-2xl p-5 text-left hover:shadow-md transition-all hover:scale-105 flex items-center justify-between`}
              >
                <div>
                  <p className={`font-bold text-lg ${difficultyMeta.color}`}>{difficultyMeta.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{difficultyMeta.points} base points per question</p>
                </div>
                <span className="text-2xl">
                  {difficulty === 'easy' ? '🌱' : difficulty === 'medium' ? '⚡' : '🔥'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'questionCount' && quizRequestCategory && selectedDifficulty) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={handleQuestionCountBack} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Choose question count</h2>
            <p className="text-sm text-gray-500">{questionCountContextLabel}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-800">{questionCountContextHint}</p>
          <p className="mt-1 text-sm text-emerald-700">
            Available questions for this mode: <span className="font-bold">{questionCountLimit}</span>
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Quick presets</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUESTION_COUNT_PRESETS.map((preset) => {
              const isDisabled = preset > questionCountLimit;
              const isSelected = requestedQuestionCount === preset && customQuestionCount === '';
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    setRequestedQuestionCount(preset);
                    setCustomQuestionCount('');
                  }}
                  className={`rounded-2xl border-2 px-4 py-4 text-center font-bold transition-all ${
                    isDisabled
                      ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                      : isSelected
                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="custom-question-count">
            Custom question count
          </label>
          <input
            id="custom-question-count"
            type="number"
            min={1}
            max={questionCountLimit || 1}
            value={customQuestionCount}
            onChange={(event) => {
              const rawValue = event.target.value.replace(/\D/g, '');
              if (!rawValue) {
                setCustomQuestionCount('');
                setRequestedQuestionCount(null);
                return;
              }

              const parsedValue = parseInt(rawValue, 10);
              const clampedValue = Math.min(Math.max(parsedValue, 1), questionCountLimit || 1);
              setCustomQuestionCount(String(clampedValue));
              setRequestedQuestionCount(clampedValue);
            }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Enter a number"
          />
          <p className="mt-2 text-xs text-gray-500">
            Choose between 1 and {questionCountLimit || 1} questions.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        )}

        <button
          onClick={() => startQuiz(quizRequestCategory, selectedDifficulty, questionCountValue)}
          disabled={!isQuestionCountValid || loading || questionCountLimit === 0}
          className={`w-full rounded-2xl py-4 text-lg font-bold transition-all ${
            !isQuestionCountValid || loading || questionCountLimit === 0
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg'
          }`}
        >
          {loading ? 'Loading...' : 'Start Quiz →'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dailyChallenge && (
        <DailyChallengeBanner
          daily={dailyChallenge}
          countdown={countdown}
          onPlay={() => startQuiz('quran', 'easy', dailyChallenge.questions.length, true)}
          loading={loading}
        />
      )}

      {userStats && (
        <UserStatsCard stats={userStats} onLeaderboard={openLeaderboard} />
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900">🎯 Quiz Categories</h3>
          <button
            onClick={() => setView('category')}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View All →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(Object.keys(CATEGORY_META) as Category[]).map((category) => {
            const meta = CATEGORY_META[category];
            const stats = categoryStats.find((entry) => entry.id === category);
            return (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setQuizRequestCategory(category);
                  setView('difficulty');
                }}
                className={`${meta.bgColor} ${meta.borderColor} border-2 rounded-xl p-4 text-center hover:shadow-md transition-all hover:scale-105`}
              >
                <div className="text-3xl mb-1">{meta.icon}</div>
                <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
                {stats ? (
                  <p className="text-xs text-gray-400 mt-0.5">{stats.totalQuestions} Qs</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Loading...</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 text-white">
        <h3 className="font-bold text-lg mb-1">⚡ Quick Play</h3>
        <p className="text-sm text-emerald-100 mb-3">Mixed categories, medium difficulty, choose your own question count</p>
        <button
          onClick={() => openQuestionCountStep('mixed', 'medium', 'quickPlay')}
          disabled={loading}
          className="bg-white text-emerald-700 px-6 py-2 rounded-xl font-bold hover:bg-emerald-50 transition-all"
        >
          {loading ? 'Loading...' : 'Start Now →'}
        </button>
      </div>

      <LeaderboardPreviewCard
        entries={leaderboardPreview}
        onOpen={openLeaderboard}
        currentUserId={user?.id || null}
        rankText={
          userStats?.rank
            ? `Your rank: #${userStats.rank} with ${userStats.totalPoints.toLocaleString()} pts`
            : 'Play to earn points and climb the leaderboard!'
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}
    </div>
  );
};

// ─── Daily Challenge Banner ────────────────────────────────────────────────────

const DailyChallengeBanner: React.FC<{
  daily: DailyChallenge;
  countdown: number;
  onPlay: () => void;
  loading: boolean;
}> = ({ daily, countdown, onPlay, loading }) => {
  return (
    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">⭐</span>
            <h3 className="font-extrabold text-amber-800 text-lg">Daily Challenge</h3>
            <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-bold">2× Points</span>
          </div>
          <p className="text-sm text-amber-700 mb-2">5 questions across all categories — resets in:</p>
          <p className="text-2xl font-mono font-bold text-amber-800">{formatCountdown(countdown)}</p>

          {daily.currentStreak > 0 && (
            <p className="text-sm text-orange-600 font-semibold mt-1">
              🔥 {daily.currentStreak} day streak! {daily.currentStreak >= 7 ? '(Weekly Warrior!)' : ''}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          {daily.alreadyPlayed ? (
            <div className="text-center">
              <div className="text-3xl mb-1">✅</div>
              <p className="text-xs font-bold text-green-700">Completed!</p>
              <p className="text-xs text-gray-500">+{daily.lastPlayedScore} pts</p>
            </div>
          ) : (
            <button
              onClick={onPlay}
              disabled={loading}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-3 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all transform hover:scale-105 shadow-md whitespace-nowrap"
            >
              {loading ? '...' : 'Play Now!'}
            </button>
          )}
        </div>
      </div>

      {/* Streak milestones */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {[
          { days: 3, bonus: '+50 pts', icon: '🌟' },
          { days: 7, bonus: '+150 pts', icon: '🗓️' },
          { days: 30, bonus: '+500 pts', icon: '🌙' },
        ].map(({ days, bonus, icon }) => (
          <span
            key={days}
            className={`text-xs px-2 py-1 rounded-full border font-medium ${
              daily.currentStreak >= days
                ? 'bg-amber-200 border-amber-400 text-amber-800'
                : 'bg-white border-gray-200 text-gray-400'
            }`}
          >
            {icon} {days}d: {bonus}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── User Stats Card ───────────────────────────────────────────────────────────

const UserStatsCard: React.FC<{ stats: UserStats; onLeaderboard: () => void }> = ({ stats, onLeaderboard }) => {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">📊 Your Stats</h3>
        {stats.rank && (
          <button onClick={onLeaderboard} className="text-sm text-emerald-600 font-semibold hover:underline">
            Rank #{stats.rank}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Total Points', value: stats.totalPoints.toLocaleString(), icon: '⭐' },
          { label: 'Games Played', value: stats.gamesPlayed, icon: '🎮' },
          { label: 'Accuracy', value: `${stats.accuracy}%`, icon: '🎯' },
          { label: 'Best Streak', value: stats.streak.best, icon: '🔥' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl mb-0.5">{icon}</div>
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>
      {stats.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stats.badges.map((b) => <BadgeChip key={b} badgeId={b} />)}
        </div>
      )}
    </div>
  );
};

const LeaderboardPreviewCard: React.FC<{
  entries: LeaderboardEntry[];
  onOpen: () => void;
  currentUserId: string | null;
  rankText: string;
}> = ({ entries, onOpen, currentUserId, rankText }) => {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">🏆 Leaderboard</h3>
        <button
          onClick={onOpen}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          Full Leaderboard →
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No scores yet. Be the first to play.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const entryUserId = entry.userId?._id || null;
            const isCurrentUser = Boolean(currentUserId && entryUserId === currentUserId);
            return (
              <div
                key={`preview-${entry.rank}-${entry.userId?.username || 'unknown'}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
                  isCurrentUser ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="w-8 text-center text-xl">{getRankIcon(entry.rank)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{entry.userId?.username || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{entry.accuracy}% accuracy • {entry.gamesPlayed} games</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{entry.totalPoints.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-400">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-sm text-gray-500">{rankText}</p>
    </div>
  );
};

// ─── Leaderboard View ─────────────────────────────────────────────────────────

const LeaderboardView: React.FC<{
  leaderboard: LeaderboardEntry[];
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  onBack: () => void;
  currentUserId: string | null;
}> = ({ leaderboard, period, onPeriodChange, onBack, currentUserId }) => {
  const periods: { id: LeaderboardPeriod; label: string }[] = [
    { id: 'weekly', label: 'This Week' },
    { id: 'monthly', label: 'This Month' },
    { id: 'alltime', label: 'All Time' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">🏆 Leaderboard</h2>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {periods.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onPeriodChange(id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              period === id
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      {leaderboard.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🏆</div>
          <p>No scores yet for this period. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const username = entry.userId?.username || 'Unknown';
            const entryUserId = entry.userId?._id || null;
            const isCurrentUser = Boolean(currentUserId && entryUserId === currentUserId);
            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  isCurrentUser
                    ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center">
                  {entry.rank === 1 ? (
                    <span className="text-2xl">🥇</span>
                  ) : entry.rank === 2 ? (
                    <span className="text-2xl">🥈</span>
                  ) : entry.rank === 3 ? (
                    <span className="text-2xl">🥉</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-500">#{entry.rank}</span>
                  )}
                </div>

                {/* Avatar placeholder */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {username.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{username}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">{entry.accuracy}% accuracy</span>
                    {entry.dailyStreak > 0 && (
                      <span className="text-xs text-orange-500">🔥 {entry.dailyStreak}d</span>
                    )}
                    {entry.badges.slice(0, 2).map((b) => {
                      const bm = BADGE_META[b];
                      return bm ? <span key={b} title={bm.label} className="text-xs">{bm.icon}</span> : null;
                    })}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-emerald-600">{entry.totalPoints.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IslamicGames;

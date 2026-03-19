import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPointsHistoryEntry {
  date: string; // "YYYY-MM-DD"
  points: number;
  category: string;
  isDaily: boolean;
}

export interface ICategoryStats {
  points: number;
  correct: number;
  total: number;
}

export interface IUserGameScore extends Document {
  userId: Types.ObjectId;
  totalPoints: number;
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  categoryStats: {
    quran: ICategoryStats;
    hadith: ICategoryStats;
    fiqh: ICategoryStats;
    seerah: ICategoryStats;
    general: ICategoryStats;
    arabic: ICategoryStats;
    history: ICategoryStats;
  };
  streak: {
    current: number;
    best: number;
    lastPlayedDate: string; // "YYYY-MM-DD"
  };
  dailyChallenge: {
    lastPlayedDate: string; // "YYYY-MM-DD"
    lastPlayedScore: number;
    currentStreak: number;
    bestStreak: number;
    totalDaysPlayed: number;
  };
  badges: string[];
  pointsHistory: IPointsHistoryEntry[];
  // Track questions user has already answered (to avoid repetition)
  questionHistory: {
    quran: string[];  // Array of question IDs
    hadith: string[];
    fiqh: string[];
    seerah: string[];
    general: string[];
    arabic: string[];
    history: string[];
  };
  updatedAt: Date;
}

const CategoryStatsSchema = new Schema<ICategoryStats>(
  {
    points: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserGameScoreSchema = new Schema<IUserGameScore>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalPoints: { type: Number, default: 0, index: true },
    gamesPlayed: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    totalAnswers: { type: Number, default: 0 },
    categoryStats: {
      quran: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
      hadith: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
      fiqh: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
      seerah: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
      general: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
      arabic: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
      history: { type: CategoryStatsSchema, default: () => ({ points: 0, correct: 0, total: 0 }) },
    },
    streak: {
      current: { type: Number, default: 0 },
      best: { type: Number, default: 0 },
      lastPlayedDate: { type: String, default: '' },
    },
    dailyChallenge: {
      lastPlayedDate: { type: String, default: '' },
      lastPlayedScore: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      totalDaysPlayed: { type: Number, default: 0 },
    },
    badges: { type: [String], default: [] },
    pointsHistory: {
      type: [
        {
          date: { type: String, required: true },
          points: { type: Number, required: true },
          category: { type: String, required: true },
          isDaily: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    questionHistory: {
      quran: { type: [String], default: [] },
      hadith: { type: [String], default: [] },
      fiqh: { type: [String], default: [] },
      seerah: { type: [String], default: [] },
      general: { type: [String], default: [] },
      arabic: { type: [String], default: [] },
      history: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUserGameScore>('UserGameScore', UserGameScoreSchema);

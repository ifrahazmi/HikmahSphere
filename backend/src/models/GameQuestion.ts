import mongoose, { Document, Schema } from 'mongoose';

export type QuizCategory = 'quran' | 'hadith' | 'fiqh' | 'seerah' | 'general' | 'arabic' | 'history';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface IGameQuestion extends Document {
  category: QuizCategory;
  difficulty: QuizDifficulty;
  question: string;
  options: string[]; // exactly 4 options
  correctIndex: number; // 0-3
  explanation: string;
  points: number; // easy=10, medium=20, hard=30
  timeLimitSeconds: number;
  createdAt: Date;
}

const GameQuestionSchema = new Schema<IGameQuestion>(
  {
    category: {
      type: String,
      enum: ['quran', 'hadith', 'fiqh', 'seerah', 'general', 'arabic', 'history'],
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length === 4,
        message: 'Exactly 4 options required',
      },
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
    points: {
      type: Number,
      required: true,
      default: 10,
    },
    timeLimitSeconds: {
      type: Number,
      default: 30,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IGameQuestion>('GameQuestion', GameQuestionSchema);

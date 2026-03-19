/**
 * Islamic Quiz Game Questions Utility
 * 
 * Provides helper functions to retrieve and manage quiz questions
 * from the SEED_QUESTIONS database for various game modes.
 * 
 * @packageDocumentation
 */

import { SEED_QUESTIONS } from '../data/gameQuestionsSeed';
import { QuizCategory, QuizDifficulty } from '../models/GameQuestion';

export interface QuizQuestion {
  category: QuizCategory;
  difficulty: QuizDifficulty;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
  timeLimitSeconds: number;
}

export interface QuizGameConfig {
  category?: QuizCategory | 'mixed';
  difficulty?: QuizDifficulty | 'mixed';
  questionCount: number;
}

/**
 * Get all available categories
 */
export function getAvailableCategories(): QuizCategory[] {
  const categories = new Set<QuizCategory>();
  SEED_QUESTIONS.forEach(q => categories.add(q.category as QuizCategory));
  return Array.from(categories);
}

/**
 * Get questions filtered by category and difficulty
 */
export function getQuestionsByFilter(options: {
  category?: QuizCategory | 'mixed';
  difficulty?: QuizDifficulty | 'mixed';
}): QuizQuestion[] {
  let filtered = SEED_QUESTIONS.filter(q => 
    typeof q.category === 'string' && typeof q.difficulty === 'string'
  ) as QuizQuestion[];

  if (options.category && options.category !== 'mixed') {
    filtered = filtered.filter(q => q.category === options.category);
  }

  if (options.difficulty && options.difficulty !== 'mixed') {
    filtered = filtered.filter(q => q.difficulty === options.difficulty);
  }

  return shuffleArray(filtered);
}

/**
 * Get a random set of questions for a quiz game
 */
export function getQuizQuestions(config: QuizGameConfig): QuizQuestion[] {
  let pool = getQuestionsByFilter({
    category: config.category ?? 'mixed',
    difficulty: config.difficulty ?? 'mixed',
  });

  // If not enough questions, expand the pool
  if (pool.length < config.questionCount) {
    if (config.difficulty && config.difficulty !== 'mixed') {
      // Try with mixed difficulty
      pool = getQuestionsByFilter({
        category: config.category ?? 'mixed',
        difficulty: 'mixed',
      });
    }
    
    if (pool.length < config.questionCount && config.category && config.category !== 'mixed') {
      // Try with mixed category
      pool = getQuestionsByFilter({
        category: 'mixed',
        difficulty: config.difficulty ?? 'mixed',
      });
    }

    if (pool.length < config.questionCount) {
      // Use all available
      pool = getQuestionsByFilter({
        category: 'mixed',
        difficulty: 'mixed',
      });
    }
  }

  // Return requested number of questions
  return pool.slice(0, config.questionCount);
}

/**
 * Get questions for a specific category with balanced difficulty
 */
export function getBalancedCategoryQuestions(
  category: QuizCategory,
  questionsPerDifficulty: number = 5
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  
  (['easy', 'medium', 'hard'] as QuizDifficulty[]).forEach(diff => {
    const diffQuestions = SEED_QUESTIONS.filter(
      q => q.category === category && q.difficulty === diff
    ).slice(0, questionsPerDifficulty) as QuizQuestion[];
    
    questions.push(...shuffleArray(diffQuestions));
  });

  return questions;
}

/**
 * Get a mix of questions from all categories (trivia mode)
 */
export function getMixedTriviaQuestions(count: number = 10): QuizQuestion[] {
  const categories = getAvailableCategories();
  const questionsPerCategory = Math.ceil(count / categories.length);
  
  const allQuestions: QuizQuestion[] = [];
  
  categories.forEach(category => {
    const categoryQuestions = getBalancedCategoryQuestions(
      category,
      questionsPerCategory
    );
    allQuestions.push(...categoryQuestions);
  });

  return shuffleArray(allQuestions).slice(0, count);
}

/**
 * Get questions for a specific difficulty level across all categories
 */
export function getDifficultyLevelQuestions(
  difficulty: QuizDifficulty,
  count: number = 10
): QuizQuestion[] {
  return (SEED_QUESTIONS.filter(q => q.difficulty === difficulty) as QuizQuestion[])
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

/**
 * Calculate total possible points for a set of questions
 */
export function calculateTotalPoints(questions: QuizQuestion[]): number {
  return questions.reduce((total, q) => total + q.points, 0);
}

/**
 * Get statistics about available questions
 */
export function getQuestionStats() {
  const stats: {
    total: number;
    byCategory: Record<string, number>;
    byDifficulty: Record<string, number>;
  } = {
    total: SEED_QUESTIONS.length,
    byCategory: {},
    byDifficulty: {},
  };

  SEED_QUESTIONS.forEach(q => {
    const cat = q.category as string;
    const diff = q.difficulty as string;
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    stats.byDifficulty[diff] = (stats.byDifficulty[diff] || 0) + 1;
  });

  return stats;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[j]!;
    shuffled[j] = shuffled[i]!;
    shuffled[i] = temp;
  }
  return shuffled;
}

/**
 * Validate if a question has proper structure
 */
export function validateQuestion(question: any): boolean {
  return (
    question &&
    typeof question.category === 'string' &&
    typeof question.difficulty === 'string' &&
    typeof question.question === 'string' &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    typeof question.correctIndex === 'number' &&
    typeof question.explanation === 'string' &&
    typeof question.points === 'number' &&
    typeof question.timeLimitSeconds === 'number'
  );
}

/**
 * Get a single random question
 */
export function getRandomQuestion(): QuizQuestion | null {
  if (SEED_QUESTIONS.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * SEED_QUESTIONS.length);
  return SEED_QUESTIONS[randomIndex] as QuizQuestion;
}

/**
 * Search questions by keyword
 */
export function searchQuestions(keyword: string, limit: number = 10): QuizQuestion[] {
  const lowerKeyword = keyword.toLowerCase();
  return (SEED_QUESTIONS.filter(q => 
    q.question.toLowerCase().includes(lowerKeyword) ||
    q.explanation.toLowerCase().includes(lowerKeyword)
  ) as QuizQuestion[]).slice(0, limit);
}

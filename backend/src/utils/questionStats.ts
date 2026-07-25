/**
 * Question Statistics - Dynamic Category Counts
 * 
 * Automatically calculates question counts from SEED_QUESTIONS
 * Updates when questions are added/removed
 */

import { SEED_QUESTIONS } from '../data/gameQuestionsSeed';
import { QuizCategory, QuizDifficulty } from '../models/GameQuestion';

export interface CategoryStats {
  id: string;
  name: string;
  icon: string;
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
}

export interface AllStats {
  totalQuestions: number;
  categories: CategoryStats[];
  byDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
}

/**
 * Get category display information
 */
const CATEGORY_INFO: Record<QuizCategory, { name: string; icon: string }> = {
  quran: { name: 'Quran Knowledge', icon: '📖' },
  hadith: { name: 'Hadith & Sunnah', icon: '📜' },
  fiqh: { name: 'Fiqh (Islamic Law)', icon: '⚖️' },
  seerah: { name: 'Seerah (Prophet\'s Life)', icon: '🕌' },
  general: { name: 'General Islamic', icon: '🌙' },
  arabic: { name: 'Arabic Language', icon: '🔤' },
  history: { name: 'Islamic History', icon: '📚' },
  hajj_umrah: { name: 'Hajj & Umrah', icon: '🕋' },
};

/**
 * Calculate statistics for a specific category
 */
export function getCategoryStats(category: QuizCategory): CategoryStats {
  const categoryQuestions = SEED_QUESTIONS.filter(q => q.category === category);
  
  return {
    id: category,
    name: CATEGORY_INFO[category].name,
    icon: CATEGORY_INFO[category].icon,
    totalQuestions: categoryQuestions.length,
    easyCount: categoryQuestions.filter(q => q.difficulty === 'easy').length,
    mediumCount: categoryQuestions.filter(q => q.difficulty === 'medium').length,
    hardCount: categoryQuestions.filter(q => q.difficulty === 'hard').length,
  };
}

/**
 * Get statistics for all categories
 */
export function getAllCategoryStats(): CategoryStats[] {
  const categories = Object.keys(CATEGORY_INFO) as QuizCategory[];
  return categories.map(cat => getCategoryStats(cat));
}

/**
 * Get complete statistics including totals
 */
export function getCompleteStats(): AllStats {
  const categories = getAllCategoryStats();
  
  const byDifficulty = {
    easy: SEED_QUESTIONS.filter(q => q.difficulty === 'easy').length,
    medium: SEED_QUESTIONS.filter(q => q.difficulty === 'medium').length,
    hard: SEED_QUESTIONS.filter(q => q.difficulty === 'hard').length,
  };

  return {
    totalQuestions: SEED_QUESTIONS.length,
    categories,
    byDifficulty,
  };
}

/**
 * Get formatted display string for a category
 * Example: "📖 Quran Knowledge - 151 Qs"
 */
export function getCategoryDisplayString(category: QuizCategory): string {
  const stats = getCategoryStats(category);
  return `${stats.icon} ${stats.name} - ${stats.totalQuestions} Qs`;
}

/**
 * Print all category statistics to console (for debugging)
 */
export function printCategoryStats(): void {
  const stats = getCompleteStats();
  
  console.log('\\n📊 === QUESTION STATISTICS ===');
  console.log(`Total Questions: ${stats.totalQuestions}`);
  console.log('\\n📁 By Category:');
  
  stats.categories.forEach(cat => {
    console.log(`  ${cat.icon} ${cat.name.padEnd(25)} : ${cat.totalQuestions.toString().padStart(3)} Qs (E:${cat.easyCount.toString().padStart(2)}, M:${cat.mediumCount.toString().padStart(2)}, H:${cat.hardCount.toString().padStart(2)})`);
  });
  
  console.log('\\n📊 By Difficulty:');
  console.log(`  🟢 Easy:   ${stats.byDifficulty.easy}`);
  console.log(`  🟡 Medium: ${stats.byDifficulty.medium}`);
  console.log(`  🔴 Hard:   ${stats.byDifficulty.hard}`);
  console.log('==============================\\n');
}

/**
 * Check if a category has questions available
 */
export function hasQuestions(category: QuizCategory, difficulty?: QuizDifficulty): boolean {
  if (difficulty) {
    return SEED_QUESTIONS.some(q => q.category === category && q.difficulty === difficulty);
  }
  return SEED_QUESTIONS.some(q => q.category === category);
}

/**
 * Get minimum and maximum question counts across categories
 */
export function getQuestionRange(): { min: number; max: number; avg: number } {
  const categories = getAllCategoryStats();
  const counts = categories.map(c => c.totalQuestions);
  
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
  
  return { min, max, avg };
}

/**
 * Find categories with least questions (for content planning)
 */
export function getCategoriesNeedingQuestions(limit: number = 3): CategoryStats[] {
  const categories = getAllCategoryStats();
  return categories
    .sort((a, b) => a.totalQuestions - b.totalQuestions)
    .slice(0, limit);
}

/**
 * Validate that all questions have proper structure
 */
export function validateAllQuestions(): { valid: number; invalid: any[] } {
  const invalid: any[] = [];
  
  SEED_QUESTIONS.forEach((q, index) => {
    const issues: string[] = [];
    
    if (!q.category || !['quran', 'hadith', 'fiqh', 'seerah', 'general', 'arabic', 'history', 'hajj_umrah'].includes(q.category)) {
      issues.push('Invalid category');
    }
    
    if (!q.difficulty || !['easy', 'medium', 'hard'].includes(q.difficulty)) {
      issues.push('Invalid difficulty');
    }
    
    if (!q.question || q.question.trim().length === 0) {
      issues.push('Empty question');
    }
    
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      issues.push('Must have exactly 4 options');
    }
    
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
      issues.push('Invalid correctIndex (must be 0-3)');
    }
    
    if (issues.length > 0) {
      invalid.push({ index, issues, question: q.question?.substring(0, 50) });
    }
  });
  
  return {
    valid: SEED_QUESTIONS.length - invalid.length,
    invalid,
  };
}

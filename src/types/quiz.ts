/**
 * Quiz and assessment type definitions
 * Replaces TODO for proper quiz question types
 */

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: QuizOption[];
  correct_option?: string;
  explanation?: string;
  module_id: string;
}

export interface QuizOption {
  id: string;
  text: string;
  value: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  attempt_number: number;
  created_at: string;
}

export interface QuizResults {
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  passed: boolean;
  attempt_id: string;
  completed_at: string;
}
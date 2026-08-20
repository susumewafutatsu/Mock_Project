// src/utils/constants.js
// Shared constants used across the application

export const ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
};

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT_ANSWER: 'SHORT_ANSWER',
};

export const DIFFICULTY_LABELS = {
  1: 'Rất dễ',
  2: 'Dễ',
  3: 'Trung bình',
  4: 'Khó',
  5: 'Rất khó',
};

export const ROUTES = {
  LOGIN: '/login',
  ADMIN_DASHBOARD: '/admin/dashboard',
  TEACHER_QUESTIONS: '/teacher/questions',
  TEACHER_EXAMS: '/teacher/exams',
  TEACHER_AI: '/teacher/ai-generate',
  STUDENT_EXAMS: '/student/exams',
  STUDENT_RESULTS: '/student/results',
};

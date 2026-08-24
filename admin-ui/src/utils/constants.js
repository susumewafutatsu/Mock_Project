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
  AUTH_CALLBACK: '/auth/callback',
  ADMIN_DASHBOARD: '/admin/dashboard',
  TEACHER_QUESTIONS: '/teacher/questions',
  TEACHER_EXAMS: '/teacher/exams',
  TEACHER_AI: '/teacher/ai-generate',
  STUDENT_EXAMS: '/student/exams',
  STUDENT_RESULTS: '/student/results',
};

// Key lưu session trong localStorage
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'currentUser',
};

// Trang mặc định sau khi đăng nhập, theo role
export const HOME_BY_ROLE = {
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.TEACHER]: ROUTES.TEACHER_QUESTIONS,
  [ROLES.STUDENT]: ROUTES.STUDENT_EXAMS,
};

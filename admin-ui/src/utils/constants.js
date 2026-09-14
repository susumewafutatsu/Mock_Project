// src/utils/constants.js
// Shared constants used across the application

export const ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
};

// Phải khớp enum QuestionType ở backend.
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  SENTENCE_ORDERING: 'SENTENCE_ORDERING',
  ESSAY: 'ESSAY',
};

export const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Trắc nghiệm',
  SENTENCE_ORDERING: 'Sắp xếp câu (並べ替え)',
  // Nói rõ giới hạn ngay trên nhãn.
  ESSAY: 'Tự luận — chỉ dùng để luyện tập',
};

/** Kỹ năng JLPT của câu hỏi. */
export const JLPT_SKILLS = {
  VOCABULARY: 'VOCABULARY',
  GRAMMAR: 'GRAMMAR',
  READING: 'READING',
  LISTENING: 'LISTENING',
};

export const JLPT_SKILL_LABELS = {
  VOCABULARY: '文字・語彙 — Chữ Hán · Từ vựng',
  GRAMMAR: '文法 — Ngữ pháp',
  READING: '読解 — Đọc hiểu',
  LISTENING: '聴解 — Nghe hiểu',
};

/** Bản ngắn, cho những chỗ chật như ô bảng và thẻ câu hỏi. */
export const JLPT_SKILL_SHORT = {
  VOCABULARY: '文字・語彙',
  GRAMMAR: '文法',
  READING: '読解',
  LISTENING: '聴解',
};

// Câu tự luận không có đáp án chấm tự động — form ẩn phần đáp án
export const TYPES_WITHOUT_ANSWERS = [QUESTION_TYPES.ESSAY];

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
  TEACHER_DASHBOARD: '/teacher/exams',
  TEACHER_QUESTIONS: '/teacher/questions',
  TEACHER_EXAMS: '/teacher/exams',
  TEACHER_CLASSES: '/teacher/classes',
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
  [ROLES.TEACHER]: ROUTES.TEACHER_EXAMS,
  [ROLES.STUDENT]: ROUTES.STUDENT_EXAMS,
};

// Nhãn tiếng Việt cho LessonType của backend (GRAMMAR | KANJI | VOCAB | READING | LISTENING).
export const LESSON_TYPE = {
  GRAMMAR:   { label: 'Ngữ pháp', cls: '' },
  KANJI:     { label: 'Chữ Hán',  cls: 'kanji' },
  VOCAB:     { label: 'Từ vựng',  cls: 'vocab' },
  READING:   { label: 'Đọc hiểu', cls: 'reading' },
  LISTENING: { label: 'Nghe',     cls: 'reading' },
};

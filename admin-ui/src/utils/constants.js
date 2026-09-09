// src/utils/constants.js
// Shared constants used across the application

export const ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
};

// Phải khớp enum QuestionType ở backend (MULTIPLE_CHOICE | ESSAY | MATCHING)
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  ESSAY: 'ESSAY',
  MATCHING: 'MATCHING',
};

export const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Trắc nghiệm',
  ESSAY: 'Tự luận',
  MATCHING: 'Nối đáp án',
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

// Nhãn tiếng Việt cho LessonType của backend (GRAMMAR | KANJI | VOCAB |
// READING | LISTENING). Dùng ở cả trang khoá học của thí sinh lẫn màn duyệt
// của quản trị viên, nên để ở đây thay vì export từ một file component.
//
// `cls` là hậu tố class CSS trong Study.css — mỗi loại một màu, vì loại bài
// quyết định cách hiển thị chứ không phải nhãn trang trí.
export const LESSON_TYPE = {
  GRAMMAR:   { label: 'Ngữ pháp', cls: '' },
  KANJI:     { label: 'Chữ Hán',  cls: 'kanji' },
  VOCAB:     { label: 'Từ vựng',  cls: 'vocab' },
  READING:   { label: 'Đọc hiểu', cls: 'reading' },
  LISTENING: { label: 'Nghe',     cls: 'reading' },
};

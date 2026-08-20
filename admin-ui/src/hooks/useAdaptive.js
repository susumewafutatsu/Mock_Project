// src/hooks/useAdaptive.js
// TODO: Implement adaptive question selection logic on frontend
// - Track student's current difficulty level (start at medium = 3)
// - After each answer: correct → increase difficulty, wrong → decrease
// - Parameters: questions (array with difficulty field)
// - Returns: { currentQuestion, answerQuestion, score, isFinished }

export const useAdaptive = (questions) => {
  // TODO: useState for currentIndex, difficultyLevel, score, answers

  return {
    currentQuestion: questions?.[0] || null,
    answerQuestion: (answerId) => {},
    score: 0,
    isFinished: false,
  };
};

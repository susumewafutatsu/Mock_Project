// src/utils/helpers.js
// Utility helper functions

/**
 * Format seconds to MM:SS string
 * @param {number} seconds
 * @returns {string} e.g. "05:30"
 */
export const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * Get letter grade from numeric score (0-10 scale)
 * @param {number} score
 * @returns {string} 'A', 'B', 'C', 'D', 'F'
 */
export const getGrade = (score) => {
  if (score >= 9) return 'A';
  if (score >= 7) return 'B';
  if (score >= 5) return 'C';
  if (score >= 3) return 'D';
  return 'F';
};

/**
 * Truncate long text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 */
export const truncate = (text, maxLength = 100) =>
  text?.length > maxLength ? text.slice(0, maxLength) + '...' : text;

// src/hooks/useExamTimer.js
// TODO: Implement countdown timer for exam session
// - Parameters: durationInSeconds (number)
// - Returns: { timeLeft, isExpired, formattedTime }
// - Auto-submit when timer reaches 0 (call onExpire callback)
// - Pause/resume support

export const useExamTimer = (durationInSeconds, onExpire) => {
  // TODO: useState for timeLeft
  // TODO: useEffect with setInterval for countdown
  // TODO: Clear interval on unmount

  return {
    timeLeft: durationInSeconds,
    isExpired: false,
    formattedTime: '00:00',
  };
};

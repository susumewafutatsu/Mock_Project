// src/components/exam/ExamTimer.jsx
// TODO: Countdown timer display for exam room
// Props: durationSeconds (number), onExpire (fn)
// - Show MM:SS format, change color to red when < 5 minutes
// - Use useExamTimer hook

import { useExamTimer } from '../../hooks/useExamTimer';

const ExamTimer = ({ durationSeconds, onExpire }) => {
  const { formattedTime, isExpired } = useExamTimer(durationSeconds, onExpire);

  return (
    <div className={`exam-timer ${isExpired ? 'expired' : ''}`}>
      ⏱ {formattedTime}
    </div>
  );
};

export default ExamTimer;

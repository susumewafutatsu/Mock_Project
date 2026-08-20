// src/pages/student/ExamRoom.jsx
// TODO: Main exam-taking page
// - Display one question at a time with answer choices
// - Question navigator (sidebar showing answered/unanswered)
// - Countdown timer (useExamTimer hook)
// - Adaptive logic: next question difficulty based on last answer (useAdaptive)
// - Auto-submit on time expiry
// - Prevent tab switching / copy-paste (optional)

const ExamRoom = () => {
  // TODO: useParams for examId
  // TODO: useEffect → fetch exam questions via examService.startExam()
  // TODO: useExamTimer(exam.duration * 60, handleAutoSubmit)
  // TODO: useAdaptive(questions) for adaptive mode
  // TODO: handleSubmit → examService.submitExam()

  return (
    <div>
      <h1>Phòng thi</h1>
      {/* TODO: Build full exam room UI with timer and question display */}
    </div>
  );
};

export default ExamRoom;

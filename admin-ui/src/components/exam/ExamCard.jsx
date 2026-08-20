// src/components/exam/ExamCard.jsx
// TODO: Card to display exam info in list view
// Props: exam (object), onStart (fn), onViewResult (fn)
// Shows: title, subject, duration, scheduled time, status badge

const ExamCard = ({ exam, onStart, onViewResult }) => {
  return (
    <div className="exam-card">
      <h3>{exam?.title}</h3>
      {/* TODO: Build exam card content */}
    </div>
  );
};

export default ExamCard;

// src/components/analytics/WeakStudentAlert.jsx
// TODO: Alert/badge component listing students at risk (below passing threshold)
// Props: students (array of UserResponse), threshold (number, default 5.0)

const WeakStudentAlert = ({ students = [], threshold = 5.0 }) => {
  if (students.length === 0) return null;

  return (
    <div className="weak-student-alert">
      <h4>⚠️ Thí sinh có nguy cơ ({students.length})</h4>
      {/* TODO: Render student list with score */}
    </div>
  );
};

export default WeakStudentAlert;

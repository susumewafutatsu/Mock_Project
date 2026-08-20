// src/components/question/QuestionCard.jsx
// TODO: Display a single question with its answer choices
// Props: question (object), onAnswer (fn), selectedAnswer (id), showCorrect (bool)

const QuestionCard = ({ question, onAnswer, selectedAnswer, showCorrect }) => {
  // TODO: Render question content and answer options
  // TODO: Highlight selected answer, optionally show correct answer

  return (
    <div className="question-card">
      <p>{question?.content}</p>
      {/* TODO: Render answer options */}
    </div>
  );
};

export default QuestionCard;

// src/components/analytics/ScoreChart.jsx
// TODO: Score distribution bar chart or line chart
// Props: data (array of { label, score }), type ('bar' | 'line')
// Recommended library: recharts or chart.js

const ScoreChart = ({ data, type = 'bar' }) => {
  // TODO: Install recharts: npm install recharts
  // TODO: Render BarChart or LineChart from recharts

  return (
    <div className="score-chart">
      {/* TODO: Chart goes here */}
      <p>Biểu đồ điểm số (cần cài recharts)</p>
    </div>
  );
};

export default ScoreChart;

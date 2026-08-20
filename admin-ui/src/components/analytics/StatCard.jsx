// src/components/analytics/StatCard.jsx
// TODO: Simple stat card showing a metric with label and icon
// Props: label (string), value (string|number), icon (ReactNode), color (string)

const StatCard = ({ label, value, icon, color = '#4A90D9' }) => {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
};

export default StatCard;

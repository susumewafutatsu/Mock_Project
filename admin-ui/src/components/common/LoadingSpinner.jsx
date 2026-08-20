// src/components/common/LoadingSpinner.jsx
// TODO: Full-page or inline loading spinner component
// Props: fullPage (bool), size (sm | md | lg)

const LoadingSpinner = ({ fullPage = false, size = 'md' }) => {
  // TODO: Implement spinner with CSS animation

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      Đang tải...
    </div>
  );
};

export default LoadingSpinner;

// src/components/common/HomeRedirect.jsx
// Điều hướng cho đường dẫn gốc "/" và mọi URL không khớp route nào.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { HOME_BY_ROLE, ROUTES } from '../../utils/constants';

const HomeRedirect = () => {
  const { currentUser, isLoading } = useAuth();

  // Chờ AuthContext phục hồi session từ localStorage.
  if (isLoading) return <div>Đang tải...</div>;

  const target =
    (currentUser && HOME_BY_ROLE[currentUser.role]) || ROUTES.STUDENT_EXAMS;

  return <Navigate to={target} replace />;
};

export default HomeRedirect;

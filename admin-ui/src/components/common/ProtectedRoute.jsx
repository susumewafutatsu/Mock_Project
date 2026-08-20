// src/components/common/ProtectedRoute.jsx
// TODO: Wrap routes that require authentication + specific role
// - If not logged in → redirect to /login
// - If logged in but wrong role → show 403 page
// Props: allowedRoles (array of ROLES constants)

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) return <div>Đang tải...</div>;
  if (!currentUser) return <Navigate to={ROUTES.LOGIN} replace />;
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <div>403 - Không có quyền truy cập</div>;
  }

  return children;
};

export default ProtectedRoute;

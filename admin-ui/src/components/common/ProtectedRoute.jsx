// src/components/common/ProtectedRoute.jsx
// TODO: Wrap routes that require authentication + specific role - If not logged in → redirect to /login - If logged in but wrong role → show 403 page Props: allowedRoles (array of ROLES constants)

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';

/** Khoá sessionStorage giữ trang cần quay lại sau khi đăng nhập (vd link mời vào phòng). */
export const RETURN_TO_KEY = 'returnTo';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div>Đang tải...</div>;
  if (!currentUser) {
    try {
      sessionStorage.setItem(RETURN_TO_KEY, location.pathname + location.search);
    } catch { /* bỏ qua khi không có storage */ }
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <div>403 - Không có quyền truy cập</div>;
  }

  return children;
};

export default ProtectedRoute;

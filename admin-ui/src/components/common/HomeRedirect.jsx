// src/components/common/HomeRedirect.jsx
// Điều hướng cho đường dẫn gốc "/" và mọi URL không khớp route nào.
//
// Chưa đăng nhập  → đẩy về trang thí sinh; ProtectedRoute ở đó thấy chưa có
//                   session nên tự chuyển tiếp sang /login. Nhờ vậy chỉ có một
//                   chỗ duy nhất quyết định "khi nào cần đăng nhập".
// Đã đăng nhập    → về đúng trang chủ của vai trò, tránh việc người ra đề mở "/"
//                   lại rơi vào trang thí sinh rồi nhận màn hình 403.
//
// LƯU Ý khi thêm vai trò mới vào HOME_BY_ROLE: đích đến bắt buộc phải có route
// thật trong main.jsx. Nếu không, URL đó không khớp route nào nên lại rơi vào
// chính component này → chuyển hướng vòng tròn vô tận.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { HOME_BY_ROLE, ROUTES } from '../../utils/constants';

const HomeRedirect = () => {
  const { currentUser, isLoading } = useAuth();

  // Chờ AuthContext phục hồi session từ localStorage. Không có nhánh này thì
  // lần F5 đầu tiên currentUser còn null và người đã đăng nhập bị đá về login.
  if (isLoading) return <div>Đang tải...</div>;

  const target =
    (currentUser && HOME_BY_ROLE[currentUser.role]) || ROUTES.STUDENT_EXAMS;

  return <Navigate to={target} replace />;
};

export default HomeRedirect;

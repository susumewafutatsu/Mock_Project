import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/common/ProtectedRoute.jsx'
import HomeRedirect from './components/common/HomeRedirect.jsx'
import { ROLES } from './utils/constants.js'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import CallbackPage from './pages/auth/CallbackPage.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import TeacherDashboard from './pages/teacher/ExamManager.jsx'
import StudentDashboard from './pages/student/ExamList.jsx'
import ExamRoom from './pages/student/ExamRoom.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Backend redirect về đây kèm ?accessToken=...&refreshToken=... sau khi Google SSO thành công */}
          <Route path="/auth/callback" element={<CallbackPage />} />
          
          {/* Admin routes — màn hình còn là khung rỗng, nhưng phải có route thật:
              HOME_BY_ROLE trỏ ADMIN về đây, thiếu route thì URL rơi vào
              HomeRedirect và chuyển hướng vòng tròn vô tận. */}
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Teacher routes */}
          <Route path="/teacher/*" element={
            <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
              <TeacherDashboard />
            </ProtectedRoute>
          } />

          {/* Student routes */}
          <Route path="/student/exams/:examId/room" element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <ExamRoom />
            </ProtectedRoute>
          } />
          <Route path="/student/*" element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <StudentDashboard />
            </ProtectedRoute>
          } />

          {/* Trang gốc + mọi URL lạ: đẩy về trang chủ theo vai trò, chưa đăng nhập thì về /login */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)


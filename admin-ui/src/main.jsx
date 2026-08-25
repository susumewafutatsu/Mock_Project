import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import CallbackPage from './pages/auth/CallbackPage.jsx'
import TeacherDashboard from './pages/teacher/ExamManager.jsx'
import StudentDashboard from './pages/student/ExamList.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Backend redirect về đây kèm ?accessToken=...&refreshToken=... sau khi Google SSO thành công */}
          <Route path="/auth/callback" element={<CallbackPage />} />
          {/* Teacher routes */}
          <Route path="/teacher/*" element={<TeacherDashboard />} />
          {/* Student routes */}
          <Route path="/student/*" element={<StudentDashboard />} />
          {/* Render App for all other routes for now */}
          <Route path="/*" element={<App />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

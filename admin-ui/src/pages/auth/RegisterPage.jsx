// src/pages/auth/RegisterPage.jsx
// Đăng ký tài khoản học viên.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, UserPlus, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { register } from '../../services/authService';
import './Login.css';

const MIN_PASSWORD = 6;

const RegisterPage = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setIsLoading(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password });
      // Sang thẳng trang đăng nhập kèm lời nhắn, thay vì tự đăng nhập hộ.
      navigate('/login', {
        replace: true,
        state: { notice: 'Đã tạo tài khoản. Đăng nhập để bắt đầu ôn thi.' },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Đăng ký</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#6B7280' }}>
            Tài khoản mới là tài khoản học viên. Muốn soạn đề thì nhờ quản trị viên
            nâng quyền giúp.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="input-group">
            <input
              type="text"
              className="login-input"
              placeholder="Họ và tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <User className="input-icon" size={20} />
          </div>

          <div className="input-group">
            <input
              type="email"
              className="login-input"
              placeholder="Email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Mail className="input-icon" size={20} />
          </div>

          <div className="input-group">
            <input
              type="password"
              className="login-input"
              placeholder={`Mật khẩu (ít nhất ${MIN_PASSWORD} ký tự)`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={MIN_PASSWORD}
              required
            />
            <Lock className="input-icon" size={20} />
          </div>

          <div className="input-group">
            <input
              type="password"
              className="login-input"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Lock className="input-icon" size={20} />
          </div>

          <button type="submit" className="login-btn" disabled={isLoading} style={{ marginTop: '12px' }}>
            {isLoading ? 'Đang xử lý...' : (
              <>
                <UserPlus size={20} />
                Đăng ký tài khoản
              </>
            )}
          </button>
        </form>

        <div className="divider">Hoặc</div>

        <button type="button" className="google-btn" onClick={() => loginWithGoogle()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Đăng ký với Google
        </button>

        <div className="register-prompt">
          Đã có tài khoản?
          <a href="#" className="register-link" onClick={(e) => {
            e.preventDefault();
            navigate('/login');
          }}>Đăng nhập</a>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

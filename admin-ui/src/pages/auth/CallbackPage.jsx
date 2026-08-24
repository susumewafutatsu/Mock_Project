// src/pages/auth/CallbackPage.jsx
// Nhận token từ backend sau khi Google xác thực xong, rồi điều hướng theo role.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { HOME_BY_ROLE, ROUTES } from '../../utils/constants';
import './Login.css';

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return; // StrictMode gọi effect 2 lần
    handled.current = true;

    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(oauthError);
      return;
    }

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    if (!accessToken) {
      setError('Không nhận được token từ máy chủ.');
      return;
    }

    loginWithTokens({ accessToken, refreshToken })
      .then((user) => {
        navigate(HOME_BY_ROLE[user.role] || '/', { replace: true });
      })
      .catch((e) => setError(e.message));
  }, [searchParams, loginWithTokens, navigate]);

  return (
    <div className="login-container">
      <div className="login-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div className="login-error">Đăng nhập Google thất bại: {error}</div>
            <button
              type="button"
              className="login-btn"
              onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            >
              Về trang đăng nhập
            </button>
          </>
        ) : (
          <p style={{ color: '#9ca3af' }}>Đang xử lý đăng nhập...</p>
        )}
      </div>
    </div>
  );
};

export default CallbackPage;

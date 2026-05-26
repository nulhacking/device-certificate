import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, isAuthenticated, saveSession } from '../services/api';
import { authenticateDeviceCredential, isWebAuthnSupported } from '../services/WebAuthnService';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [webauthnStep, setWebauthnStep] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(username.trim(), password);

      if (!result.requiresWebAuthn) {
        saveSession(result.accessToken, result.user);
        navigate(result.user.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }

      if (!isWebAuthnSupported()) {
        setError('Bu brauzer WebAuthn (Windows Hello) ni qo\'llab-quvvatlamaydi');
        return;
      }

      setWebauthnStep(true);

      const { options, challengeId, pendingToken } = await api.webauthnOptions(result.pendingToken);
      const credential = await authenticateDeviceCredential(options);
      const verified = await api.webauthnVerify(pendingToken, challengeId, credential);

      saveSession(verified.accessToken, verified.user);
      navigate(verified.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const apiErr = err as ApiError & { status?: number; name?: string };
      if (apiErr.name === 'NotAllowedError') {
        setError('Windows Hello / PIN tasdiqlanmadi yoki bekor qilindi');
      } else {
        setError(apiErr.message ?? 'Login xatoligi yuz berdi');
      }
    } finally {
      setLoading(false);
      setWebauthnStep(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>Tizimga kirish</h1>
        <p>
          Login va parol bilan kiring. Cheklangan foydalanuvchilar qo&apos;shimcha ravishda{' '}
          <strong>Windows Hello / PIN</strong> orqali laptopni tasdiqlaydi.
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Login</label>
            <input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Parol</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading
              ? webauthnStep
                ? 'Windows Hello kutilmoqda...'
                : 'Kutilmoqda...'
              : 'Kirish'}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 13, color: '#9ca3af' }}>
          Demo: admin / admin123 yoki user1 / user123 (laptop bog&apos;langan bo&apos;lishi kerak)
        </p>
      </div>
    </div>
  );
}

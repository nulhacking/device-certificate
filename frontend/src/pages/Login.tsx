import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, isAuthenticated, saveSession } from '../services/api';
import {
  authenticateDeviceCredential,
  getBiometricDescription,
  getBiometricLabel,
  isWebAuthnSupported,
  registerDeviceCredential
} from '../services/WebAuthnService';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [webauthnStep, setWebauthnStep] = useState(false);
  const [registerNewDevice, setRegisterNewDevice] = useState(false);
  const biometricLabel = getBiometricLabel();

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await api.login(username.trim(), password);

      if (!result.requiresWebAuthn && !result.requiresDeviceRegistration) {
        saveSession(result.accessToken, result.user);
        navigate(result.user.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }

      if (!isWebAuthnSupported()) {
        setError(`Bu brauzer WebAuthn (${biometricLabel}) ni qo'llab-quvvatlamaydi`);
        return;
      }

      setWebauthnStep(true);

      if (result.requiresDeviceRegistration || (result.requiresWebAuthn && registerNewDevice)) {
        const { options, challengeId, pendingToken } = await api.loginRegisterOptions(
          result.pendingToken,
          'Laptop'
        );
        const credential = await registerDeviceCredential(options);
        const registered = await api.loginRegisterVerify(pendingToken, challengeId, credential, 'Laptop');
        setSuccess(registered.message);
        return;
      }

      if (result.requiresWebAuthn) {
        const { options, challengeId, pendingToken } = await api.webauthnOptions(result.pendingToken);
        const credential = await authenticateDeviceCredential(options);
        const verified = await api.webauthnVerify(pendingToken, challengeId, credential);

        saveSession(verified.accessToken, verified.user);
        navigate(verified.user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      const apiErr = err as ApiError & { status?: number; name?: string };
      if (apiErr.name === 'NotAllowedError') {
        setError(`${biometricLabel} tasdiqlanmadi yoki bekor qilindi`);
      } else if (apiErr.error === 'DEVICE_PENDING_APPROVAL') {
        setSuccess(apiErr.message);
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
          <strong>{biometricLabel}</strong> orqali laptopni tasdiqlaydi. Yangi qurilma admin
          tasdiqlashini kutadi.
        </p>
        <p style={{ fontSize: 13, color: '#6b7280' }}>{getBiometricDescription()}</p>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}

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
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={registerNewDevice}
                onChange={e => setRegisterNewDevice(e.target.checked)}
                style={{ marginRight: 8 }}
                disabled={loading}
              />
              Bu yangi laptop (admin tasdiqlashi kerak)
            </label>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading
              ? webauthnStep
                ? `${biometricLabel} kutilmoqda...`
                : 'Kutilmoqda...'
              : 'Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}

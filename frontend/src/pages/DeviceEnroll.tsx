import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import {
  getBiometricDescription,
  getBiometricLabel,
  isWebAuthnSupported,
  registerDeviceCredential
} from '../services/WebAuthnService';

export default function DeviceEnroll() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<Array<{ id: number; username: string; deviceRestricted: boolean }>>([]);
  const [userId, setUserId] = useState(searchParams.get('userId') ?? '');
  const [deviceName, setDeviceName] = useState('Laptop');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const biometricLabel = getBiometricLabel();

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => setError('Userlar yuklanmadi'));
  }, []);

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!isWebAuthnSupported()) {
      setError(`Bu brauzer WebAuthn (${biometricLabel}) ni qo'llab-quvvatlamaydi`);
      return;
    }

    setLoading(true);

    try {
      const { options, challengeId } = await api.registerOptions(Number(userId), deviceName.trim());
      const credential = await registerDeviceCredential(options);
      const result = await api.registerVerify(Number(userId), challengeId, credential, deviceName.trim());

      setMessage(
        `Laptop muvaffaqiyatli bog'landi: ${result.deviceName} (${result.deviceType ?? 'platform'}) — admin tasdiqlashisiz darhol ishlaydi`
      );
    } catch (err) {
      const apiErr = err as ApiError & { name?: string };
      if (apiErr.name === 'NotAllowedError') {
        setError(`${biometricLabel} tasdiqlanmadi yoki bekor qilindi`);
      } else {
        setError(apiErr.message ?? 'Bog\'lash xatoligi');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Laptop bog&apos;lash (WebAuthn)</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Admin berilgan laptopda ushbu sahifani ochadi. {biometricLabel} orqali qurilma kaliti
        yaratiladi — Mac da Touch ID, Windows da Windows Hello.
      </p>
      <p style={{ fontSize: 13, color: '#6b7280' }}>{getBiometricDescription()}</p>

      <div className="success-box" style={{ marginBottom: 24 }}>
        <strong>Admin bog&apos;lash:</strong> bu usul qurilmani darhol tasdiqlangan holatda qo&apos;shadi.
        User o&apos;zi login qilganda esa admin tasdiqlashi kerak bo&apos;ladi.
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <form onSubmit={handleEnroll}>
        <div className="form-group">
          <label htmlFor="userId">Foydalanuvchi</label>
          <select id="userId" value={userId} onChange={e => setUserId(e.target.value)} required disabled={loading}>
            <option value="">Tanlang...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.username} {u.deviceRestricted ? '(cheklangan)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="deviceName">Laptop nomi</label>
          <input
            id="deviceName"
            value={deviceName}
            onChange={e => setDeviceName(e.target.value)}
            placeholder="Masalan: Ofis MacBook #3"
            required
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || !userId}>
          {loading ? `${biometricLabel} kutilmoqda...` : `${biometricLabel} bilan bog'lash`}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../services/api';

export default function Dashboard() {
  const user = getStoredUser();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .dashboard()
      .then(res => setMessage(res.message))
      .catch(err => setError(err.message ?? 'Xatolik'));
  }, []);

  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p>
        Salom, <strong>{user?.username}</strong>!
      </p>
      <p>
        Device cheklovi:{' '}
        {user?.deviceRestricted ? (
          <span className="badge badge-restricted">Faol — faqat bog&apos;langan laptop (WebAuthn)</span>
        ) : (
          <span className="badge badge-open">Yo&apos;q — istalgan qurilma</span>
        )}
      </p>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}
    </div>
  );
}

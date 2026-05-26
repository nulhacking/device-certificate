import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, UserInfo } from '../services/api';

type DeviceItem = {
  id: number;
  credentialId: string;
  deviceName: string;
  deviceType: string | null;
  createdAt: string;
};

export default function AdminPanel() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDeviceRestricted, setNewDeviceRestricted] = useState(true);
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'Userlar yuklanmadi');
    }
  }, []);

  const loadDevices = useCallback(async (userId: number) => {
    try {
      const data = await api.getUserDevices(userId);
      setDevices(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'Qurilmalar yuklanmadi');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (selectedUserId) {
      loadDevices(selectedUserId);
    } else {
      setDevices([]);
    }
  }, [selectedUserId, loadDevices]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        deviceRestricted: newDeviceRestricted,
        role: newRole
      });
      setSuccess(`Foydalanuvchi "${newUsername}" yaratildi`);
      setNewUsername('');
      setNewPassword('');
      await loadUsers();
    } catch (err) {
      setError((err as ApiError).message ?? 'Yaratish xatoligi');
    }
  }

  async function handleToggleRestricted(user: UserInfo) {
    setError('');
    setSuccess('');

    try {
      await api.toggleDeviceRestricted(user.id, !user.deviceRestricted);
      setSuccess(`${user.username} uchun device cheklovi ${user.deviceRestricted ? 'o\'chirildi' : 'yoqildi'}`);
      await loadUsers();
    } catch (err) {
      setError((err as ApiError).message ?? 'Yangilash xatoligi');
    }
  }

  async function handleRemoveDevice(deviceId: number) {
    setError('');
    setSuccess('');

    try {
      await api.removeDevice(deviceId);
      setSuccess('Laptop olib tashlandi');
      if (selectedUserId) await loadDevices(selectedUserId);
    } catch (err) {
      setError((err as ApiError).message ?? 'O\'chirish xatoligi');
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div>
      <h1>Admin panel</h1>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Yangi foydalanuvchi</h2>
        <form onSubmit={handleCreateUser}>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="newUsername">Login</label>
              <input
                id="newUsername"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">Parol</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={4}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="newRole">Rol</label>
              <select id="newRole" value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={newDeviceRestricted}
                  onChange={e => setNewDeviceRestricted(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Faqat ruxsat etilgan laptopdan kirish (WebAuthn)
              </label>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Yaratish
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Foydalanuvchilar</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Login</th>
              <th>Rol</th>
              <th>Device cheklovi</th>
              <th>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>
                  {u.role === 'admin' ? (
                    <span className="badge badge-admin">Admin</span>
                  ) : (
                    'User'
                  )}
                </td>
                <td>
                  {u.deviceRestricted ? (
                    <span className="badge badge-restricted">Cheklangan</span>
                  ) : (
                    <span className="badge badge-open">Ochiq</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginRight: 8, padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    Laptoplar
                  </button>
                  <Link
                    to={`/enroll?userId=${u.id}`}
                    className="btn btn-secondary"
                    style={{ marginRight: 8, padding: '6px 12px', fontSize: 12, display: 'inline-flex' }}
                  >
                    Bog&apos;lash
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => handleToggleRestricted(u)}
                  >
                    {u.deviceRestricted ? 'Cheklovni o\'chirish' : 'Cheklov qo\'shish'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>
            {selectedUser.username} — bog&apos;langan laptoplar (WebAuthn)
          </h2>

          {devices.length === 0 ? (
            <p style={{ color: '#6b7280' }}>
              Hali laptop bog&apos;lanmagan.{' '}
              <Link to={`/enroll?userId=${selectedUser.id}`}>Windows Hello bilan bog&apos;lash</Link>
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nomi</th>
                  <th>Turi</th>
                  <th>Credential ID</th>
                  <th>Sana</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.id}>
                    <td>{d.deviceName}</td>
                    <td>{d.deviceType ?? 'platform'}</td>
                    <td className="mono">{d.credentialId.slice(0, 24)}...</td>
                    <td>{new Date(d.createdAt).toLocaleString('uz-UZ')}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleRemoveDevice(d.id)}
                      >
                        Olib tashlash
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

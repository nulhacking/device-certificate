import { Link, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getStoredUser } from '../services/api';

export default function Layout() {
  const user = getStoredUser();
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">Device Login</span>
        <Link to="/dashboard">Dashboard</Link>
        {user?.role === 'admin' && (
          <>
            <Link to="/admin">Admin</Link>
            <Link to="/enroll">Laptop bog'lash</Link>
          </>
        )}
        <span className="nav-spacer" />
        <span style={{ fontSize: 14, color: '#6b7280' }}>{user?.username}</span>
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>
          Chiqish
        </button>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}

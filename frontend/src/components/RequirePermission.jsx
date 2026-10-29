import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RequirePermission({ permission, anyOf, children }) {
  const { token, user, hasPermission, hasAnyPermission } = useAuth();

  if (!token) {
    return <Navigate to="/conta" replace />;
  }

  if (!user) {
    return <main className="access-pending" aria-live="polite">Verificando acesso...</main>;
  }

  const allowed = permission ? hasPermission(permission) : hasAnyPermission(anyOf || []);

  return allowed ? children : <Navigate to="/" replace />;
}

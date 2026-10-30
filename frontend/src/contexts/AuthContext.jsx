import { createContext, useContext, useMemo, useState } from 'react';
import { validateAuthForm, validateProfileForm } from '../utils/formValidation';

const AuthContext = createContext(null);
const initialAuthForm = { nome: '', email: '', senha: '' };
const initialProfileForm = { nome: '', email: '', endereco: '' };

function readCsrfCookie() {
  return document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith('ecommerce_csrf='))?.split('=').slice(1).join('=') || null;
}

async function parseResponse(response) {
  let data = {};
  if (typeof response.text === 'function') {
    const text = await response.text();
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: `Resposta inválida do servidor (${response.status}).` }; }
  } else if (typeof response.json === 'function') {
    data = await response.json();
  }
  if (!response.ok) {
    throw new Error(data.errors?.join(' ') || data.error || 'Não foi possível concluir a ação.');
  }
  return data;
}

export function AuthProvider({ children }) {
  const initialResetToken = new URLSearchParams(window.location.search).get('reset_token') || '';
  const [mode, setMode] = useState(initialResetToken ? 'reset' : 'login');
  const [authForm, setAuthForm] = useState(initialAuthForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [token, setToken] = useState(() => readCsrfCookie());
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('Explore os produtos cadastrados na loja.');
  const [loading, setLoading] = useState(false);

  async function fetchProfile(currentToken = token) {
    if (!currentToken) return;

    setLoading(true);
    try {
      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await parseResponse(response);
      setUser(data.user);
      setProfileForm({
        nome: data.user.nome || '',
        email: data.user.email || '',
        endereco: data.user.endereco || '',
      });
      setStatus('Perfil carregado.');
    } catch (error) {
      setToken(null);
      setUser(null);
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    const isRegister = mode === 'register';
    const validationError = validateAuthForm(authForm, isRegister);
    if (validationError) {
      setStatus(validationError);
      return;
    }
    setLoading(true);
    setStatus(isRegister ? 'Criando sua conta...' : 'Validando acesso...');

    try {
      const response = await fetch(isRegister ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister ? authForm : { email: authForm.email, senha: authForm.senha }),
      });
      const data = await parseResponse(response);
      setToken(data.csrf_token || readCsrfCookie());
      setUser(data.user);
      setProfileForm({
        nome: data.user.nome || '',
        email: data.user.email || '',
        endereco: data.user.endereco || '',
      });
      setAuthForm(initialAuthForm);
      setStatus(isRegister ? 'Conta criada com sucesso.' : 'Login realizado com sucesso.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset(email) {
    setLoading(true); setStatus('Solicitando instruções...');
    try {
      const data = await parseResponse(await fetch('/api/password/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }));
      setStatus(data.message);
    } catch (error) { setStatus(error.message); } finally { setLoading(false); }
  }

  async function resetPassword(senha) {
    setLoading(true); setStatus('Redefinindo senha...');
    try {
      const data = await parseResponse(await fetch('/api/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: initialResetToken, senha }) }));
      window.history.replaceState({}, '', window.location.pathname);
      setMode('login'); setAuthForm(initialAuthForm); setStatus(data.message);
      return true;
    } catch (error) { setStatus(error.message); return false; } finally { setLoading(false); }
  }

  async function submitProfile(event) {
    event.preventDefault();
    const validationError = validateProfileForm(profileForm);
    if (validationError) {
      setStatus(validationError);
      return;
    }
    setLoading(true);
    setStatus('Salvando perfil...');

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await parseResponse(response);
      setUser(data.user);
      setStatus('Perfil atualizado com sucesso.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  function clearSession() {
    setToken(null);
    setUser(null);
    setProfileForm(initialProfileForm);
  }

  function hasPermission(permission) {
    return user?.permissions?.includes(permission) || false;
  }

  function hasAnyPermission(permissions) {
    return permissions.some(hasPermission);
  }
  const value = useMemo(() => ({
    mode, setMode, authForm, setAuthForm, profileForm, setProfileForm,
    token, user, status, setStatus, loading, setLoading,
    fetchProfile, store: user?.tenant || null, submitAuth, requestPasswordReset, resetPassword, submitProfile, clearSession, hasPermission, hasAnyPermission,
  }), [mode, authForm, profileForm, token, user, status, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}

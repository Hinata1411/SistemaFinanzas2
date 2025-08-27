// src/Login.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchUsersForSelect, loginAndGetBackendToken } from './authService';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import './Login.css';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/Finanzas';

  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem('remember_email'));

  // === Fallback: correos admin si el backend/JWT/lista no trae rol ===
  const ADMIN_EMAILS = [
    'auxiliar.vipizzal@gmail.com', // <-- agregado
    'admin@example.com'
  ];

  // Decode seguro para JWT base64url
  const decodeJwtPayload = (token) => {
    try {
      const base64Url = (token || '').split('.')[1] || '';
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(json);
    } catch { return {}; }
  };

  // Normaliza string
  const lower = (v) => (v ?? '').toString().trim().toLowerCase();

  // Resuelve 'admin' | 'viewer' desde: respuesta login -> JWT -> lista usuarios -> fallback por correo
  const resolveRole = (loginRes, selectedEmail, usersList) => {
    // 1) loginRes.role
    if (loginRes && typeof loginRes === 'object' && loginRes.role) {
      return lower(loginRes.role);
    }

    // 2) JWT
    const token = typeof loginRes === 'string' ? loginRes : loginRes?.token;
    if (token) {
      const p = decodeJwtPayload(token);
      const jwtRole = lower(p.role || p.rol || p['https://example.com/role']);
      if (jwtRole) return jwtRole;
      if (typeof p.isAdmin === 'boolean' || typeof p.admin === 'boolean') {
        return (p.isAdmin || p.admin) ? 'admin' : 'viewer';
      }
    }

    // 3) Lista de usuarios (por si fetchUsersForSelect trae el rol)
    if (Array.isArray(usersList) && usersList.length) {
      const u = usersList.find(x => lower(x.email) === lower(selectedEmail));
      if (u) {
        const fromUser =
          lower(u.role) ||
          lower(u.rol) ||
          lower(u.type) ||
          lower(u?.perfil?.nombre);
        if (fromUser === 'admin' || fromUser === 'viewer') return fromUser;
        if (typeof u.isAdmin === 'boolean') return u.isAdmin ? 'admin' : 'viewer';
      }
    }

    // 4) Fallback por correo
    if (ADMIN_EMAILS.map(lower).includes(lower(selectedEmail))) return 'admin';

    return 'viewer';
  };

  useEffect(() => {
    (async () => {
      setErr(''); setInfo('');
      try {
        const list = await fetchUsersForSelect();
        setUsers(list);
        const remembered = localStorage.getItem('remember_email');
        if (remembered && list.some(u => u.email === remembered)) setEmail(remembered);
        else if (list.length) setEmail(list[0].email);
      } catch {
        setErr('Error al cargar usuarios.');
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');
    if (!email || !pwd) return setErr('Completa todos los campos.');
    try {
      setBusy(true);

      if (remember) localStorage.setItem('remember_email', email);
      else localStorage.removeItem('remember_email');

      // Puede devolver { token, role, ... } o solo token string
      const loginRes = await loginAndGetBackendToken(email.trim(), pwd.trim());

      // Guarda token si viene (para PrivateRoute)
      let token = '';
      if (typeof loginRes === 'string') token = loginRes;
      else if (loginRes?.token) token = loginRes.token;
      if (token) localStorage.setItem('token', token);

      // Guarda email
      localStorage.setItem('email', email.trim());

      // Determina y guarda el rol (admin/viewer)
      const role = resolveRole(loginRes, email.trim(), users);
      localStorage.setItem('role', role);

      navigate(from, { replace: true });
    } catch (e) {
      const code = e?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErr('Credenciales inválidas. Verifica usuario y contraseña.');
      } else if (code === 'auth/too-many-requests') {
        setErr('Demasiados intentos fallidos. Intenta más tarde.');
      } else if (code === 'auth/network-request-failed') {
        setErr('Fallo de red. Revisa tu conexión.');
      } else {
        setErr(e?.message || 'Error en el login.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');
    if (!email) return setErr('Selecciona un usuario para recuperar.');
    try {
      setBusy(true);
      await sendPasswordResetEmail(auth, email);
      setInfo('Te enviamos un correo para restablecer tu contraseña.');
    } catch {
      setErr('No se pudo enviar el correo de recuperación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-frame">
        <aside className="hero">
          <div className="hero-inner">
            <div className="hero-badge">
              <img src="img/Logosinfondo.png" alt="Brand" className="brand-logo"/>
            </div>
            <div className="hero-brand">American Pizza By Vipizza</div>
            <h1 className="hero-title">Sistema<br/>Finanzas</h1>
            <p className="hero-sub"> </p>
          </div>
          <div className="hero-pattern" aria-hidden />
        </aside>

        {/* Tarjeta del formulario */}
        <main className="form-area">
          <div className="form-card shadow-sm">
            <h3 className="form-title">Iniciar sesión</h3>

            {err && <div className="alert alert-danger py-2 small mb-3">{err}</div>}
            {info && <div className="alert alert-success py-2 small mb-3">{info}</div>}

            <form onSubmit={onSubmit} noValidate>
              {/* Usuario */}
              <div className="mb-3">
                <label className="form-label" htmlFor="userSelect">Usuario</label>
                <div className="input-with-icon">
                  <span className="icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F3D2E" aria-hidden="true">
                      <path d="M12 12c2.76 0 5-2.69 5-6s-2.24-6-5-6-5 2.69-5 6 2.24 6 5 6Zm0 2c-4.42 0-8 3.13-8 7v1h16v-1c0-3.87-3.58-7-8-7Z"/>
                    </svg>
                  </span>
                  <select
                    id="userSelect"
                    className="form-select"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  >
                    {users.map((u, i) => (
                      <option key={i} value={u.email}>{u.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="mb-2">
                <label className="form-label" htmlFor="password">Contraseña</label>
                <div className="input-with-icon">
                  <span className="icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F3D2E" aria-hidden="true">
                      <path d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2Zm-8 0V7a3 3 0 0 1 6 0v2H9Zm3 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    className="form-control"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="toggle-pass"
                    onClick={() => setShowPwd(s => !s)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPwd ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F3D2E"><path d="M2 2l20 20-1.5 1.5L18 19.5c-1.8 1-3.8 1.5-6 1.5-5.5 0-10-3.5-12-9 1-2.7 2.7-4.9 4.8-6.5L.5 3.5 2 2Zm5.7 5.7C9.3 7 10.6 6.5 12 6.5c4.1 0 7.5 2.4 9.2 6-1 2.3-2.6 4-4.6 5.1l-2.3-2.3A4.5 4.5 0 0 0 9 9l-1.3-1.3Z"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F3D2E"><path d="M12 5c-5 0-9.3 3-11 7 1.7 4 6 7 11 7s9.3-3 11-7c-1.7-4-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="remember-row">
                <div className="form-check m-0">
                  <input
                    id="rememberMe"
                    className="form-check-input"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={busy}
                  />
                  <label className="form-check-label" htmlFor="rememberMe">Recordar contraseña</label>
                </div>
                {/* botón accesible en lugar de <a href="#"> */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={onForgot}
                  onKeyDown={(e) => e.key === 'Enter' && onForgot(e)}
                  className="forgot-link"
                >
                  ¿Olvidaste tu contraseña?
                </span>

              </div>

              {/* Botón */}
              <button className="btn btn-primary w-100" disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Ingresando…
                  </>
                ) : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

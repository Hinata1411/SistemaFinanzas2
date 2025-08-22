import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchUsersForSelect, loginAndGetBackendToken } from './authService';
import { sendPasswordResetEmail, auth } from '../firebase';
import './Login.css';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/home';

  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem('remember_email'));

  // Fallback simple: correos que serán admin si el backend no manda rol
  const ADMIN_EMAILS = [
    // <-- agrega tus correos admin aquí
    'admin@example.com'
  ];

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

  // Extrae rol desde el resultado o desde un JWT (si viene)
  const extractRole = (loginRes, selectedEmail) => {
    try {
      if (loginRes && typeof loginRes === 'object') {
        if (loginRes.role) return String(loginRes.role).toLowerCase();
        if (loginRes.token && typeof loginRes.token === 'string') {
          const payload = JSON.parse(atob(loginRes.token.split('.')[1] || ''));
          return String(
            payload.role || payload.rol || payload['https://example.com/role'] || ''
          ).toLowerCase();
        }
      }
      if (typeof loginRes === 'string') {
        const payload = JSON.parse(atob(loginRes.split('.')[1] || ''));
        return String(payload.role || payload.rol || '').toLowerCase();
      }
    } catch (_) { /* noop */ }

    // Fallback por correo si no vino rol
    if (selectedEmail && ADMIN_EMAILS.includes(selectedEmail.toLowerCase())) return 'admin';
    return 'viewer';
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');
    if (!email || !pwd) return setErr('Completa todos los campos.');
    try {
      setBusy(true);

      if (remember) localStorage.setItem('remember_email', email);
      else localStorage.removeItem('remember_email');

      // Puede devolver { token, role } o un token string.
      const loginRes = await loginAndGetBackendToken(email.trim(), pwd.trim());

      // Guarda email (útil para el header/sidebar)
      localStorage.setItem('email', email.trim());

      // Determina y guarda el rol
      const role = extractRole(loginRes, email.trim());
      localStorage.setItem('role', role); // 'admin' o 'viewer'

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
              {/* fix: class -> className */}
              <img src="/Logosinfondo.png" alt="Brand" className="brand-logo"/> 
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
                <a href="#" className="small-link" onClick={onForgot}>¿Olvidaste tu contraseña?</a>
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

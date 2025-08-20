// src/auth/Login.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchUsersForSelect, loginAndGetBackendToken } from './authService';
import { sendPasswordResetEmail, auth } from '../firebase'; // ⬅️ Asegúrate que tu firebase exporte esto
import './Login.css';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/home';

  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');     // ✅ mensajes de éxito
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem('remember_email'));

  useEffect(() => {
    (async () => {
      setErr(''); setInfo('');
      try {
        const list = await fetchUsersForSelect();
        setUsers(list);

        const remembered = localStorage.getItem('remember_email');
        if (remembered && list.some(u => u.email === remembered)) {
          setEmail(remembered);
        } else if (list.length) {
          setEmail(list[0].email);
        }
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

      await loginAndGetBackendToken(email.trim(), pwd.trim()); // guarda token/email
      navigate(from, { replace: true }); // → /home
    } catch (e) {
      const code = e?.code;
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
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
    } catch (e) {
      setErr('No se pudo enviar el correo de recuperación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <div className="container" style={{ maxWidth: 450 }}>
        <div className="card shadow p-4">
          <h2 className="text-center mb-4">Iniciar Sesión</h2>

          {err && <div className="alert alert-danger py-2 small mb-3">{err}</div>}
          {info && <div className="alert alert-success py-2 small mb-3">{info}</div>}

          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label" htmlFor="userSelect">Seleccione Usuario:</label>
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

            <div className="mb-2">
              <label className="form-label" htmlFor="password">Contraseña:</label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoComplete="current-password"
                required
                disabled={busy}
              />
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="form-check m-0">
                <input
                  id="rememberMe"
                  className="form-check-input"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={busy}
                />
                <label className="form-check-label" htmlFor="rememberMe">Remember me</label>
              </div>

              <a href="#" className="link-primary small" onClick={onForgot}>
                Forgot password?
              </a>
            </div>

            <button className="btn btn-primary w-100" disabled={busy}>
              {busy ? 'Ingresando…' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

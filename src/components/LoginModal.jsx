import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './LoginModal.module.css';

const SENSORS = [
  { icon: null, name: '2 × HC-SR04',  desc: 'Ultrasónico fijo + móvil' },
  { icon: null, name: 'DHT22',        desc: 'Temp · Humedad batería'   },
  { icon: null, name: 'GY-50',        desc: 'Giroscopio 3 ejes'        },
  { icon: null, name: 'Servomotor',   desc: 'PWM 0 – 180°'            },
  { icon: null, name: '2 Motores DC', desc: 'Motor A + Motor B'        },
];

export default function LoginModal({ onClose, onLogin }) {
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [backendUrl,  setBackendUrl]  = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.ip && data.port) {
          setBackendUrl(`http://${data.ip}:${data.port}`);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Ingresa usuario y contraseña'); return; }
    try {
      setSubmitting(true);
      setError('');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      let data;
      try { data = await res.json(); }
      catch { throw new Error('El servidor no responde. Verifica que esté corriendo.'); }
      if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar sesión');
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Panel izquierdo: branding ── */}
        <div className={styles.brandPanel}>
          <div className={styles.brandTop}>
            <div className={styles.brandOrbit}>
              <div className={styles.brandOrbitRing} />
              <div className={styles.brandOrbitRing2} />
              <span className={styles.brandRobotIcon}>🤖</span>
            </div>
            <h1 className={styles.brandName}>DRAKO</h1>
            <p className={styles.brandTagline}>Sistema Autónomo de<br />Control IoT</p>
          </div>

          <div className={styles.brandSep} />

          <ul className={styles.sensorList}>
            {SENSORS.map((s) => (
              <li key={s.name} className={styles.sensorRow}>
                <div className={styles.sensorText}>
                  <span className={styles.sensorName}>{s.name}</span>
                  <span className={styles.sensorDesc}>{s.desc}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.brandFooter}>
            <span className={styles.brandDot} />
            <span className={styles.brandOnline}>
              SISTEMA EN LÍNEA {backendUrl ? `(${backendUrl})` : ''}
            </span>
          </div>
        </div>

        {/* ── Panel derecho: formulario ── */}
        <div className={styles.formPanel}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>

          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Iniciar Sesión</h2>
            <p className={styles.formSub}>Accede al panel de control</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>

            <div className={styles.field}>
              <label htmlFor="drako-user">Usuario</label>
              <input
                id="drako-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. admin_drako"
                autoComplete="username"
                spellCheck={false}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="drako-pass">Contraseña</label>
              <div className={styles.passWrap}>
                <input
                  id="drako-pass"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className={styles.errorBox}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting
                ? <><span className={styles.spinner} /> Validando…</>
                : 'Acceder al Sistema'}
            </button>
          </form>

          <p className={styles.formHint}>Robot Autónomo Drako · v2.0</p>
        </div>

      </div>
    </div>
  );
}

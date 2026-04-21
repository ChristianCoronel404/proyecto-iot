import { useEffect, useState } from 'react';
import {
  User, Lock, Shield, Mail, Key, Eye, EyeOff, Check, X, Save
} from 'lucide-react';
import styles from './Profile.module.css';

export default function Profile({ user, onUserUpdate }) {
  // Simulamos datos si no vienen por prop
  const currentUser = user || { username: 'admin_drako', role: 'Admin', email: 'admin@ucb.edu.bo' };

  const [formData, setFormData] = useState({
    username: currentUser.username,
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setFormData({
      username: currentUser.username,
      password: ''
    });
  }, [currentUser.username]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value.replace(/\s/g, '') });
  };

  // --- Lógica de Validación de Contraseña ---
  const pwd = formData.password;
  const isUpdatingPassword = pwd.length > 0;

  const validations = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };

  const strengthScore = Object.values(validations).filter(Boolean).length;
  const strengthPercentage = (strengthScore / 5) * 100;

  const getStrengthColor = () => {
    if (strengthScore <= 2) return '#ef4444';
    if (strengthScore <= 4) return '#f59e0b';
    return '#78ba49';
  };

  // El formulario es válido SI:
  // 1. El username tiene al menos 3 caracteres Y
  // 2. (NO está cambiando la pass OR la nueva pass cumple todo)
  const isFormValid =
    formData.username.trim().length >= 3 &&
    (!isUpdatingPassword || strengthScore === 5);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (!currentUser?.id) {
      setErrorMessage('No hay sesión activa para actualizar perfil');
      return;
    }

    try {
      setErrorMessage('');
      const response = await fetch(`/api/profile/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar el perfil');
      }

      if (typeof onUserUpdate === 'function') {
        onUserUpdate(data.user);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setFormData((prev) => ({ ...prev, password: '' }));
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo actualizar el perfil');
    }
  };

  return (
    <div className={styles.profileWrapper}>

      {/* Header del Layout */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Mi Cuenta</h2>
        <p className={styles.pageSubtitle}>Administra tu identidad y credenciales de acceso</p>
      </div>

      <div className={styles.profileContainer}>

        {/* Lado Izquierdo: Tarjeta de Identidad */}
        <div className={styles.identityCard}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>
              {formData.username.charAt(0).toUpperCase()}
            </div>
            <div className={styles.statusPing}></div>
          </div>

          <h2 className={styles.profileTitle}>@{formData.username}</h2>

          <div className={styles.roleBadgeWrapper}>
            <span className={`${styles.roleBadge} ${currentUser.role === 'Admin' ? styles.roleAdmin : styles.roleUser}`}>
              {currentUser.role === 'Admin' ? <Shield size={14} /> : <User size={14} />}
              {currentUser.role}
            </span>
          </div>

          <div className={styles.contactInfo}>
            <div className={styles.infoRow}>
              <Mail size={16} className={styles.infoIcon} />
              <span>{currentUser.email}</span>
            </div>
            <div className={styles.infoRow}>
              <Key size={16} className={styles.infoIcon} />
              <span>Último acceso: Hoy 14:32</span>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formulario de Edición */}
        <div className={styles.editSection}>
          <div className={styles.sectionHeader}>
            <h3>Actualizar Credenciales</h3>
            {saveSuccess && (
              <span className={styles.successBadge}>
                <Check size={14} /> Cambios guardados
              </span>
            )}
          </div>

          {errorMessage && <p style={{ color: '#ef4444', marginTop: 0 }}>{errorMessage}</p>}

          <form onSubmit={handleSubmit} className={styles.formContent}>

            <div className={styles.formGroup}>
              <label htmlFor="username">Identificador de Usuario</label>
              <div className={styles.inputWrapper}>
                <User size={18} className={styles.inputIcon} />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Nueva Contraseña Maestra</label>
              <p className={styles.inputHelp}>Déjalo en blanco si no deseas cambiarla.</p>

              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Medidor de Fuerza (Solo visible si empieza a escribir) */}
              {isUpdatingPassword && (
                <div className={styles.pwdStrengthContainer}>
                  <div className={styles.strengthBarBg}>
                    <div
                      className={styles.strengthBarFill}
                      style={{ width: `${strengthPercentage}%`, backgroundColor: getStrengthColor() }}
                    ></div>
                  </div>

                  <ul className={styles.validationList}>
                    <li className={validations.length ? styles.valid : styles.invalid}>
                      {validations.length ? <Check size={14} /> : <X size={14} />} Mínimo 8 caracteres
                    </li>
                    <li className={validations.upper ? styles.valid : styles.invalid}>
                      {validations.upper ? <Check size={14} /> : <X size={14} />} Una mayúscula
                    </li>
                    <li className={validations.lower ? styles.valid : styles.invalid}>
                      {validations.lower ? <Check size={14} /> : <X size={14} />} Una minúscula
                    </li>
                    <li className={validations.number ? styles.valid : styles.invalid}>
                      {validations.number ? <Check size={14} /> : <X size={14} />} Un número
                    </li>
                    <li className={validations.special ? styles.valid : styles.invalid}>
                      {validations.special ? <Check size={14} /> : <X size={14} />} Un carácter especial
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={!isFormValid}
              >
                <Save size={18} />
                <span>Aplicar Cambios</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
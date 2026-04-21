import { useEffect, useState } from 'react';
import {
  Search, UserPlus, Shield, User, Lock, Key,
  Eye, EyeOff, Check, X, Edit, Slash, Activity, Save
} from 'lucide-react';
import styles from './Admin.module.css';

export default function Admin() {
  const [users, setUsers] = useState([]);

  // Estados de Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Estados de Formularios y UI
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', rol: 'Usuario' });
  const [editUser, setEditUser] = useState({ id: null, username: '', rol: 'Usuario', activo: true });
  const [errorMessage, setErrorMessage] = useState('');

  const loadUsers = async () => {
    try {
      setErrorMessage('');
      const response = await fetch('/api/users');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron cargar usuarios');
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      setErrorMessage(error.message || 'No se pudieron cargar usuarios');
      setUsers([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // --- LÓGICA DE REGISTRO ---
  const pwd = newUser.password;
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

  const isFormValid = newUser.username.trim().length >= 3 && strengthScore === 5;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      setErrorMessage('');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          rol: newUser.rol,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear el usuario');
      }

      setUsers((prev) => [...prev, data.user]);
      setIsModalOpen(false);
      setNewUser({ username: '', password: '', rol: 'Usuario' });
      setShowPassword(false);
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo crear el usuario');
    }
  };

  // --- LÓGICA DE EDICIÓN ---
  const handleOpenEdit = (user) => {
    setEditUser({ ...user });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (editUser.username.trim().length < 3) return;

    try {
      setErrorMessage('');
      const response = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: editUser.username,
          rol: editUser.rol,
          activo: editUser.activo,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar el usuario');
      }

      setUsers(users.map(u => u.id === editUser.id ? data.user : u));
      setIsEditModalOpen(false);
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo actualizar el usuario');
    }
  };

  const toggleUserStatusFast = async (id) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return;
    }

    try {
      setErrorMessage('');
      const response = await fetch(`/api/users/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activo: !targetUser.activo,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar el estado');
      }

      setUsers(users.map(u => u.id === id ? data.user : u));
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo actualizar el estado');
    }
  };

  // Filtrado
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.rol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.adminContainer}>
      <div className={styles.headerSection}>
        <div>
          <h2 className={styles.pageTitle}>Gestión de Accesos</h2>
          <p className={styles.pageSubtitle}>Administración de usuarios del sistema Drako</p>
        </div>
      </div>

      {errorMessage && <p style={{ color: '#ef4444', marginTop: 0 }}>{errorMessage}</p>}

      <div className={styles.actionBar}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por usuario o rol..."
            className={styles.searchBox}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className={styles.newUserBtn} onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Nivel de Acceso</th>
              <th>Credencial</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td className={styles.cellId}>#{user.id.toString().padStart(3, '0')}</td>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatarPlaceholder}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <strong>{user.username}</strong>
                  </div>
                </td>
                <td>
                  <span className={`${styles.roleBadge} ${user.rol === 'Admin' ? styles.roleAdmin : styles.roleUser}`}>
                    {user.rol === 'Admin' ? <Shield size={14} /> : <User size={14} />}
                    {user.rol}
                  </span>
                </td>
                <td>
                  <div className={styles.hashCell}>
                    <Key size={14} />
                    <span>{user.password_hash}</span>
                  </div>
                </td>
                <td>
                  <span className={user.activo ? styles.statusActive : styles.statusInactive}>
                    <div className={styles.statusDot}></div>
                    {user.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className={styles.actionBtn}
                    title="Editar"
                    onClick={() => handleOpenEdit(user)}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${user.activo ? styles.actionBtnDanger : styles.actionBtnSuccess}`}
                    title={user.activo ? "Bloquear" : "Desbloquear"}
                    onClick={() => toggleUserStatusFast(user.id)}
                  >
                    {user.activo ? <Slash size={16} /> : <Check size={16} />}
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No se encontraron usuarios.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MODAL: NUEVO USUARIO ================= */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <div className={styles.modalIconWrapper}>
                  <Shield size={24} color="#78ba49" />
                </div>
                <div>
                  <h2>Alta de Usuario</h2>
                  <p>Registra una nueva credencial segura.</p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className={styles.formContent}>
              <div className={styles.formGroup}>
                <label>Identificador (Username)</label>
                <div className={styles.inputWrapper}>
                  <User size={18} className={styles.inputIcon} />
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value.replace(/\s/g, '') })}
                    placeholder="ej. carlos_ucb"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Rol de Sistema</label>
                <div className={styles.inputWrapper}>
                  <Shield size={18} className={styles.inputIcon} />
                  <select
                    value={newUser.rol}
                    onChange={e => setNewUser({ ...newUser, rol: e.target.value })}
                  >
                    <option value="Admin">Administrador Total</option>
                    <option value="Usuario">Usuario Estándar</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Contraseña Maestra</label>
                <div className={styles.inputWrapper}>
                  <Lock size={18} className={styles.inputIcon} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Ingresa la contraseña"
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {newUser.password.length > 0 && (
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
                        {validations.upper ? <Check size={14} /> : <X size={14} />} Una letra mayúscula
                      </li>
                      <li className={validations.lower ? styles.valid : styles.invalid}>
                        {validations.lower ? <Check size={14} /> : <X size={14} />} Una letra minúscula
                      </li>
                      <li className={validations.number ? styles.valid : styles.invalid}>
                        {validations.number ? <Check size={14} /> : <X size={14} />} Un número
                      </li>
                      <li className={validations.special ? styles.valid : styles.invalid}>
                        {validations.special ? <Check size={14} /> : <X size={14} />} Un carácter especial (!@#$%)
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className={styles.submitBtn} disabled={!isFormValid}>Registrar Credencial</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDITAR USUARIO ================= */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <div className={styles.modalIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                  <Edit size={24} color="#3b82f6" />
                </div>
                <div>
                  <h2>Editar Usuario</h2>
                  <p>Modificando: <strong>{editUser.username}</strong></p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsEditModalOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className={styles.formContent}>
              <div className={styles.formGroup}>
                <label>Identificador (Username)</label>
                <div className={styles.inputWrapper}>
                  <User size={18} className={styles.inputIcon} />
                  <input
                    type="text"
                    value={editUser.username}
                    onChange={e => setEditUser({ ...editUser, username: e.target.value.replace(/\s/g, '') })}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Rol de Sistema</label>
                <div className={styles.inputWrapper}>
                  <Shield size={18} className={styles.inputIcon} />
                  <select
                    value={editUser.rol}
                    onChange={e => setEditUser({ ...editUser, rol: e.target.value })}
                  >
                    <option value="Admin">Administrador Total</option>
                    <option value="Usuario">Usuario Estándar</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Estado de Cuenta</label>
                <div className={styles.inputWrapper}>
                  <Activity size={18} className={styles.inputIcon} />
                  <select
                    value={editUser.activo.toString()}
                    onChange={e => setEditUser({ ...editUser, activo: e.target.value === 'true' })}
                  >
                    <option value="true">ACTIVO (Acceso permitido)</option>
                    <option value="false">INACTIVO (Bloqueado)</option>
                  </select>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className={styles.submitBtn} style={{ background: '#3b82f6' }}>
                  <Save size={18} style={{ marginRight: '8px' }} /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
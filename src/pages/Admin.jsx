import { useState } from 'react';
import styles from './Admin.module.css';

export default function Admin() {
  const [users, setUsers] = useState([
    { id: 1, username: 'admin1', rol: 'Admin', password_hash: '******', activo: true },
    { id: 2, username: 'user_iot', rol: 'User', password_hash: '******', activo: true },
    { id: 3, username: 'operador_x', rol: 'Operador', password_hash: '******', activo: false },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password_hash: '', rol: 'User' });

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password_hash.trim()) return;

    const newId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
    setUsers([...users, { ...newUser, id: newId, activo: true }]);
    setIsModalOpen(false);
    setNewUser({ username: '', password_hash: '', rol: 'User' });
  };

  return (
    <div className={styles.adminContainer}>
      <div className={styles.actionBar}>
        <input 
          type="text" 
          placeholder="Buscar usuarios..." 
          className={styles.searchBox} 
        />
        <button className={styles.newUserBtn} onClick={() => setIsModalOpen(true)}>
          + Nuevo Usuario
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Rol</th>
              <th>Password Hash (Simulado)</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>#{user.id}</td>
                <td><strong>{user.username}</strong></td>
                <td>{user.rol}</td>
                <td><span style={{color: '#94a3b8'}}>{user.password_hash}</span></td>
                <td>
                  <span className={user.activo ? styles.statusActive : styles.statusInactive}>
                    {user.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td>
                  <button className={styles.actionBtn}>Editar</button>
                  <button className={styles.actionBtn}>Bloquear</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Usuario */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Registro de Nuevo Usuario</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className={styles.formGroup}>
                <label>Username</label>
                <input 
                  type="text" 
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  placeholder="ej. tecnico_zona1"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Contraseña</label>
                <input 
                  type="password" 
                  value={newUser.password_hash}
                  onChange={e => setNewUser({...newUser, password_hash: e.target.value})}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Rol</label>
                <select 
                  value={newUser.rol}
                  onChange={e => setNewUser({...newUser, rol: e.target.value})}
                >
                  <option value="Admin">Admin</option>
                  <option value="Operador">Operador</option>
                  <option value="User">User</option>
                </select>
              </div>
              <button type="submit" className={styles.submitBtn}>Crear Usuario</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

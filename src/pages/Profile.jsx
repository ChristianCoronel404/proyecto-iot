import { useState } from 'react';
import styles from './Profile.module.css';

export default function Profile({ user }) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password_hash: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Datos guardados exitosamente (simulado)');
  };

  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>👤</div>
        <h2 className={styles.profileTitle}>{user?.username || 'Usuario'}</h2>
        <span className={styles.profileRole}>{user?.role || 'Admin'}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="username">Nombre de Usuario (username)</label>
          <input 
            type="text" 
            id="username" 
            name="username"
            value={formData.username} 
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password_hash">Nueva Contraseña (password_hash)</label>
          <input 
            type="password" 
            id="password_hash" 
            name="password_hash"
            value={formData.password_hash} 
            onChange={handleChange}
            placeholder="Dejar en blanco para mantener actual"
          />
        </div>

        <button type="submit" className={styles.saveBtn}>Guardar Cambios</button>
      </form>
    </div>
  );
}

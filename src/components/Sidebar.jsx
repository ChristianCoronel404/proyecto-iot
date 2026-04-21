import styles from './Sidebar.module.css';

export default function Sidebar({ currentView, onViewChange, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'admin', label: 'Usuarios (Admin)', icon: '👥' },
    { id: 'profile', label: 'Mi Cuenta', icon: '⚙️' }
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>Drako</div>
      
      <nav className={styles.menu}>
        {menuItems.map(item => (
          <button 
            key={item.id}
            className={`${styles.menuItem} ${currentView === item.id ? styles.active : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <button className={styles.logoutBtn} onClick={onLogout}>
        🚪 Cerrar Sesión
      </button>
    </aside>
  );
}

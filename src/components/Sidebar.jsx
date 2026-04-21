import { LayoutDashboard, Users, Settings, LogOut, Cpu } from 'lucide-react';
import styles from './Sidebar.module.css';

export default function Sidebar({ currentView, onViewChange, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Control Center', icon: LayoutDashboard },
    { id: 'admin', label: 'Gestión de Accesos', icon: Users },
    { id: 'profile', label: 'Mi Cuenta', icon: Settings }
  ];

  return (
    <aside className={styles.sidebar}>

      {/* Brand & System Status */}
      <div className={styles.brandSection}>
        <div className={styles.brandTitle}>
          <Cpu size={28} className={styles.brandIcon} />
          <span>Drako</span>
        </div>
        <div className={styles.systemStatus}>
          <div className={styles.pingDot}></div>
          <span>SYS.ONLINE // UCB</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className={styles.menu}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              {/* Indicador lateral animado para el elemento activo */}
              <div className={styles.activeIndicator}></div>

              <div className={styles.iconWrapper}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={styles.menuLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout Action */}
      <div className={styles.footerSection}>
        <button className={styles.logoutBtn} onClick={onLogout}>
          <LogOut size={18} className={styles.logoutIcon} />
          <span>Cerrar Sesión</span>
        </button>
      </div>

    </aside>
  );
}
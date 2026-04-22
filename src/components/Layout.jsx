import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

export default function Layout({ user, isAdmin, currentView, onViewChange, onLogout, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getTitle = () => {
    switch(currentView) {
      case 'dashboard': return 'Telemetría del Vehículo';
      case 'admin': return 'Gestión de Usuarios';
      case 'profile': return 'Mi Cuenta';
      default: return 'Drako OS';
    }
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className={styles.layoutContainer}>
      {/* Overlay para móviles cuando el sidebar está abierto */}
      {isSidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={closeSidebar}></div>
      )}

      <Sidebar 
        user={user}
        isAdmin={isAdmin}
        currentView={currentView} 
        onViewChange={(view) => {
          onViewChange(view);
          closeSidebar();
        }} 
        onLogout={onLogout}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />
      
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button 
              className={styles.hamburgerBtn}
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={24} />
            </button>
            <h1 className={styles.title}>{getTitle()}</h1>
          </div>
          <div className={styles.userBadge}>
            👤 {user?.username} <span className={styles.roleText}>({user?.role})</span>
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
}
